const router = require('express').Router();
const db = require('../config/db');

async function getFinancials(projectId) {
    const [
        [arch]
    ] = await db.query('SELECT COALESCE(SUM(grand_total),0) AS total FROM architect_work  WHERE project_id=?', [projectId]);
    const [
        [cont]
    ] = await db.query('SELECT COALESCE(SUM(grand_total),0) AS total FROM contractor_work WHERE project_id=?', [projectId]);
    const [
        [pay]
    ] = await db.query('SELECT COALESCE(SUM(amount),0)      AS total FROM client_payments WHERE project_id=?', [projectId]);
    const architect_total = parseFloat(arch.total);
    const contractor_total = parseFloat(cont.total);
    const total_bill = architect_total + contractor_total;
    const total_paid = parseFloat(pay.total);
    const balance_due = total_bill - total_paid;
    return { architect_total, contractor_total, total_bill, total_paid, balance_due };
}

async function generateInvoiceNumber() {
    const year = new Date().getFullYear();
    const [
        [row]
    ] = await db.query('SELECT COUNT(*) AS cnt FROM projects WHERE invoice_number IS NOT NULL');
    const seq = String(parseInt(row.cnt) + 1).padStart(3, '0');
    return `INV-${year}-${seq}`;
}

// GET by client
router.get('/client/:clientId', async(req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM projects WHERE client_id=? ORDER BY created_at DESC', [req.params.clientId]
        );
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET single with financials
router.get('/:id', async(req, res) => {
    try {
        const [
            [project]
        ] = await db.query(
            `SELECT p.*, c.client_name, c.phone, c.email, c.address AS client_address
             FROM projects p JOIN clients c ON c.id=p.client_id WHERE p.id=?`, [req.params.id]
        );
        if (!project) return res.status(404).json({ error: 'Not found' });
        const fin = await getFinancials(req.params.id);
        res.json({...project, ...fin });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async(req, res) => {
    try {
        const { client_id, project_name, location, start_date, end_date, status, notes, commission_percent } = req.body;
        if (!client_id || !project_name) return res.status(400).json({ error: 'client_id and project_name required' });

        const invoiceNum = await generateInvoiceNumber();
        const today = new Date().toISOString().slice(0, 10);

        const [r] = await db.query(
            `INSERT INTO projects
             (client_id,project_name,location,start_date,end_date,status,notes,commission_percent,invoice_number,invoice_date)
             VALUES (?,?,?,?,?,?,?,?,?,?)`, [client_id, project_name.trim(), location || null, start_date || null, end_date || null,
                status || 'planning', notes || null, parseFloat(commission_percent) || 3, invoiceNum, today
            ]
        );
        const [
            [created]
        ] = await db.query('SELECT * FROM projects WHERE id=?', [r.insertId]);
        res.status(201).json(created);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async(req, res) => {
    try {
        const {
            project_name,
            location,
            start_date,
            end_date,
            status,
            notes,
            invoice_notes,
            sig_client,
            sig_contractor,
            sig_contractor_img, // ✅ ADDED
            commission_percent,
            invoice_number,
            invoice_date,
        } = req.body;

        await db.query(
            `UPDATE projects SET
             project_name=?, location=?, start_date=?, end_date=?, status=?,
             notes=?, invoice_notes=?, sig_client=?, sig_contractor=?,
             sig_contractor_img=?,
             commission_percent=?, invoice_number=?, invoice_date=?
             WHERE id=?`, [
                project_name,
                location || null,
                start_date ? start_date.slice(0, 10) : null,
                end_date ? end_date.slice(0, 10) : null,
                status || 'planning',
                notes || null,
                invoice_notes || null,
                sig_client || null,
                sig_contractor || null,
                sig_contractor_img || null, // ✅ ADDED
                parseFloat(commission_percent) || 3,
                invoice_number || null,
                invoice_date ? invoice_date.slice(0, 10) : null,
                req.params.id,
            ]
        );
        const [
            [updated]
        ] = await db.query('SELECT * FROM projects WHERE id=?', [req.params.id]);
        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async(req, res) => {
    try {
        await db.query('DELETE FROM projects WHERE id=?', [req.params.id]);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;