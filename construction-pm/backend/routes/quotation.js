const router = require('express').Router();
const db = require('../config/db');

function calcLBH(l, b, h) {
    const L = parseFloat(l) || 0,
        B = parseFloat(b) || 0,
        H = parseFloat(h) || 0;
    if (L && B && H) return parseFloat((L * B * H).toFixed(3));
    if (L && B) return parseFloat((L * B).toFixed(3));
    if (L && H) return parseFloat((L * H).toFixed(3));
    if (L) return parseFloat(L.toFixed(3));
    return 0;
}

// ── GET invoice meta — MUST be before /:projectId ──────────────────────
router.get('/meta/:projectId', async(req, res) => {
    try {
        const [
            [project]
        ] = await db.query(
            'SELECT invoice_number, invoice_date, invoice_notes FROM projects WHERE id=?', [req.params.projectId]
        );
        if (!project) return res.status(404).json({ error: 'Not found' });
        res.json(project);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PATCH invoice meta — MUST be before /:projectId ────────────────────
router.patch('/meta/:projectId', async(req, res) => {
    try {
        const { invoice_number, invoice_date, invoice_notes } = req.body;
        await db.query(
            'UPDATE projects SET invoice_number=?, invoice_date=?, invoice_notes=? WHERE id=?', [invoice_number || null, invoice_date || null, invoice_notes || null, req.params.projectId]
        );
        const [
            [project]
        ] = await db.query(
            'SELECT invoice_number, invoice_date, invoice_notes FROM projects WHERE id=?', [req.params.projectId]
        );
        res.json(project);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET all quotation items ─────────────────────────────────────────────
router.get('/:projectId', async(req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM quotation_items WHERE project_id=? ORDER BY sr_no, id', [req.params.projectId]
        );
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST new item ───────────────────────────────────────────────────────
router.post('/', async(req, res) => {
    try {
        const { project_id, sr_no, description, unit, l_ft, b_ft, h_ft, quantity, rate, notes } = req.body;
        if (!description) return res.status(400).json({ error: 'description required' });
        const lbh = calcLBH(l_ft, b_ft, h_ft);
        const qty = parseFloat(quantity) || 1;
        const rt = parseFloat(rate) || 0;
        const amount = lbh > 0 ?
            parseFloat((lbh * qty * rt).toFixed(2)) :
            parseFloat((qty * rt).toFixed(2));
        const [r] = await db.query(
            `INSERT INTO quotation_items
             (project_id, sr_no, description, unit, l_ft, b_ft, h_ft, lbh_result, quantity, rate, amount, notes)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [project_id, parseInt(sr_no) || 0, description.trim(), unit || null,
                parseFloat(l_ft) || null, parseFloat(b_ft) || null, parseFloat(h_ft) || null,
                lbh || null, qty, rt, amount, notes || null
            ]
        );
        const [
            [row]
        ] = await db.query('SELECT * FROM quotation_items WHERE id=?', [r.insertId]);
        res.status(201).json(row);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT update item ─────────────────────────────────────────────────────
router.put('/:id', async(req, res) => {
    try {
        const { sr_no, description, unit, l_ft, b_ft, h_ft, quantity, rate, notes } = req.body;
        const lbh = calcLBH(l_ft, b_ft, h_ft);
        const qty = parseFloat(quantity) || 1;
        const rt = parseFloat(rate) || 0;
        const amount = lbh > 0 ?
            parseFloat((lbh * qty * rt).toFixed(2)) :
            parseFloat((qty * rt).toFixed(2));
        await db.query(
            `UPDATE quotation_items
             SET sr_no=?, description=?, unit=?, l_ft=?, b_ft=?, h_ft=?,
                 lbh_result=?, quantity=?, rate=?, amount=?, notes=?
             WHERE id=?`, [parseInt(sr_no) || 0, description, unit || null,
                parseFloat(l_ft) || null, parseFloat(b_ft) || null, parseFloat(h_ft) || null,
                lbh || null, qty, rt, amount, notes || null, req.params.id
            ]
        );
        const [
            [row]
        ] = await db.query('SELECT * FROM quotation_items WHERE id=?', [req.params.id]);
        res.json(row);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE item ─────────────────────────────────────────────────────────
router.delete('/:id', async(req, res) => {
    try {
        await db.query('DELETE FROM quotation_items WHERE id=?', [req.params.id]);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;