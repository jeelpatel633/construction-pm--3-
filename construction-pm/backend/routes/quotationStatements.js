const router = require('express').Router();
const db = require('../config/db');

// GET all statements for a project
router.get('/:projectId', async(req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM quotation_statements WHERE project_id=? ORDER BY sort_order, id', [req.params.projectId]
        );
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST bulk save (replaces all statements for a project)
router.post('/bulk/:projectId', async(req, res) => {
    try {
        const { statements } = req.body;
        const pid = req.params.projectId;

        // Delete existing and re-insert
        await db.query('DELETE FROM quotation_statements WHERE project_id=?', [pid]);

        if (statements && statements.length > 0) {
            const values = statements.map((s, i) => [pid, s.trim(), i]);
            await db.query(
                'INSERT INTO quotation_statements (project_id, statement, sort_order) VALUES ?', [values]
            );
        }

        const [rows] = await db.query(
            'SELECT * FROM quotation_statements WHERE project_id=? ORDER BY sort_order, id', [pid]
        );
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;