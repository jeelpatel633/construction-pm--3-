const router = require('express').Router();
const db = require('../config/db');
const cloudinary = require('../config/cloudinary');
const PdfPrinter = require('pdfmake/src/printer');


const vfs = require('pdfmake/build/vfs_fonts');
const fonts = {
    Roboto: {
        normal: Buffer.from(vfs['Roboto-Regular.ttf'], 'base64'),
        bold: Buffer.from(vfs['Roboto-Medium.ttf'], 'base64'),
        italics: Buffer.from(vfs['Roboto-Italic.ttf'], 'base64'),
        bolditalics: Buffer.from(vfs['Roboto-MediumItalic.ttf'], 'base64'),
    }
};
const printer = new PdfPrinter(fonts);

async function uploadToCloudinary(buffer, filename) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({ resource_type: 'image', folder: 'navyakar/invoices', public_id: filename, format: 'pdf', access_mode: 'public', type: 'upload' },
            (error, result) => {
                if (error) reject(error);
                else resolve(result.secure_url);
            }
        );
        stream.end(buffer);
    });
}

const INR = n => 'Rs. ' + parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
const N = n => parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
const N3 = n => parseFloat(n || 0) === 0 ? '—' : parseFloat(n).toFixed(2);
const fDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const f = n => parseFloat(n || 0);

const DARK = '#1E293B';
const ORANGE = '#F97316';
const LIGHT = '#F8FAFC';
const BORDER = '#E2E8F0';
const SUCCESS = '#16A34A';
const DANGER = '#DC2626';
const GRAY = '#64748B';
const WHITE = '#FFFFFF';
const BLUE = '#2563EB';
const BLUEBG = '#EFF6FF';

const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function numToWords(n) {
    n = Math.floor(Math.abs(n));
    if (n === 0) return 'Zero';
    let s = '';
    if (n >= 10000000) {
        s += numToWords(Math.floor(n / 10000000)) + ' Crore ';
        n %= 10000000;
    }
    if (n >= 100000) {
        s += numToWords(Math.floor(n / 100000)) + ' Lakh ';
        n %= 100000;
    }
    if (n >= 1000) {
        s += numToWords(Math.floor(n / 1000)) + ' Thousand ';
        n %= 1000;
    }
    if (n >= 100) {
        s += ones[Math.floor(n / 100)] + ' Hundred ';
        n %= 100;
    }
    if (n >= 20) {
        s += tens[Math.floor(n / 10)] + ' ';
        n %= 10;
    }
    if (n > 0) { s += ones[n] + ' '; }
    return s.trim();
}

function amountInWords(amount) {
    const n = parseFloat(amount) || 0;
    const r = Math.floor(n),
        p = Math.round((n - r) * 100);
    let w = numToWords(r) + ' Rupees';
    if (p > 0) w += ' and ' + numToWords(p) + ' Paise';
    return w + ' Only';
}

const cell = (text, opts = {}) => ({
    text: (text !== null && text !== undefined) ? String(text) : '—',
    fontSize: opts.size || 7.5,
    bold: opts.bold || false,
    color: opts.color || DARK,
    alignment: opts.align || 'left',
    margin: opts.margin || [3, 4, 3, 4],
    noWrap: opts.noWrap || false,
});
const hCell = (text, align = 'left') => ({
    text,
    fontSize: 7.5,
    bold: true,
    color: WHITE,
    alignment: align,
    margin: [3, 5, 3, 5],
    fillColor: DARK,
});
const sectionHead = title => ({
    stack: [{
        table: {
            widths: ['*'],
            body: [
                [{ text: title, fontSize: 10, bold: true, color: WHITE, fillColor: DARK, margin: [10, 7, 10, 7], border: [false, false, false, false] }]
            ]
        },
        layout: 'noBorders'
    }],
    headlineLevel: 1,
    margin: [0, 14, 0, 0],
});

