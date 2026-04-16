const router = require('express').Router();
const db = require('../config/db');

// Helper — returns user_id to filter by based on role + as_user param
function getFilterUserId(req) {
    if (req.user.role === 'admin') {
        const asUser = req.query.as_user;
        if (!asUser || asUser === 'all') return null; // null = no filter, see all
        return parseInt(asUser);
    }
    return req.user.id; // regular user sees only their own
}

router.get('/', async(req, res) => {
    try {
        const raw = req.query.search || '';
        const search = raw.trim() !== '' ? `%${raw.trim()}%` : '%';
        const uid = getFilterUserId(req);

        let sql = `
      SELECT c.*, COUNT(p.id) AS project_count
      FROM clients c
      LEFT JOIN projects p ON p.client_id = c.id
      WHERE (c.client_name LIKE ? OR c.phone LIKE ?)
    `;
        const args = [search, search];

        if (uid !== null) {
            sql += ' AND c.user_id = ?';
            args.push(uid);
        }

        sql += ' GROUP BY c.id ORDER BY c.created_at DESC';

        const [rows] = await db.query(sql, args);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async(req, res) => {
    try {
        const [
            [row]
        ] = await db.query('SELECT * FROM clients WHERE id=?', [req.params.id]);
        if (!row) return res.status(404).json({ error: 'Not found' });
        res.json(row);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async(req, res) => {
    try {
        const { client_name, phone, email, address, notes } = req.body;
        if (!client_name) return res.status(400).json({ error: 'client_name required' });

        // Regular user always gets their own user_id
        // Admin creating a client: assign to as_user or admin themselves
        let userId = req.user.id;
        if (req.user.role === 'admin' && req.query.as_user && req.query.as_user !== 'all') {
            userId = parseInt(req.query.as_user);
        }

        const [r] = await db.query(
            'INSERT INTO clients (user_id, client_name, phone, email, address, notes) VALUES (?,?,?,?,?,?)', [userId, client_name.trim(), phone || null, email || null, address || null, notes || null]
        );
        const [
            [created]
        ] = await db.query('SELECT * FROM clients WHERE id=?', [r.insertId]);
        res.status(201).json(created);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async(req, res) => {
    try {
        const { client_name, phone, email, address, notes } = req.body;
        await db.query(
            'UPDATE clients SET client_name=?,phone=?,email=?,address=?,notes=? WHERE id=?', [client_name, phone || null, email || null, address || null, notes || null, req.params.id]
        );
        const [
            [updated]
        ] = await db.query('SELECT * FROM clients WHERE id=?', [req.params.id]);
        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async(req, res) => {
    try {
        await db.query('DELETE FROM clients WHERE id=?', [req.params.id]);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;