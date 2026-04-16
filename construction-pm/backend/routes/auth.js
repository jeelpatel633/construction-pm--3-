const router = require('express').Router();
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authMW = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'navyakar_jwt_secret_2026';

// ── POST /api/auth/login ─────────────────────────────────────────────────
router.post('/login', async(req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password)
            return res.status(400).json({ error: 'Username and password required' });

        const [
            [user]
        ] = await db.query(
            'SELECT * FROM users WHERE username = ?', [username.trim().toLowerCase()]
        );
        if (!user) return res.status(401).json({ error: 'Invalid username or password' });

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Invalid username or password' });

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role, display_name: user.display_name },
            JWT_SECRET, { expiresIn: '60d' }
        );

        res.json({
            token,
            user: { id: user.id, username: user.username, role: user.role, display_name: user.display_name },
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/auth/signup ────────────────────────────────────────────────
router.post('/signup', async(req, res) => {
    try {
        const { username, password, admin_password } = req.body;
        if (!username || !password || !admin_password)
            return res.status(400).json({ error: 'All fields are required' });

        const [
            [admin]
        ] = await db.query(`SELECT * FROM users WHERE role = 'admin' LIMIT 1`);
        if (!admin) return res.status(500).json({ error: 'No admin configured' });

        const adminValid = await bcrypt.compare(admin_password, admin.password_hash);
        if (!adminValid) return res.status(401).json({ error: 'Incorrect admin password' });

        const [
            [existing]
        ] = await db.query(
            'SELECT id FROM users WHERE username = ?', [username.trim().toLowerCase()]
        );
        if (existing) return res.status(400).json({ error: 'Username already taken' });

        if (password.length < 6)
            return res.status(400).json({ error: 'Password must be at least 6 characters' });

        const hash = await bcrypt.hash(password, 10);
        await db.query(
            'INSERT INTO users (username, password_hash, role, display_name) VALUES (?, ?, ?, ?)', [username.trim().toLowerCase(), hash, 'user', username.trim()]
        );
        res.status(201).json({ ok: true, message: 'Account created! You can now login.' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/auth/me ─────────────────────────────────────────────────────
router.get('/me', authMW, (req, res) => res.json(req.user));

// ── GET /api/auth/users ──────────────────────────────────────────────────
router.get('/users', authMW, async(req, res) => {
    if (req.user.role !== 'admin')
        return res.status(403).json({ error: 'Admin only' });
    try {
        const [rows] = await db.query(
            `SELECT id, username, display_name, created_at FROM users WHERE role = 'user' ORDER BY created_at ASC`
        );
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/auth/password — change own password (requires old password) ─
router.put('/password', authMW, async(req, res) => {
    try {
        const { old_password, new_password } = req.body;
        if (!old_password || !new_password)
            return res.status(400).json({ error: 'Both fields required' });
        if (new_password.length < 6)
            return res.status(400).json({ error: 'New password must be at least 6 characters' });

        const [
            [user]
        ] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
        const valid = await bcrypt.compare(old_password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

        const hash = await bcrypt.hash(new_password, 10);
        await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/auth/check-reset-status ───────────────────────────────────
// Returns whether the user's free reset is still available
router.post('/check-reset-status', async(req, res) => {
    try {
        const { username } = req.body;
        if (!username) return res.status(400).json({ error: 'Username required' });

        const [
            [user]
        ] = await db.query(
            `SELECT free_reset_used FROM users WHERE username = ? AND role = 'user'`, [username.trim().toLowerCase()]
        );
        if (!user) return res.status(404).json({ error: 'User not found' });

        res.json({ free_reset_available: !user.free_reset_used });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/auth/forgot-password ──────────────────────────────────────
// 1st time: free reset — just username + new_password
// 2nd+ time: requires admin_password too
router.post('/forgot-password', async(req, res) => {
    try {
        const { username, new_password, admin_password } = req.body;
        if (!username || !new_password)
            return res.status(400).json({ error: 'Username and new password required' });
        if (new_password.length < 6)
            return res.status(400).json({ error: 'Password must be at least 6 characters' });

        const [
            [user]
        ] = await db.query(
            `SELECT * FROM users WHERE username = ? AND role = 'user'`, [username.trim().toLowerCase()]
        );
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (!user.free_reset_used) {
            // ── First free reset ─────────────────────────────────────────────
            const hash = await bcrypt.hash(new_password, 10);
            await db.query(
                'UPDATE users SET password_hash = ?, free_reset_used = 1 WHERE id = ?', [hash, user.id]
            );
            return res.json({ ok: true, message: 'Password reset successfully!' });
        } else {
            // ── Second+ reset: admin password required ───────────────────────
            if (!admin_password)
                return res.status(403).json({ error: 'Admin password required for second reset', need_admin: true });

            const [
                [admin]
            ] = await db.query(`SELECT * FROM users WHERE role = 'admin' LIMIT 1`);
            if (!admin) return res.status(500).json({ error: 'No admin configured' });

            const adminValid = await bcrypt.compare(admin_password, admin.password_hash);
            if (!adminValid) return res.status(401).json({ error: 'Incorrect admin password' });

            const hash = await bcrypt.hash(new_password, 10);
            await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, user.id]);
            return res.json({ ok: true, message: 'Password reset successfully!' });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/auth/admin/users/:userId/password ───────────────────────────
// Admin resets any user's password directly
router.put('/admin/users/:userId/password', authMW, async(req, res) => {
    if (req.user.role !== 'admin')
        return res.status(403).json({ error: 'Admin only' });
    try {
        const { new_password } = req.body;
        if (!new_password || new_password.length < 6)
            return res.status(400).json({ error: 'Minimum 6 characters required' });

        const [
            [target]
        ] = await db.query(
            `SELECT id FROM users WHERE id = ? AND role = 'user'`, [req.params.userId]
        );
        if (!target) return res.status(404).json({ error: 'User not found' });

        const hash = await bcrypt.hash(new_password, 10);
        // Also reset the free_reset_used flag so user gets their free reset back
        await db.query(
            'UPDATE users SET password_hash = ?, free_reset_used = 0 WHERE id = ?', [hash, req.params.userId]
        );
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/auth/admin/users/:userId ─────────────────────────────────
// Admin deletes a user and all their data
router.delete('/admin/users/:userId', authMW, async(req, res) => {
    if (req.user.role !== 'admin')
        return res.status(403).json({ error: 'Admin only' });
    try {
        const [
            [target]
        ] = await db.query(
            `SELECT id, username FROM users WHERE id = ? AND role = 'user'`, [req.params.userId]
        );
        if (!target) return res.status(404).json({ error: 'User not found' });

        // Delete user's clients (cascades to projects/invoices/quotations via FK or manual)
        await db.query('DELETE FROM clients WHERE user_id = ?', [req.params.userId]);
        await db.query('DELETE FROM users WHERE id = ?', [req.params.userId]);

        res.json({ ok: true, deleted_username: target.username });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/auth/admin/emergency-reset ─────────────────────────────────
// Admin resets own password using ADMIN_RESET_KEY from .env
// Use when admin has forgotten their password
router.post('/admin/emergency-reset', async(req, res) => {
    try {
        const { reset_key, new_password } = req.body;
        const ADMIN_RESET_KEY = process.env.ADMIN_RESET_KEY;

        if (!ADMIN_RESET_KEY)
            return res.status(403).json({ error: 'Emergency reset not configured on server' });
        if (!reset_key || reset_key !== ADMIN_RESET_KEY)
            return res.status(401).json({ error: 'Invalid emergency reset key' });
        if (!new_password || new_password.length < 6)
            return res.status(400).json({ error: 'Minimum 6 characters required' });

        const hash = await bcrypt.hash(new_password, 10);
        await db.query(
            `UPDATE users SET password_hash = ? WHERE role = 'admin' LIMIT 1`, [hash]
        );
        res.json({ ok: true, message: 'Admin password reset successfully!' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;