function buildWorkTable(items) {
    if (!items || !items.length) return { text: 'No records found.', italics: true, fontSize: 9, color: GRAY, margin: [0, 6, 0, 6] };

    const hasLBH = items.some(r => f(r.l_ft) > 0 || f(r.b_ft) > 0 || f(r.h_ft) > 0);
    const hasAddCost = items.some(r => f(r.additional_cost) > 0);
    const hasTax = items.some(r => f(r.tax_percent) > 0);
    const hasUnit = items.some(r => r.unit && r.unit.trim() !== '');

    const tableLayout = {
        fillColor: (ri, _, ci) => {
            if (ri === 0) return null;
            const lv = items[ri - 1] ? f(items[ri - 1].lbh_result) : 0;
            return (hasLBH && lv > 0 && ci === (hasUnit ? 7 : 6)) ? BLUEBG : (ri % 2 === 0 ? LIGHT : '#FFFFFF');
        },
        hLineColor: () => BORDER,
        vLineColor: () => BORDER,
        hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 0.5 : 0.3,
        vLineWidth: () => 0.3,
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingTop: () => 0,
        paddingBottom: () => 0,
    };

    if (hasLBH) {
        const headers = [
            hCell('#', 'center'),
            hCell('ITEM', 'left'),
            ...(hasUnit ? [hCell('UNIT', 'center')] : []),
            hCell('L(ft)', 'center'), hCell('B(ft)', 'center'), hCell('H(ft)', 'center'),
            hCell('AREA/VOL', 'right'), hCell('QTY', 'right'), hCell('RATE', 'right'),
            ...(hasAddCost ? [hCell('ADD.COST', 'right')] : []),
            ...(hasTax ? [hCell('TAX', 'center')] : []),
            hCell('TOTAL', 'right'),
            hCell('NOTES', 'left'),
        ];

        const rows = items.map((r, i) => {
            const lv = f(r.lbh_result);
            const ns = r.notes && r.notes.split(/\s+/).length > 15 ?
                r.notes.split(/\s+/).slice(0, 15).join(' ') + '...' :
                (r.notes || '—');
            return [
                cell(i + 1, { align: 'center', color: GRAY }),
                cell(r.item_name, { bold: true }),
                ...(hasUnit ? [cell(r.unit || '—', { align: 'center', color: GRAY })] : []),
                { text: N3(r.l_ft), fontSize: 7.5, color: lv > 0 ? BLUE : GRAY, alignment: 'center', margin: [3, 4, 3, 4] },
                { text: N3(r.b_ft), fontSize: 7.5, color: lv > 0 ? BLUE : GRAY, alignment: 'center', margin: [3, 4, 3, 4] },
                { text: N3(r.h_ft), fontSize: 7.5, color: lv > 0 ? BLUE : GRAY, alignment: 'center', margin: [3, 4, 3, 4] },
                { text: lv > 0 ? lv.toFixed(2) : '—', fontSize: 7.5, bold: lv > 0, color: lv > 0 ? BLUE : GRAY, alignment: 'right', fillColor: lv > 0 ? BLUEBG : null, margin: [3, 4, 3, 4], noWrap: true },
                cell(N(r.quantity), { align: 'right', noWrap: true }),
                cell(N(r.rate), { align: 'right', noWrap: true }),
                ...(hasAddCost ? [cell(INR(r.additional_cost), { align: 'right', noWrap: true })] : []),
                ...(hasTax ? [cell(`${f(r.tax_percent)}%`, { align: 'center' })] : []),
                cell(INR(r.grand_total), { align: 'right', bold: true, noWrap: true }),
                cell(ns, { color: GRAY }),
            ];
        });

        const total = items.reduce((s, r) => s + f(r.grand_total), 0);

        // Dynamically count columns for totalRow colSpan
        // Fixed cols: #(1) + ITEM(1) + L(1)+B(1)+H(1)+AREA(1)+QTY(1)+RATE(1) + TOTAL(1) + NOTES(1) = 10
        // + optional: UNIT, ADD.COST, TAX
        const fixedCols = 10; // # + ITEM + L + B + H + AREA + QTY + RATE + TOTAL + NOTES
        const optCols = (hasUnit ? 1 : 0) + (hasAddCost ? 1 : 0) + (hasTax ? 1 : 0);
        const totalCols = fixedCols + optCols;
        const spanUpTo = totalCols - 2; // all except TOTAL and NOTES

        const totalRow = [
            { text: '', border: [false, false, false, false], colSpan: spanUpTo, fillColor: LIGHT },
            ...Array(spanUpTo - 1).fill({}),
            { text: INR(total), fontSize: 8, bold: true, color: ORANGE, alignment: 'right', fillColor: DARK, margin: [3, 5, 3, 5], border: [false, false, false, false], noWrap: true },
            { text: '', border: [false, false, false, false], fillColor: LIGHT },
        ];

        // Build widths dynamically
        // Base LBH widths (no unit, no addcost, no tax):
        // # ITEM L B H AREA QTY RATE TOTAL NOTES
        // 14  *  26 26 26  36   24   38   56    46
        let widths = [14, '*'];
        if (hasUnit) widths.push(24);
        widths.push(26, 26, 26, 36, 24, 38);
        if (hasAddCost) widths.push(38);
        if (hasTax) widths.push(22);
        widths.push(56, 46);

        return {
            table: { headerRows: 1, dontBreakRows: false, keepWithHeaderRows: 1, widths, body: [headers, ...rows, totalRow] },
            layout: tableLayout,
            margin: [0, 4, 0, 4]
        };
    }

    // ── Standard (non-LBH) table ────────────────────────────────────────
    const headers = [
        hCell('#', 'center'),
        hCell('ITEM / WORK', 'left'),
        ...(hasUnit ? [hCell('UNIT', 'center')] : []),
        hCell('QTY', 'right'),
        hCell('RATE (Rs.)', 'right'),
        hCell('SUBTOTAL', 'right'),
        ...(hasAddCost ? [hCell('ADD. COST', 'right')] : []),
        ...(hasTax ? [hCell('TAX %', 'center')] : []),
        hCell('GRAND TOTAL', 'right'),
        hCell('NOTES', 'left'),
    ];

    const rows = items.map((r, i) => {
        const sub = f(r.quantity) * f(r.rate);
        const ns = r.notes && r.notes.split(/\s+/).length > 15 ?
            r.notes.split(/\s+/).slice(0, 15).join(' ') + '...' :
            (r.notes || '—');
        return [
            cell(i + 1, { align: 'center', color: GRAY }),
            cell(r.item_name, { bold: true }),
            ...(hasUnit ? [cell(r.unit || '—', { align: 'center', color: GRAY })] : []),
            cell(N(r.quantity), { align: 'right', noWrap: true }),
            cell(N(r.rate), { align: 'right', noWrap: true }),
            cell(INR(sub), { align: 'right', noWrap: true }),
            ...(hasAddCost ? [cell(INR(r.additional_cost), { align: 'right', noWrap: true })] : []),
            ...(hasTax ? [cell(`${f(r.tax_percent)}%`, { align: 'center' })] : []),
            cell(INR(r.grand_total), { align: 'right', bold: true, noWrap: true }),
            cell(ns, { color: GRAY }),
        ];
    });

    const total = items.reduce((s, r) => s + f(r.grand_total), 0);

    // Fixed cols: # + ITEM + QTY + RATE + SUBTOTAL + GRAND TOTAL + NOTES = 7
    const fixedCols = 7;
    const optCols = (hasUnit ? 1 : 0) + (hasAddCost ? 1 : 0) + (hasTax ? 1 : 0);
    const totalCols = fixedCols + optCols;
    const spanUpTo = totalCols - 2; // all except GRAND TOTAL and NOTES

    const totalRow = [
        { text: '', border: [false, false, false, false], colSpan: spanUpTo, fillColor: LIGHT },
        ...Array(spanUpTo - 1).fill({}),
        { text: INR(total), fontSize: 8, bold: true, color: ORANGE, alignment: 'right', fillColor: DARK, margin: [3, 5, 3, 5], border: [false, false, false, false], noWrap: true },
        { text: '', border: [false, false, false, false], fillColor: LIGHT },
    ];

    // Build widths dynamically
    // Base: # ITEM QTY RATE SUBTOTAL GRAND_TOTAL NOTES
    //       16  *   38   56    64        68         56
    let widths = [16, '*'];
    if (hasUnit) widths.push(30);
    widths.push(38, 56, 64);
    if (hasAddCost) widths.push(48);
    if (hasTax) widths.push(28);
    widths.push(68, 52);

    return {
        table: { headerRows: 1, dontBreakRows: false, keepWithHeaderRows: 1, widths, body: [headers, ...rows, totalRow] },
        layout: {
            fillColor: ri => ri === 0 ? null : (ri % 2 === 0 ? LIGHT : '#FFFFFF'),
            hLineColor: () => BORDER,
            vLineColor: () => BORDER,
            hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 0.5 : 0.3,
            vLineWidth: () => 0.3,
            paddingLeft: () => 0,
            paddingRight: () => 0,
            paddingTop: () => 0,
            paddingBottom: () => 0,
        },
        margin: [0, 4, 0, 4]
    };
}

