const router = require('express').Router();
const db = require('../config/db');

router.get('/', async(req, res) => {
    try {
        const raw = req.query.search || '';
        const search = raw.trim() !== '' ? `%${raw.trim()}%` : '%';

        const [rows] = await db.query(
            `SELECT c.*, COUNT(p.id) AS project_count
       FROM clients c
       LEFT JOIN projects p ON p.client_id = c.id
       WHERE c.client_name LIKE ? OR c.phone LIKE ?
       GROUP BY c.id
       ORDER BY c.created_at DESC`, [search, search]
        );
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
        const [r] = await db.query(
            'INSERT INTO clients (client_name,phone,email,address,notes) VALUES (?,?,?,?,?)', [client_name.trim(), phone || null, email || null, address || null, notes || null]
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