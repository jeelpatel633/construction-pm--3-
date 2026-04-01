const router = require('express').Router();
const db = require('../config/db');
const fs = require('fs');
const path = require('path');
const cloudinary = require('../config/cloudinary');

// ── Create table on startup ──────────────────────────────────────────────
db.query(`
  CREATE TABLE IF NOT EXISTS pdf_downloads (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    project_id   INT NOT NULL,
    client_name  VARCHAR(255),
    project_name VARCHAR(255),
    pdf_type     VARCHAR(20) NOT NULL,
    file_path    VARCHAR(500),
    downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_project (project_id)
  )
`).catch(console.error);

// GET logs for a project — optionally filter by pdf_type
router.get('/:projectId', async(req, res) => {
    try {
        const { type } = req.query; // ?type=invoice or ?type=quotation
        let sql = 'SELECT * FROM pdf_downloads WHERE project_id=?';
        const args = [req.params.projectId];
        if (type) {
            sql += ' AND pdf_type=?';
            args.push(type);
        }
        sql += ' ORDER BY downloaded_at DESC LIMIT 50';
        const [rows] = await db.query(sql, args);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ✅ GET log with client phone for WhatsApp
router.get('/whatsapp/:id', async(req, res) => {
    try {
        // ✅ Retry up to 5 times waiting for Cloudinary upload to complete
        let log = null;
        for (let attempt = 0; attempt < 5; attempt++) {
            const [
                [row]
            ] = await db.query(`
                SELECT d.*, c.phone
                FROM pdf_downloads d
                JOIN projects p ON p.id = d.project_id
                JOIN clients c ON c.id = p.client_id
                WHERE d.id = ?
            `, [req.params.id]);
            const hasCloudinaryUrl = row && row.file_path && row.file_path.startsWith('http');
            if (attempt === 0) log = row; // always save first result as fallback
            if (hasCloudinaryUrl) {
                log = row;
                break; // ✅ Got Cloudinary URL — stop immediately
            }
            // ✅ Only retry if file_path is genuinely still pending (null)
            // If it's empty string, Cloudinary upload failed — don't waste time retrying
            if (!row || row.file_path !== null) break;
            await new Promise(r => setTimeout(r, 1000));
        }

        if (!log) return res.status(404).json({ error: 'Log not found' });

        // ✅ Build correct PDF URL
        const baseUrl = (process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`).replace('http://', 'https://');
        const pdfUrl = (log.file_path && log.file_path.startsWith('http')) ?
            log.file_path :
            log.pdf_type === 'quotation' ?
            `${baseUrl}/api/quotation-pdf/${log.project_id}?preview=1` :
            `${baseUrl}/api/pdf/${log.project_id}?preview=1`;

        res.json({...log, resolved_pdf_url: pdfUrl });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ✅ Serve a saved PDF file inline by log ID
router.get('/view/:id', async(req, res) => {
    try {
        const [
            [log]
        ] = await db.query('SELECT * FROM pdf_downloads WHERE id=?', [req.params.id]);
        if (!log) return res.status(404).json({ error: 'Log not found' });

        // ✅ Has Cloudinary URL — fetch and serve inline
        if (log.file_path && log.file_path.startsWith('http')) {
            const fetch = (await
                import ('node-fetch')).default;
            const response = await fetch(log.file_path);
            if (!response.ok) {
                // Cloudinary fetch failed — fall through to regenerate
                console.error('Cloudinary fetch failed:', log.file_path);
            } else {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', 'inline');
                return response.body.pipe(res);
            }
        }

        // ✅ Legacy local file
        if (log.file_path && fs.existsSync(log.file_path)) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline');
            return fs.createReadStream(log.file_path).pipe(res);
        }

        // ✅ No file_path or fetch failed — regenerate using absolute backend URL
        const baseUrl = (process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`).replace('http://', 'https://');
        const previewUrl = log.pdf_type === 'quotation' ?
            `${baseUrl}/api/quotation-pdf/${log.project_id}?preview=1` :
            `${baseUrl}/api/pdf/${log.project_id}?preview=1`;
        return res.redirect(previewUrl);

    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST — log a download (file_path saved by pdf/quotationPdf routes directly)
router.post('/', async(req, res) => {
    try {
        const { project_id, client_name, project_name, pdf_type, file_path, total_amount } = req.body;
        const [r] = await db.query(
            'INSERT INTO pdf_downloads (project_id, client_name, project_name, pdf_type, file_path, total_amount) VALUES (?,?,?,?,?,?)', [project_id, client_name || '', project_name || '', pdf_type || 'invoice', file_path || null, total_amount || null]
        );
        const [
            [row]
        ] = await db.query('SELECT * FROM pdf_downloads WHERE id=?', [r.insertId]);
        res.status(201).json(row);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;