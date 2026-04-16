const router = require('express').Router();
const db = require('../config/db');
const fs = require('fs');
const cloudinary = require('../config/cloudinary');

// ── Create table on startup ───────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// ✅ SPECIFIC routes BEFORE /:projectId — avoids Express swallowing /view & /whatsapp
// Auth is handled by pdfAuthMW at the server.js mount level — no need to repeat here
// ─────────────────────────────────────────────────────────────────────────────

// ✅ Serve a saved PDF inline by log ID
router.get('/view/:id', async(req, res) => {
    try {
        const [
            [log]
        ] = await db.query('SELECT * FROM pdf_downloads WHERE id=?', [req.params.id]);
        if (!log) return res.status(404).json({ error: 'Log not found' });

        console.log('📄 Serving PDF id:', req.params.id, '| file_path:', log.file_path);

        // ✅ Has Cloudinary URL — fetch and proxy inline
        if (log.file_path && log.file_path.startsWith('http')) {
            const axios = require('axios');
            const response = await axios.get(log.file_path, { responseType: 'arraybuffer' });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline');
            res.setHeader('Content-Length', response.data.length);
            return res.end(Buffer.from(response.data));
        }

        // ✅ Legacy local file
        if (log.file_path && fs.existsSync(log.file_path)) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline');
            return fs.createReadStream(log.file_path).pipe(res);
        }

        // ✅ No file — regenerate on the fly
        const baseUrl = (process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`).replace('http://', 'https://');
        const previewUrl = log.pdf_type === 'quotation' ?
            `${baseUrl}/api/quotation-pdf/${log.project_id}?preview=1` :
            `${baseUrl}/api/pdf/${log.project_id}?preview=1`;
        return res.redirect(previewUrl);

    } catch (e) {
        console.error('View PDF error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ✅ GET log with client phone for WhatsApp
router.get('/whatsapp/:id', async(req, res) => {
    try {
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
            if (attempt === 0) log = row;
            if (hasCloudinaryUrl) { log = row; break; }
            if (!row || row.file_path !== null) break;
            await new Promise(r => setTimeout(r, 1000));
        }

        if (!log) return res.status(404).json({ error: 'Log not found' });

        const baseUrl = (process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`).replace('http://', 'https://');
        const pdfUrl = (log.file_path && log.file_path.startsWith('http')) ?
            log.file_path :
            log.pdf_type === 'quotation' ?
            `${baseUrl}/api/quotation-pdf/${log.project_id}?preview=1` :
            `${baseUrl}/api/pdf/${log.project_id}?preview=1`;

        res.json({...log, resolved_pdf_url: pdfUrl });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// ✅ Generic /:projectId LAST — never swallows /view or /whatsapp
// ─────────────────────────────────────────────────────────────────────────────

// GET logs for a project
router.get('/:projectId', async(req, res) => {
    try {
        const { type } = req.query;
        let sql = 'SELECT * FROM pdf_downloads WHERE project_id=?';
        const args = [req.params.projectId];
        if (type) { sql += ' AND pdf_type=?';
            args.push(type); }
        sql += ' ORDER BY downloaded_at DESC LIMIT 50';
        const [rows] = await db.query(sql, args);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST — log a download
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