function buildItemNotes(items, label) {
    const w = items.filter(r => r.notes && r.notes.trim() && r.notes.trim().split(/\s+/).length > 15);
    if (!w.length) return null;
    return { stack: [{ text: `${label} — Full Item Notes`, fontSize: 8, bold: true, color: GRAY, margin: [0, 6, 0, 4] }, { ul: w.map(r => ({ text: [{ text: `${r.item_name}: `, bold: true, color: DARK }, { text: r.notes.trim(), color: GRAY }], fontSize: 8, margin: [0, 2, 0, 2] })) }], margin: [0, 0, 0, 8] };
}

function buildPaymentsTable(payments) {
    if (!payments || !payments.length) return { text: 'No payments recorded.', italics: true, fontSize: 9, color: GRAY, margin: [0, 6, 0, 6] };
    const headers = [hCell('#', 'center'), hCell('DATE'), hCell('AMOUNT', 'right'), hCell('METHOD', 'center'), hCell('REFERENCE'), hCell('NOTES')];
    const rows = payments.map((r, i) => [cell(i + 1, { align: 'center', color: GRAY }), cell(fDate(r.payment_date)), cell(INR(r.amount), { align: 'right', bold: true, color: SUCCESS, noWrap: true }), cell((r.payment_method || '').replace('_', ' ').toUpperCase(), { align: 'center' }), cell(r.reference || '—', { color: GRAY }), cell(r.notes || '—', { color: GRAY })]);
    const total = payments.reduce((s, r) => s + f(r.amount), 0);
    const totalRow = [{ text: '', border: [false, false, false, false], colSpan: 2, fillColor: LIGHT }, {}, { text: INR(total), fontSize: 8, bold: true, color: SUCCESS, alignment: 'right', fillColor: DARK, margin: [3, 5, 3, 5], border: [false, false, false, false], noWrap: true }, { text: '', border: [false, false, false, false], fillColor: LIGHT, colSpan: 3 }, {}, {}];
    return { table: { headerRows: 1, widths: [16, 60, 78, 62, 96, '*'], body: [headers, ...rows, totalRow] }, layout: { fillColor: ri => ri === 0 ? null : (ri % 2 === 0 ? LIGHT : '#FFFFFF'), hLineColor: () => BORDER, vLineColor: () => BORDER, hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 0.5 : 0.3, vLineWidth: () => 0.3, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 }, margin: [0, 4, 0, 4] };
}

