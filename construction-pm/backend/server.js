const express = require('express');
const cors = require('cors');
require('dotenv').config(); // ✅ only once

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/architect-work', require('./routes/architectWork'));
app.use('/api/contractor-work', require('./routes/contractorWork'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/statements', require('./routes/statements'));
app.use('/api/quotation', require('./routes/quotation'));
app.use('/api/pdf', require('./routes/pdf'));
app.use('/api/quotation-pdf', require('./routes/quotationPdf'));
app.use('/api/download-logs', require('./routes/downloadLogs'));
app.use('/api/cash-expenses', require('./routes/cashExpenses'));
app.use('/api/quotation-statements', require('./routes/quotationStatements'));

const quotationPoc = require('./routes/quotationPocImages');
app.use('/api/quotation-poc', quotationPoc);

// Health & root routes (VERY GOOD)
app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/', (_req, res) => res.json({ status: 'ConstructPro API v3' }));

// Server start
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ API → http://localhost:${PORT}`);
});
