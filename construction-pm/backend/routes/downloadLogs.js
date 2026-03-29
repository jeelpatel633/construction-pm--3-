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

// ✅ Serve a saved PDF file inline by log ID
router.get('/view/:id', async(req, res) => {
    try {
        const [
            [log]
        ] = await db.query('SELECT * FROM pdf_downloads WHERE id=?', [req.params.id]);
        if (!log) return res.status(404).json({ error: 'Log not found' });

        // ✅ No file_path — redirect to live preview instead
        if (!log.file_path) {
            const previewRoute = log.pdf_type === 'quotation' ?
                `/api/quotation-pdf/${log.project_id}?preview=1` :
                `/api/pdf/${log.project_id}?preview=1`;
            return res.redirect(previewRoute);
        }

        // ✅ Cloudinary URL — fetch and serve inline
        if (log.file_path.startsWith('http')) {
            const fetch = (await
                import ('node-fetch')).default;
            const response = await fetch(log.file_path);
            if (!response.ok) return res.status(404).json({ error: 'Could not fetch PDF from Cloudinary.' });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline');
            return response.body.pipe(res);
        }

        // ✅ Legacy local file
        if (fs.existsSync(log.file_path)) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline');
            return fs.createReadStream(log.file_path).pipe(res);
        }

        return res.status(404).json({ error: 'PDF file not found. Re-download to regenerate.' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST — log a download (file_path saved by pdf/quotationPdf routes directly)
router.post('/', async(req, res) => {
    try {
        const { project_id, client_name, project_name, pdf_type, file_path } = req.body;
        const [r] = await db.query(
            'INSERT INTO pdf_downloads (project_id, client_name, project_name, pdf_type, file_path) VALUES (?,?,?,?,?)', [project_id, client_name || '', project_name || '', pdf_type || 'invoice', file_path || '']
        );
        const [
            [row]
        ] = await db.query('SELECT * FROM pdf_downloads WHERE id=?', [r.insertId]);
        res.status(201).json(row);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;