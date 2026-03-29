const db = require('../config/db');

// ── LBH calculation (construction style) ─────────────────────────────────
// Returns area or volume depending on which fields are filled
function calcLBH(l, b, h) {
    const L = parseFloat(l) || 0;
    const B = parseFloat(b) || 0;
    const H = parseFloat(h) || 0;
    if (L && B && H) return parseFloat((L * B * H).toFixed(3)); // volume (cubic ft)
    if (L && B) return parseFloat((L * B).toFixed(3)); // area (sq ft)
    if (L && H) return parseFloat((L * H).toFixed(3)); // wall area
    if (L) return parseFloat(L.toFixed(3)); // linear ft
    return 0;
}

// grand_total = lbh_result * quantity * rate + additional_cost + (lbh_result * qty * rate * tax/100)
function calcGrandTotal(lbh, qty, rate, addCost, tax) {
    const base = lbh * (parseFloat(qty) || 1) * (parseFloat(rate) || 0);
    const ac = parseFloat(addCost) || 0;
    const tx = parseFloat(tax) || 0;
    return parseFloat((base + ac + (base * tx / 100)).toFixed(2));
}

function makeWorkRouter(tableName) {
    const router = require('express').Router();

    router.get('/:projectId', async(req, res) => {
        try {
            const [rows] = await db.query(
                `SELECT * FROM ${tableName} WHERE project_id=? ORDER BY id`, [req.params.projectId]
            );
            res.json(rows);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/', async(req, res) => {
        try {
            const {
                project_id,
                item_name,
                unit,
                l_ft,
                b_ft,
                h_ft,
                quantity,
                rate,
                additional_cost,
                tax_percent,
                notes
            } = req.body;

            if (!item_name) return res.status(400).json({ error: 'item_name required' });
            const lbh = calcLBH(l_ft, b_ft, h_ft);
            const grand_total = calcGrandTotal(lbh || (parseFloat(quantity) || 0), lbh ? 1 : 0, rate, additional_cost, tax_percent);
            // If LBH is used: effective_qty = lbh_result, quantity is multiplier
            // If no LBH: use quantity directly like before
            const useLBH = lbh > 0;
            const gt = useLBH ?
                calcGrandTotal(lbh, quantity, rate, additional_cost, tax_percent) :
                calcGrandTotal(parseFloat(quantity) || 0, 1, rate, additional_cost, tax_percent);

            const [r] = await db.query(
                `INSERT INTO ${tableName}
         (project_id, item_name, unit, l_ft, b_ft, h_ft, lbh_result, quantity, rate, additional_cost, tax_percent, notes)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [
                    project_id,
                    item_name.trim(),
                    unit || null,
                    parseFloat(l_ft) || null,
                    parseFloat(b_ft) || null,
                    parseFloat(h_ft) || null,
                    lbh || null,
                    parseFloat(quantity) || 0,
                    parseFloat(rate) || 0,
                    parseFloat(additional_cost) || 0,
                    parseFloat(tax_percent) || 0,
                    notes || null,
                ]
            );

            // Update grand_total (not generated, we store it manually)
            await db.query(
                `UPDATE ${tableName} SET grand_total=? WHERE id=?`, [gt, r.insertId]
            );

            const [
                [row]
            ] = await db.query(`SELECT * FROM ${tableName} WHERE id=?`, [r.insertId]);
            res.status(201).json(row);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.put('/:id', async(req, res) => {
        try {
            const {
                item_name,
                unit,
                l_ft,
                b_ft,
                h_ft,
                quantity,
                rate,
                additional_cost,
                tax_percent,
                notes
            } = req.body;

            const lbh = calcLBH(l_ft, b_ft, h_ft);
            const useLBH = lbh > 0;
            const gt = useLBH ?
                calcGrandTotal(lbh, quantity, rate, additional_cost, tax_percent) :
                calcGrandTotal(parseFloat(quantity) || 0, 1, rate, additional_cost, tax_percent);

            await db.query(
                `UPDATE ${tableName}
         SET item_name=?, unit=?, l_ft=?, b_ft=?, h_ft=?, lbh_result=?,
             quantity=?, rate=?, additional_cost=?, tax_percent=?, grand_total=?, notes=?
         WHERE id=?`, [
                    item_name,
                    unit || null,
                    parseFloat(l_ft) || null,
                    parseFloat(b_ft) || null,
                    parseFloat(h_ft) || null,
                    lbh || null,
                    parseFloat(quantity) || 0,
                    parseFloat(rate) || 0,
                    parseFloat(additional_cost) || 0,
                    parseFloat(tax_percent) || 0,
                    gt,
                    notes || null,
                    req.params.id,
                ]
            );

            const [
                [row]
            ] = await db.query(`SELECT * FROM ${tableName} WHERE id=?`, [req.params.id]);
            res.json(row);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.delete('/:id', async(req, res) => {
        try {
            await db.query(`DELETE FROM ${tableName} WHERE id=?`, [req.params.id]);
            res.json({ ok: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    return router;
}

module.exports = makeWorkRouter;