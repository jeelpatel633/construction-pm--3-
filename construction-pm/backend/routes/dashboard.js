const router = require('express').Router();
const db = require('../config/db');

router.get('/', async(req, res) => {
    try {
        const uid =
            req.user.role === 'admin' ?
            (req.query.as_user && req.query.as_user !== 'all' ?
                parseInt(req.query.as_user) :
                null) :
            req.user.id;

        const userFilter = uid ? `AND c.user_id = ${db.escape(uid)}` : '';

        const [statusRows] = await db.query(`
            SELECT p.status, COUNT(*) AS count
            FROM projects p
            JOIN clients c ON c.id = p.client_id
            WHERE 1=1 ${userFilter}
            GROUP BY p.status
        `);
        const statusMap = {};
        statusRows.forEach(r => { statusMap[r.status] = parseInt(r.count); });

        const [activeProjects] = await db.query(`
            SELECT p.id, p.project_name, p.status, c.client_name
            FROM projects p
            JOIN clients c ON c.id = p.client_id
            WHERE p.status IN ('active','on_hold','completed') ${userFilter}
            ORDER BY p.created_at DESC
        `);

        // ── CHANGE 1: Add totalLiability = 0 alongside the other totals ──
        let totalBilled = 0;
        let totalCashIn = 0;
        let totalCashOut = 0;
        let totalLiability = 0;

        const projectDetails = await Promise.all(activeProjects.map(async(p) => {
            const [
                [arch]
            ] = await db.query(
                'SELECT COALESCE(SUM(grand_total),0) AS t FROM architect_work  WHERE project_id=?', [p.id]
            );
            const [
                [cont]
            ] = await db.query(
                'SELECT COALESCE(SUM(grand_total),0) AS t FROM contractor_work WHERE project_id=?', [p.id]
            );
            const [
                [pay]
            ] = await db.query(
                'SELECT COALESCE(SUM(amount),0) AS t FROM client_payments WHERE project_id=?', [p.id]
            );
            const [
                [exp]
            ] = await db.query(
                'SELECT COALESCE(SUM(amount),0) AS t FROM cash_expenses WHERE project_id=?', [p.id]
            );

            // ── Vendor bills: calculate liability per project ──
            // 1. Total paid per vendor
            const [payments] = await db.query(`
            SELECT paid_to, SUM(amount) AS total_paid
            FROM cash_expenses
            WHERE project_id = ?
            AND paid_to IS NOT NULL
            AND paid_to != ''
            GROUP BY paid_to`, [p.id]);

            // 2. Total billed per vendor
            const [bills] = await db.query(`
                SELECT vendor_name, SUM(bill_amount) AS total_bill
                FROM vendor_bills
                WHERE project_id = ?
                GROUP BY vendor_name
            `, [p.id]);

            // 3. Build paid map
            const paidMap = {};
            payments.forEach(p => {
                const key = p.paid_to.toLowerCase().trim();
                paidMap[key] = parseFloat(p.total_paid) || 0;
            });

            // 4. ✅ ONLY ONE liability variable
            let liability = 0;

            bills.forEach(b => {
                const key = b.vendor_name.toLowerCase().trim();
                const total = parseFloat(b.total_bill) || 0;
                const paid = paidMap[key] || 0;

                liability += Math.max(0, total - paid);
            });

            const bill = parseFloat(arch.t) + parseFloat(cont.t);
            const cashIn = parseFloat(pay.t);
            const cashOut = parseFloat(exp.t);

            totalBilled += bill;
            totalCashIn += cashIn;
            totalCashOut += cashOut;
            // ── CHANGE 2: Accumulate liability into totalLiability ──
            totalLiability += liability;

            return {
                id: p.id,
                project_name: p.project_name,
                client_name: p.client_name,
                status: p.status,
                total_bill: bill,
                cash_in: cashIn,
                cash_out: cashOut,
                balance_due: bill - cashIn,
                profit_current: cashIn - cashOut,
                profit_expected: bill - cashOut,
                liability: liability,
            };
        }));

        res.json({
            status_counts: {
                active: statusMap['active'] || 0,
                on_hold: statusMap['on_hold'] || 0,
                completed: statusMap['completed'] || 0,
                planning: statusMap['planning'] || 0,
                total: Object.values(statusMap).reduce((s, v) => s + v, 0),
            },
            financials: {
                total_billed: totalBilled,
                total_cash_in: totalCashIn,
                total_cash_out: totalCashOut,
                total_balance: totalBilled - totalCashIn,
                total_profit: totalCashIn - totalCashOut,
                // ── CHANGE 3: Return totalLiability in financials ──
                total_liability: totalLiability,
            },
            projects: projectDetails,
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;