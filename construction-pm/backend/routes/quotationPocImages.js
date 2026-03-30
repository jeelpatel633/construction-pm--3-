const router = require('express').Router();
const db = require('../config/db');

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Strip leading/trailing whitespace and normalise the data-URI prefix.
 *  Accepts either a raw base64 string or a full data:image/...;base64,... URI.
 *  Always returns a data-URI so pdfmake can use it directly. */
function normaliseImageData(raw) {
    if (!raw || typeof raw !== 'string') throw new Error('image_data is required');
    const s = raw.trim();
    if (s.startsWith('data:')) return s;
    // bare base64 — assume jpeg (browser canvas always emits jpeg from compressImage)
    return 'data:image/jpeg;base64,' + s;
}

/** Rough size guard — 500 KB base64 ≈ 375 KB binary.
 *  1 MB base64 ≈ 750 KB binary.  Reject anything above 2 MB base64 (~1.5 MB binary). */
const MAX_B64_BYTES = 2 * 1024 * 1024; // 2 MB base64 chars

function guardSize(dataUri) {
    const b64 = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;
    if (b64.length > MAX_B64_BYTES) {
        throw new Error(`Image too large (${(b64.length / 1024 / 1024).toFixed(1)} MB base64). Max 2 MB.`);
    }
}

// ── GET all images for a project (sorted) ───────────────────────────────────
router.get('/:projectId', async(req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, project_id, caption, sort_order, created_at,
                    LEFT(image_data, 50) AS image_preview
             FROM quotation_poc_images
             WHERE project_id = ?
             ORDER BY sort_order, id`, [req.params.projectId]
        );
        // Return metadata only (no full base64) so the list call stays fast
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET single image — full base64, used when rendering thumbnails or PDF ───
router.get('/image/:id', async(req, res) => {
    try {
        const [
            [row]
        ] = await db.query(
            'SELECT id, project_id, image_data, caption, sort_order FROM quotation_poc_images WHERE id = ?', [req.params.id]
        );
        if (!row) return res.status(404).json({ error: 'Image not found' });
        res.json(row);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST add a new image ─────────────────────────────────────────────────────
router.post('/:projectId', async(req, res) => {
    try {
        const pid = parseInt(req.params.projectId, 10);
        if (!pid) return res.status(400).json({ error: 'Invalid project_id' });

        const { image_data, caption, sort_order } = req.body;
        const dataUri = normaliseImageData(image_data);
        guardSize(dataUri);

        // Place at the end of the list by default
        const [
            [{ maxOrder }]
        ] = await db.query(
            'SELECT COALESCE(MAX(sort_order), -1) AS maxOrder FROM quotation_poc_images WHERE project_id = ?', [pid]
        );
        const order = (sort_order !== undefined && sort_order !== null) ?
            parseInt(sort_order, 10) :
            maxOrder + 1;

        const [result] = await db.query(
            `INSERT INTO quotation_poc_images (project_id, image_data, caption, sort_order)
            VALUES (?, ?, ?, ?)`, [pid, dataUri, caption && caption.trim() || null, order]
        );

        res.status(201).json({
            id: result.insertId,
            project_id: pid,
            caption: caption && caption.trim() || null,
            sort_order: order,
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PATCH update caption only (lightweight — no re-upload needed) ────────────
router.patch('/caption/:id', async(req, res) => {
    try {
        const { caption } = req.body;
        await db.query(
            'UPDATE quotation_poc_images SET caption = ? WHERE id = ?', [caption && caption.trim() || null, req.params.id]);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT reorder — accepts array of { id, sort_order } ───────────────────────
// Efficient: single multi-row UPDATE using CASE WHEN
router.put('/reorder/:projectId', async(req, res) => {
    try {
        const { order } = req.body; // [{ id, sort_order }, ...]
        if (!Array.isArray(order) || order.length === 0) {
            return res.status(400).json({ error: 'order array required' });
        }

        // Build: UPDATE ... SET sort_order = CASE id WHEN 1 THEN 0 WHEN 2 THEN 1 ... END WHERE id IN (...)
        const cases = order.map(() => 'WHEN ? THEN ?').join(' ');
        const vals = order.flatMap(o => [o.id, o.sort_order]);
        const ids = order.map(o => o.id);
        const inList = ids.map(() => '?').join(',');

        await db.query(
            `UPDATE quotation_poc_images
             SET sort_order = CASE id ${cases} END
             WHERE id IN (${inList}) AND project_id = ?`, [...vals, ...ids, req.params.projectId]
        );
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE single image ──────────────────────────────────────────────────────
router.delete('/:id', async(req, res) => {
    try {
        await db.query('DELETE FROM quotation_poc_images WHERE id = ?', [req.params.id]);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;