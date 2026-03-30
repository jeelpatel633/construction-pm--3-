const router = require('express').Router();
const db = require('../config/db');

router.get('/', async(req, res) => {
    try {
        const [statusRows] = await db.query(`
      SELECT status, COUNT(*) AS count FROM projects GROUP BY status
    `);
        const statusMap = {};
        statusRows.forEach(r => { statusMap[r.status] = parseInt(r.count); });

        const [activeProjects] = await db.query(`
      SELECT p.id, p.project_name, p.status, c.client_name
      FROM projects p
      JOIN clients c ON c.id = p.client_id
      WHERE p.status IN ('active','on_hold','completed')
      ORDER BY p.created_at DESC
    `);

        let totalBilled = 0,
            totalCashIn = 0,
            totalCashOut = 0;

        const projectDetails = await Promise.all(activeProjects.map(async(p) => {
            const [
                [arch]
            ] = await db.query('SELECT COALESCE(SUM(grand_total),0) AS t FROM architect_work  WHERE project_id=?', [p.id]);
            const [
                [cont]
            ] = await db.query('SELECT COALESCE(SUM(grand_total),0) AS t FROM contractor_work WHERE project_id=?', [p.id]);
            const [
                [pay]
            ] = await db.query('SELECT COALESCE(SUM(amount),0)      AS t FROM client_payments WHERE project_id=?', [p.id]);
            const [
                [exp]
            ] = await db.query('SELECT COALESCE(SUM(amount),0)      AS t FROM cash_expenses   WHERE project_id=?', [p.id]);

            const bill = parseFloat(arch.t) + parseFloat(cont.t);
            const cashIn = parseFloat(pay.t);
            const cashOut = parseFloat(exp.t);
            const balance = bill - cashIn;
            // Current profit = cash received - cash spent so far
            const profitCurrent = cashIn - cashOut;
            // Expected profit = total bill - total expenses (when fully paid)
            const profitExpected = bill - cashOut;

            totalBilled += bill;
            totalCashIn += cashIn;
            totalCashOut += cashOut;

            return {
                id: p.id,
                project_name: p.project_name,
                client_name: p.client_name,
                status: p.status,
                total_bill: bill,
                cash_in: cashIn,
                cash_out: cashOut,
                balance_due: balance,
                profit_current: profitCurrent,
                profit_expected: profitExpected,
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
            },
            projects: projectDetails,
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;