function buildFinancialSummary({ arch_total, cont_total, total_bill, total_paid, balance_due }) {
    const rows = [];
    if (arch_total > 0) rows.push([{ text: 'Actual Unit Invoice Total', bold: false, color: GRAY, fontSize: 9, margin: [10, 6, 10, 6], border: [false, false, false, true], borderColor: [null, null, null, BORDER] }, { text: INR(arch_total), bold: true, color: DARK, fontSize: 9, alignment: 'right', margin: [10, 6, 10, 6], border: [false, false, false, true], borderColor: [null, null, null, BORDER] }]);
    if (cont_total > 0) rows.push([{ text: `Fix Unit Invoice Total${arch_total>0?' (+)':''}`, bold: false, color: GRAY, fontSize: 9, margin: [10, 6, 10, 6], border: [false, false, false, true], borderColor: [null, null, null, BORDER] }, { text: INR(cont_total), bold: true, color: DARK, fontSize: 9, alignment: 'right', margin: [10, 6, 10, 6], border: [false, false, false, true], borderColor: [null, null, null, BORDER] }]);
    rows.push([{ text: 'TOTAL BILL', bold: true, color: WHITE, fontSize: 10, fillColor: DARK, margin: [10, 8, 10, 8], border: [false, false, false, false] }, { text: INR(total_bill), bold: true, color: ORANGE, fontSize: 11, alignment: 'right', fillColor: DARK, margin: [10, 8, 10, 8], border: [false, false, false, false] }]);
    rows.push([{ text: 'Advance / Payments Received (−)', bold: false, color: GRAY, fontSize: 9, margin: [10, 6, 10, 6], border: [false, false, false, true], borderColor: [null, null, null, BORDER] }, { text: INR(total_paid), bold: true, color: SUCCESS, fontSize: 9, alignment: 'right', margin: [10, 6, 10, 6], border: [false, false, false, true], borderColor: [null, null, null, BORDER] }]);
    const balColor = balance_due > 0 ? DANGER : SUCCESS;
    rows.push([{ stack: [{ text: balance_due > 0 ? 'BALANCE DUE (Client Has to Pay)' : '✓ FULLY PAID', bold: true, color: WHITE, fontSize: 10 }, ...(balance_due > 0 ? [{ text: amountInWords(balance_due), fontSize: 7.5, color: 'rgba(255,255,255,0.75)', italics: true, margin: [0, 3, 0, 0] }] : [])], fillColor: balColor, margin: [10, 8, 10, 8], border: [false, false, false, false] }, { text: INR(Math.abs(balance_due)), bold: true, color: WHITE, fontSize: 12, alignment: 'right', fillColor: balColor, margin: [10, 8, 10, 8], border: [false, false, false, false], noWrap: true }]);
    return { table: { widths: ['*', 165], body: rows }, layout: 'noBorders', margin: [0, 6, 0, 6] };
}

