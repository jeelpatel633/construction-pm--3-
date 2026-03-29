const router = require('express').Router();
const db = require('../config/db');

// ── Auto-create table ────────────────────────────────────────────────────
db.query(`
  CREATE TABLE IF NOT EXISTS cash_expenses (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    project_id   INT NOT NULL,
    expense_date DATE NOT NULL,
    category     VARCHAR(100) NOT NULL,
    description  VARCHAR(500),
    amount       DECIMAL(12,2) NOT NULL DEFAULT 0,
    paid_to      VARCHAR(255),
    notes        VARCHAR(500),
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_project (project_id)
  )
`).catch(console.error);

// GET all for a project
router.get('/:projectId', async(req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM cash_expenses WHERE project_id=? ORDER BY expense_date DESC, id DESC', [req.params.projectId]
        );
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET total for a project
router.get('/total/:projectId', async(req, res) => {
    try {
        const [
            [row]
        ] = await db.query(
            'SELECT COALESCE(SUM(amount),0) AS total FROM cash_expenses WHERE project_id=?', [req.params.projectId]
        );
        res.json({ total: parseFloat(row.total) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST new expense
router.post('/', async(req, res) => {
    try {
        const { project_id, expense_date, category, description, amount, paid_to, notes } = req.body;
        if (!project_id || !amount) return res.status(400).json({ error: 'project_id and amount required' });
        const [r] = await db.query(
            `INSERT INTO cash_expenses (project_id, expense_date, category, description, amount, paid_to, notes)
       VALUES (?,?,?,?,?,?,?)`, [project_id, expense_date || new Date().toISOString().slice(0, 10),
                category || 'Other', description || null,
                parseFloat(amount), paid_to || null, notes || null
            ]
        );
        const [
            [row]
        ] = await db.query('SELECT * FROM cash_expenses WHERE id=?', [r.insertId]);
        res.status(201).json(row);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT update
router.put('/:id', async(req, res) => {
    try {
        const { expense_date, category, description, amount, paid_to, notes } = req.body;
        await db.query(
            `UPDATE cash_expenses SET expense_date=?, category=?, description=?, amount=?, paid_to=?, notes=? WHERE id=?`, [expense_date, category || 'Other', description || null,
                parseFloat(amount), paid_to || null, notes || null, req.params.id
            ]
        );
        const [
            [row]
        ] = await db.query('SELECT * FROM cash_expenses WHERE id=?', [req.params.id]);
        res.json(row);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE
router.delete('/:id', async(req, res) => {
    try {
        await db.query('DELETE FROM cash_expenses WHERE id=?', [req.params.id]);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;