const router = require('express').Router();
const db = require('../config/db');
const fs = require('fs');
const path = require('path');

const PDF_SAVE_DIR = process.env.PDF_SAVE_DIR || 'C:\\NavyakarPDFs';

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
        if (type) { sql += ' AND pdf_type=?';
            args.push(type); }
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
        if (!log.file_path || !fs.existsSync(log.file_path))
            return res.status(404).json({ error: 'PDF file not found on disk. Re-download to regenerate.' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline');
        fs.createReadStream(log.file_path).pipe(res);
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