// ── MAIN ROUTE ──────────────────────────────────────────────────────────────
router.get('/:projectId', async(req, res) => {
    try {
        const pid = req.params.projectId;
        const logId = req.query.logId || null;

        // ✅ OPTIMIZATION 1: Run ALL DB queries in parallel — saves 300-500ms
        const [
            [
                [project]
            ],
            [archItems],
            [contItems],
            [payments],
            [statements],
        ] = await Promise.all([
            db.query(`SELECT p.*, c.client_name, c.phone, c.email, c.address AS client_address FROM projects p JOIN clients c ON c.id=p.client_id WHERE p.id=?`, [pid]),
            db.query('SELECT * FROM architect_work  WHERE project_id=? ORDER BY id', [pid]),
            db.query('SELECT * FROM contractor_work WHERE project_id=? ORDER BY id', [pid]),
            db.query('SELECT * FROM client_payments WHERE project_id=? ORDER BY payment_date', [pid]),
            db.query('SELECT * FROM invoice_statements WHERE project_id=? ORDER BY sort_order,id', [pid]),
        ]);

        if (!project) return res.status(404).json({ error: 'Not found' });

        const arch_total = archItems.reduce((s, r) => s + f(r.grand_total), 0);
        const cont_total = contItems.reduce((s, r) => s + f(r.grand_total), 0);
        const total_bill = arch_total + cont_total;
        const total_paid = payments.reduce((s, r) => s + f(r.amount), 0);
        const balance_due = total_bill - total_paid;

        const archNotes = buildItemNotes(archItems, 'Actual Unit Invoice');
        const contNotes = buildItemNotes(contItems, 'Fix Unit Invoice');

        const sigClient = (project.sig_client && project.sig_client.trim()) ? project.sig_client.trim() : null;
        const sigCont = (project.sig_contractor && project.sig_contractor.trim()) ? project.sig_contractor.trim() : null;
        const sigContRaw = project.sig_contractor_img || null;

        // ✅ OPTIMIZATION 2: Image already JPEG from frontend compression — use directly
        const sigContImg = sigContRaw ?
            (sigContRaw.startsWith('data:') ? sigContRaw : 'data:image/jpeg;base64,' + sigContRaw) :
            null;

        const hasInvoiceNotes = project.invoice_notes && project.invoice_notes.trim() !== '';
        const invNum = project.invoice_number || `INV-${pid}`;
        const invDate = project.invoice_date ? fDate(project.invoice_date) : fDate(new Date().toISOString().slice(0, 10));

        const docDef = {
            pageSize: 'A4',
            pageMargins: [36, 65, 36, 95],

            header: (currentPage, pageCount) => ({
                table: {
                    widths: ['*', 'auto'],
                    body: [
                        [
                            { stack: [{ text: 'NAVYAKAR', fontSize: 13, bold: true, color: WHITE }, { text: `${project.client_name}  ›  ${project.project_name}`, fontSize: 7, color: '#94A3B8', margin: [0, 2, 0, 0] }], fillColor: DARK, border: [false, false, false, false], margin: [14, 9, 10, 9] },
                            { stack: [{ text: invNum, fontSize: 8, bold: true, color: ORANGE, alignment: 'right' }, { text: invDate, fontSize: 7, color: '#94A3B8', alignment: 'right', margin: [0, 2, 0, 0] }, { text: `Page ${currentPage} of ${pageCount}`, fontSize: 6.5, color: '#94A3B8', alignment: 'right', margin: [0, 2, 0, 0] }], fillColor: DARK, border: [false, false, false, false], margin: [10, 9, 14, 9] },
                        ]
                    ]
                },
                layout: 'noBorders',
            }),

            pageBreakBefore: (node, following) => node.headlineLevel === 1 && following.length <= 4,

            content: [
                // CLIENT + PROJECT INFO
                {
                    columns: [{
                            width: '48%',
                            table: {
                                widths: ['*'],
                                body: [
                                    [{ text: 'CLIENT INFORMATION', fontSize: 7.5, bold: true, color: WHITE, fillColor: DARK, margin: [8, 5, 8, 5], border: [false, false, false, false] }],
                                    [{ stack: [{ text: project.client_name, fontSize: 10, bold: true, color: DARK, margin: [0, 0, 0, 3] }, ...(project.phone ? [{ text: `📞  ${project.phone}`, fontSize: 8, color: GRAY }] : []), ...(project.email ? [{ text: `✉  ${project.email}`, fontSize: 8, color: GRAY, margin: [0, 2, 0, 0] }] : []), ...(project.client_address ? [{ text: `📍  ${project.client_address}`, fontSize: 8, color: GRAY, margin: [0, 2, 0, 0] }] : [])], margin: [8, 7, 8, 7], border: [false, false, false, false] }],
                                ]
                            },
                            layout: { hLineColor: () => BORDER, vLineColor: () => BORDER, hLineWidth: () => 0.5, vLineWidth: () => 0.5 }
                        },
                        { width: '4%', text: '' },
                        {
                            width: '48%',
                            table: {
                                widths: ['*'],
                                body: [
                                    [{ text: 'PROJECT DETAILS', fontSize: 7.5, bold: true, color: WHITE, fillColor: DARK, margin: [8, 5, 8, 5], border: [false, false, false, false] }],
                                    [{ stack: [{ text: project.project_name, fontSize: 10, bold: true, color: DARK, margin: [0, 0, 0, 3] }, ...(project.location ? [{ text: `📍  ${project.location}`, fontSize: 8, color: GRAY }] : []), { text: `Start: ${fDate(project.start_date)}   End: ${fDate(project.end_date)}`, fontSize: 8, color: GRAY, margin: [0, 2, 0, 0] }, { text: `Status: ${(project.status||'').replace('_',' ').toUpperCase()}`, fontSize: 8, bold: true, color: ORANGE, margin: [0, 2, 0, 0] }], margin: [8, 7, 8, 7], border: [false, false, false, false] }],
                                ]
                            },
                            layout: { hLineColor: () => BORDER, vLineColor: () => BORDER, hLineWidth: () => 0.5, vLineWidth: () => 0.5 }
                        },
                    ],
                    columnGap: 0,
                    margin: [0, 0, 0, 10],
                },

                // FINANCIAL SNAPSHOT
                {
                    table: {
                        widths: ['*', '*', '*'],
                        body: [
                            [
                                { stack: [{ text: 'TOTAL BILL', fontSize: 6.5, color: '#94A3B8', bold: true, margin: [0, 0, 0, 3] }, { text: INR(total_bill), fontSize: 12, bold: true, color: ORANGE, noWrap: true }], fillColor: DARK, margin: [12, 9, 12, 9], border: [false, false, true, false], borderColor: [null, null, '#2D3748', null] },
                                { stack: [{ text: 'PAYMENTS RECEIVED', fontSize: 6.5, color: '#94A3B8', bold: true, margin: [0, 0, 0, 3] }, { text: INR(total_paid), fontSize: 12, bold: true, color: SUCCESS, noWrap: true }], fillColor: DARK, margin: [12, 9, 12, 9], border: [false, false, true, false], borderColor: [null, null, '#2D3748', null] },
                                { stack: [{ text: balance_due > 0 ? 'BALANCE DUE' : 'STATUS', fontSize: 6.5, color: '#94A3B8', bold: true, margin: [0, 0, 0, 3] }, { text: balance_due > 0 ? INR(balance_due) : '✓ PAID', fontSize: 12, bold: true, color: balance_due > 0 ? DANGER : SUCCESS, noWrap: true }], fillColor: DARK, margin: [12, 9, 12, 9], border: [false, false, false, false] },
                            ]
                        ]
                    },
                    layout: 'noBorders',
                    margin: [0, 0, 0, 12],
                },

                ...(archItems.length > 0 ? [sectionHead('ACTUAL UNIT INVOICE'), buildWorkTable(archItems), ...(archNotes ? [archNotes] : [])] : []),
                ...(contItems.length > 0 ? [sectionHead('FIX UNIT INVOICE'), buildWorkTable(contItems), ...(contNotes ? [contNotes] : [])] : []),

                sectionHead('PAYMENT HISTORY  (Advance & Instalments)'),
                buildPaymentsTable(payments),
                sectionHead('FINANCIAL CALCULATION'),
                buildFinancialSummary({ arch_total, cont_total, total_bill, total_paid, balance_due }),

                ...(statements.length > 0 ? [sectionHead('TERMS & STATEMENTS'), { ul: statements.map(s => ({ text: s.statement, fontSize: 9, color: DARK, margin: [0, 3, 0, 3] })), margin: [0, 6, 0, 6] }] : []),
                ...(hasInvoiceNotes ? [sectionHead('ADDITIONAL NOTES'), { text: project.invoice_notes.trim(), fontSize: 9, color: GRAY, margin: [0, 6, 0, 6], lineHeight: 1.5 }] : []),

                // SIGNATURES
                ...(sigClient || sigCont || sigContImg ? [
                    { text: '', margin: [0, 18, 0, 0] },
                    {
                        columns: [
                            sigClient ? {
                                width: '45%',
                                stack: [
                                    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 1, lineColor: DARK }] },
                                    { text: sigClient, fontSize: 9, color: GRAY, margin: [0, 4, 0, 0] },
                                    { text: 'CLIENT', fontSize: 7, bold: true, color: ORANGE, margin: [0, 2, 0, 0] },
                                ]
                            } : { width: '45%', text: '' },
                            { width: '10%', text: '' },
                            (sigCont || sigContImg) ? {
                                width: '45%',
                                stack: [
                                    // ✅ OPTIMIZATION 3: Use JPEG data directly — no wrapper table needed
                                    ...(sigContImg ? [{ image: sigContImg, width: 180, height: 70, fit: [180, 70], margin: [0, 0, 0, 8] }] : []),
                                    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 1, lineColor: DARK }] },
                                    ...(sigCont ? [{ text: sigCont, fontSize: 9, color: GRAY, margin: [0, 4, 0, 0] }] : []),
                                    { text: 'AUTHORIZED SIGNATORY', fontSize: 7, bold: true, color: ORANGE, margin: [0, 2, 0, 0] },
                                ]
                            } : { width: '45%', text: '' },
                        ],
                        margin: [0, 0, 0, 0]
                    },
                ] : []),

            ],

            footer: (currentPage, pageCount) => {
                const strip = {
                    margin: [0, 0, 0, 0],
                    table: {
                        widths: ['*', 'auto'],
                        body: [
                            [
                                { text: `${invNum}  ·  ${fDate(new Date())}`, fontSize: 6.5, color: GRAY, margin: [36, 6, 10, 6], border: [false, false, false, false] },
                                { text: `Page ${currentPage} of ${pageCount}`, fontSize: 6.5, bold: true, color: ORANGE, alignment: 'right', margin: [10, 6, 36, 6], border: [false, false, false, false] },
                            ]
                        ]
                    },
                    layout: 'noBorders',
                };
                if (currentPage !== pageCount) return strip;
                return {
                    stack: [
                        strip,
                        { canvas: [{ type: 'rect', x: 0, y: 0, w: 595, h: 3, color: ORANGE }], margin: [0, 6, 0, 0] },
                        {
                            margin: [0, 0, 0, 0],
                            table: {
                                widths: ['*'],
                                body: [
                                    [{
                                        border: [false, false, false, false],
                                        fillColor: DARK,
                                        margin: [0, 0, 0, 0],
                                        columns: [{
                                                width: 155,
                                                stack: [
                                                    { text: 'NAVYAKAR', fontSize: 15, bold: true, color: ORANGE, characterSpacing: 3, margin: [36, 13, 0, 3] },
                                                    { text: 'Building Dreams, Crafting Reality', fontSize: 6.5, color: '#94A3B8', italics: true, margin: [36, 0, 0, 13] },
                                                ]
                                            },
                                            { width: 1, canvas: [{ type: 'rect', x: 0, y: 8, w: 1, h: 38, color: '#2D3748' }] },
                                            {
                                                width: '*',
                                                margin: [18, 11, 18, 11],
                                                stack: [
                                                    { text: 'CONTACT US', fontSize: 6, bold: true, color: ORANGE, characterSpacing: 1.5, margin: [0, 0, 0, 5] },
                                                    {
                                                        columns: [{
                                                                width: '*',
                                                                stack: [
                                                                    { text: [{ text: 'Loc  ', fontSize: 6.5, bold: true, color: ORANGE }, { text: 'Ahmedabad, Gujarat', fontSize: 7, color: WHITE }], margin: [0, 0, 0, 3] },
                                                                    { text: [{ text: 'Tel  ', fontSize: 6.5, bold: true, color: ORANGE }, { text: '+91 99242 81746', fontSize: 7, color: WHITE }] },
                                                                ]
                                                            },
                                                            {
                                                                width: '*',
                                                                stack: [
                                                                    { text: [{ text: 'Mail  ', fontSize: 6.5, bold: true, color: ORANGE }, { text: 'dhaval@navyakar.com', fontSize: 7, color: WHITE }], margin: [0, 0, 0, 3] },
                                                                    { text: [{ text: 'Web  ', fontSize: 6.5, bold: true, color: ORANGE }, { text: 'www.navyakar.com', fontSize: 7, color: WHITE }] },
                                                                ]
                                                            },
                                                        ]
                                                    },
                                                ]
                                            },
                                            { width: 1, canvas: [{ type: 'rect', x: 0, y: 8, w: 1, h: 38, color: '#2D3748' }] },
                                            {
                                                width: 110,
                                                margin: [18, 11, 36, 11],
                                                stack: [
                                                    { text: 'FOLLOW US', fontSize: 6, bold: true, color: ORANGE, characterSpacing: 1.5, margin: [0, 0, 0, 5] },
                                                    { text: [{ text: 'IG  ', fontSize: 6.5, bold: true, color: ORANGE }, { text: '@navyakar', fontSize: 7, color: WHITE, link: 'https://www.instagram.com/navyakar.studio/' }], margin: [0, 0, 0, 3] },
                                                    { text: [{ text: 'FB  ', fontSize: 6.5, bold: true, color: ORANGE }, { text: '@navyakar', fontSize: 7, color: WHITE, link: 'https://www.facebook.com/share/1Q6EnNxFqM/' }] },
                                                ]
                                            },
                                        ],
                                    }]
                                ]
                            },
                            layout: 'noBorders',
                        },
                    ],
                };
            },


            styles: { tableHeader: { bold: true, fontSize: 7.5, color: WHITE, fillColor: DARK } },
            defaultStyle: { font: 'Roboto', fontSize: 8.5, color: DARK, lineHeight: 1.3 },
        };

        const isPreview = req.query.preview === '1';
        const fname = `report_${project.project_name.replace(/[^a-zA-Z0-9]/g,'_')}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', isPreview ? 'inline' : `attachment; filename="${fname}"`);

        if (!isPreview) {
            const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const savedName = `${dateStr}_INV_${project.project_name.replace(/[^a-zA-Z0-9]/g,'_')}`;

            const pdfDoc = printer.createPdfKitDocument(docDef);
            const chunks = [];
            pdfDoc.on('data', c => chunks.push(c));
            pdfDoc.on('end', async() => {
                const buf = Buffer.concat(chunks);
                // ✅ Send to user immediately — no waiting
                res.setHeader('Content-Length', buf.length);
                res.end(buf);
                // ✅ Upload to Cloudinary in background
                uploadToCloudinary(buf, savedName)
                    .then(async url => {
                        console.log('✅ Cloudinary upload success:', url);
                        if (logId) {
                            await db.query("UPDATE pdf_downloads SET file_path=? WHERE id=?", [url, logId]);
                            console.log('✅ DB updated for logId:', logId);
                        } else {
                            await db.query(
                                "UPDATE pdf_downloads SET file_path=? WHERE project_id=? AND pdf_type='invoice' ORDER BY downloaded_at DESC LIMIT 1", [url, pid]
                            );
                            console.log('✅ DB updated for project:', pid);
                        }
                    })
                    .catch(e => console.error('❌ Cloudinary/DB error:', e.message, e.stack));
            });
            pdfDoc.on('error', err => { if (!res.headersSent) res.status(500).json({ error: err.message }); });
            pdfDoc.end();
        } else {
            const pdfDoc = printer.createPdfKitDocument(docDef);
            pdfDoc.pipe(res);
            pdfDoc.on('error', err => { if (!res.headersSent) res.status(500).json({ error: err.message }); });
            pdfDoc.end();
        }

    } catch (err) {
        console.error('PDF error:', err);
        if (!res.headersSent) res.status(500).json({ error: err.message });
    }
});

module.exports = router;