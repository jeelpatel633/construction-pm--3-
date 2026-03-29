const router = require('express').Router();
const db     = require('../config/db');

router.get('/:projectId', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM invoice_statements WHERE project_id=? ORDER BY sort_order, id',
      [req.params.projectId]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { project_id, statement, sort_order } = req.body;
    if (!statement?.trim()) return res.status(400).json({ error: 'statement required' });
    const [r] = await db.query(
      'INSERT INTO invoice_statements (project_id,statement,sort_order) VALUES (?,?,?)',
      [project_id, statement.trim(), sort_order || 0]
    );
    const [[row]] = await db.query('SELECT * FROM invoice_statements WHERE id=?', [r.insertId]);
    res.status(201).json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Bulk replace all statements for a project
router.post('/bulk/:projectId', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { statements } = req.body; // array of strings
    await conn.query('DELETE FROM invoice_statements WHERE project_id=?', [req.params.projectId]);
    if (Array.isArray(statements) && statements.length > 0) {
      const vals = statements.filter(s => s?.trim()).map((s, i) => [req.params.projectId, s.trim(), i]);
      if (vals.length > 0)
        await conn.query('INSERT INTO invoice_statements (project_id,statement,sort_order) VALUES ?', [vals]);
    }
    await conn.commit();
    const [rows] = await conn.query('SELECT * FROM invoice_statements WHERE project_id=? ORDER BY sort_order', [req.params.projectId]);
    res.json(rows);
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally { conn.release(); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM invoice_statements WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
