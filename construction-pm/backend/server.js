const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authMW = require('./middleware/auth');
const pdfAuthMW = require('./middleware/pdfAuth');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ── Public routes ─────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));

// ── pdfAuthMW routes — accept token from Bearer header OR ?token= query ──
// This covers: PDF generation, PDF view, and download-logs
// pdfAuthMW handles both so all routes stay fully protected
app.use('/api/pdf', pdfAuthMW, require('./routes/pdf'));
app.use('/api/quotation-pdf', pdfAuthMW, require('./routes/quotationPdf'));
app.use('/api/download-logs', pdfAuthMW, require('./routes/downloadLogs'));

// ── All other protected routes — authMW (header only) ────────────────────
app.use('/api', authMW);

app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/architect-work', require('./routes/architectWork'));
app.use('/api/contractor-work', require('./routes/contractorWork'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/statements', require('./routes/statements'));
app.use('/api/quotation', require('./routes/quotation'));
app.use('/api/cash-expenses', require('./routes/cashExpenses'));
app.use('/api/quotation-statements', require('./routes/quotationStatements'));
app.use('/api/quotation-poc', require('./routes/quotationPocImages'));
app.use('/api/cash-expenses', require('./routes/cashExpenses'));
app.use('/api/vendor-bills', require('./routes/vendorBills')); // ← ADD

app.get('/seed', async(req, res) => {
    if (req.query.secret !== process.env.SEED_SECRET) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    try {
        const bcrypt = require('bcryptjs');
        const db = require('./config/db');

        const adminHash = await bcrypt.hash('navyakar@2026', 10);
        await db.query(`INSERT IGNORE INTO users (username, password_hash, role, display_name) VALUES (?, ?, 'admin', 'Admin')`, ['admin', adminHash]);

        const dhavalHash = await bcrypt.hash('dhaval@2026', 10);
        await db.query(`INSERT IGNORE INTO users (username, password_hash, role, display_name) VALUES (?, ?, 'user', 'Dhaval Mevada')`, ['dhaval', dhavalHash]);

        const [
            [dhaval]
        ] = await db.query(`SELECT id FROM users WHERE username = 'dhaval'`);
        await db.query(`UPDATE clients SET user_id = ? WHERE user_id IS NULL`, [dhaval.id]);

        res.json({ success: true, message: '🎉 Seeded successfully!' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/health', (_req, res) => res.json({ ok: true })); // already exists
app.get('/', (_req, res) => res.json({ status: 'ConstructPro API v3' }));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`✅ API → http://localhost:${PORT}`);
    // ✅ Self-ping every 10 min — prevents Render free tier sleep
    setInterval(() => {
        fetch('https://navyakar-api.onrender.com/health')
            .then(() => console.log('🏓 keep-alive ok'))
            .catch(e => console.log('🏓 ping failed:', e.message));
    }, 10 * 60 * 1000); // 10 minutes
});