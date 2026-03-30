const router = require('express').Router();
const db     = require('../config/db');

router.get('/:projectId', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM client_payments WHERE project_id=? ORDER BY payment_date DESC, id DESC',
      [req.params.projectId]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { project_id, payment_date, amount, payment_method, reference, notes } = req.body;
    if (!payment_date || !amount) return res.status(400).json({ error: 'payment_date and amount required' });
    const [r] = await db.query(
      'INSERT INTO client_payments (project_id,payment_date,amount,payment_method,reference,notes) VALUES (?,?,?,?,?,?)',
      [project_id, payment_date, parseFloat(amount), payment_method||'cash', reference||null, notes||null]
    );
    const [[row]] = await db.query('SELECT * FROM client_payments WHERE id=?', [r.insertId]);
    res.status(201).json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { payment_date, amount, payment_method, reference, notes } = req.body;
    await db.query(
      'UPDATE client_payments SET payment_date=?,amount=?,payment_method=?,reference=?,notes=? WHERE id=?',
      [payment_date, parseFloat(amount), payment_method||'cash', reference||null, notes||null, req.params.id]
    );
    const [[row]] = await db.query('SELECT * FROM client_payments WHERE id=?', [req.params.id]);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM client_payments WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
