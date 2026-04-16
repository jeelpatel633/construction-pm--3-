const router = require('express').Router();
const db = require('../config/db');

// ── SPECIFIC routes FIRST — before /:projectId ───────────────────────────

// GET combined summary — ALL vendors from cash_expenses + their bills
router.get('/summary/:projectId', async(req, res) => {
    try {
        const [payments] = await db.query(
            `SELECT paid_to, category,
              COUNT(*) AS entry_count,
              SUM(amount) AS total_paid
       FROM cash_expenses
       WHERE project_id = ? AND paid_to IS NOT NULL AND paid_to != ''
       GROUP BY paid_to, category
       ORDER BY paid_to ASC`, [req.params.projectId]
        );

        // In /summary/:projectId — bills query:
        const [bills] = await db.query(
            `SELECT *, DATE_FORMAT(bill_date, '%Y-%m-%d') AS bill_date
        FROM vendor_bills WHERE project_id = ? ORDER BY bill_date DESC`, [req.params.projectId]
        );


        const [entries] = await db.query(
            `SELECT * FROM cash_expenses
       WHERE project_id = ? AND paid_to IS NOT NULL AND paid_to != ''
       ORDER BY expense_date DESC, id DESC`, [req.params.projectId]
        );

        res.json({ payments, bills, entries });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET total liability for a project
router.get('/liability/:projectId', async(req, res) => {
    try {
        const [bills] = await db.query(
            `SELECT vb.*, DATE_FORMAT(vb.bill_date, '%Y-%m-%d') AS bill_date,
                COALESCE(SUM(ce.amount), 0) AS paid_amount
        FROM vendor_bills vb
        LEFT JOIN cash_expenses ce
                ON ce.project_id = vb.project_id
                AND LOWER(TRIM(ce.paid_to)) = LOWER(TRIM(vb.vendor_name))
        WHERE vb.project_id = ?
        GROUP BY vb.id
        ORDER BY vb.bill_date DESC, vb.id DESC`, [req.params.projectId]
        );
        const liability = bills.reduce((sum, b) => {
            return sum + Math.max(0, parseFloat(b.bill_amount) - parseFloat(b.paid_amount));
        }, 0);
        res.json({ liability });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GENERIC /:projectId LAST ─────────────────────────────────────────────

router.get('/:projectId', async(req, res) => {
    try {
        const [bills] = await db.query(
            `SELECT vb.*,
              COALESCE(SUM(ce.amount), 0) AS paid_amount
       FROM vendor_bills vb
       LEFT JOIN cash_expenses ce
              ON ce.project_id = vb.project_id
             AND LOWER(TRIM(ce.paid_to)) = LOWER(TRIM(vb.vendor_name))
       WHERE vb.project_id = ?
       GROUP BY vb.id
       ORDER BY vb.bill_date DESC, vb.id DESC`, [req.params.projectId]
        );
        const result = bills.map(b => {
            const bill = parseFloat(b.bill_amount);
            const paid = parseFloat(b.paid_amount);
            const due = Math.max(0, bill - paid);
            let status = 'unpaid';
            if (paid >= bill) status = 'paid';
            else if (paid > 0) status = 'partial';
            return {...b, bill_amount: bill, paid_amount: paid, balance_due: due, status };
        });
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async(req, res) => {
    try {
        const { project_id, vendor_name, category, bill_amount, bill_date, bill_reference } = req.body;
        if (!project_id || !vendor_name || !bill_amount || !bill_date)
            return res.status(400).json({ error: 'project_id, vendor_name, bill_amount, bill_date required' });
        const [r] = await db.query(
            `INSERT INTO vendor_bills (project_id, user_id, vendor_name, category, bill_amount, bill_date, bill_reference)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, [
                project_id, req.user.id, vendor_name.trim(),
                category || null, parseFloat(bill_amount), bill_date,
                (bill_reference ? bill_reference.trim() : null),
            ]
        );
        const [
            [row]
        ] = await db.query('SELECT * FROM vendor_bills WHERE id = ?', [r.insertId]);
        res.status(201).json(row);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async(req, res) => {
    try {
        const { vendor_name, category, bill_amount, bill_date, bill_reference } = req.body;
        await db.query(
            `UPDATE vendor_bills
       SET vendor_name=?, category=?, bill_amount=?, bill_date=?, bill_reference=?
       WHERE id=?`, [
                vendor_name.trim(), category || null,
                parseFloat(bill_amount), bill_date,
                (bill_reference ? bill_reference.trim() : null),
                req.params.id,
            ]
        );
        const [
            [row]
        ] = await db.query('SELECT * FROM vendor_bills WHERE id = ?', [req.params.id]);
        res.json(row);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async(req, res) => {
    try {
        await db.query('DELETE FROM vendor_bills WHERE id = ?', [req.params.id]);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;