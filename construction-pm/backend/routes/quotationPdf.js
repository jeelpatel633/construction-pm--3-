const router = require('express').Router();
const db = require('../config/db');
const fs = require('fs');
const path = require('path');
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

const INR = n => 'Rs. ' + parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NUM = n => parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const N3 = n => parseFloat(n || 0) === 0 ? '—' : parseFloat(n).toFixed(2);
const fDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const f = n => parseFloat(n || 0);

const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function numToWords(n) {
    n = Math.floor(Math.abs(n));
    if (n === 0) return 'Zero';
    let s = '';
    if (n >= 10000000) { s += numToWords(Math.floor(n / 10000000)) + ' Crore ';
        n %= 10000000; }
    if (n >= 100000) { s += numToWords(Math.floor(n / 100000)) + ' Lakh ';
        n %= 100000; }
    if (n >= 1000) { s += numToWords(Math.floor(n / 1000)) + ' Thousand ';
        n %= 1000; }
    if (n >= 100) { s += ones[Math.floor(n / 100)] + ' Hundred ';
        n %= 100; }
    if (n >= 20) { s += tens[Math.floor(n / 10)] + ' ';
        n %= 10; }
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

const DARK = '#1E293B';
const ORANGE = '#F97316';
const LIGHT = '#F8FAFC';
const BORDER = '#CBD5E1';
const GRAY = '#64748B';
const WHITE = '#FFFFFF';
const BLUE = '#2563EB';
const BLUEBG = '#EFF6FF';
const STRIPE = '#F1F5F9';

const cell = (text, opts = {}) => ({
    text: (text !== null && text !== undefined && text !== '') ? String(text) : '—',
    fontSize: opts.size || 8,
    bold: opts.bold || false,
    color: opts.color || DARK,
    alignment: opts.align || 'left',
    margin: opts.margin || [5, 5, 5, 5],
    noWrap: opts.noWrap || false,
});
const hCell = (text, align = 'left') => ({
    text,
    fontSize: 7.5,
    bold: true,
    color: WHITE,
    alignment: align,
    margin: [5, 7, 5, 7],
    fillColor: DARK,
});

const PDF_SAVE_DIR = process.env.PDF_SAVE_DIR || 'C:\\NavyakarPDFs';

function ensureSaveDir() {
    try { if (!fs.existsSync(PDF_SAVE_DIR)) fs.mkdirSync(PDF_SAVE_DIR, { recursive: true }); } catch (e) {}
}

// ── Build "Project Vision & Concepts" PDF section ────────────────────────────
//
//  THE DEFINITIVE FIX for title/images appearing on different pages:
//
//  Previous attempts used keepWithNextN and flat arrays — pdfmake still split
//  them because those are hints, not guarantees.
//
//  The guaranteed solution: wrap the ENTIRE section (title bar + all image
//  rows) inside a single table row with dontBreakRows: true.
//
//  How pdfmake handles this:
//  - A table with dontBreakRows:true will NEVER split a row across pages.
//  - If the entire content (title + row 1 of images) doesn't fit on the
//    current page, pdfmake moves the WHOLE table to the next page.
//  - This means title and images are physically inseparable — guaranteed.
//
//  For large galleries (many images), we split into two tables:
//  - Table 1 (unbreakable): title bar + FIRST image row — this guarantees
//    the title is always with at least the first photos.
//  - Table 2+ (normal): remaining image rows can page-break freely.
//  This keeps memory reasonable for 10+ photos while still fixing the bug.
//
function buildPocSection(pocImages) {
    if (!pocImages || pocImages.length === 0) return [];

    const PAGE_W = 515; // usable (595 - 40 - 40)
    const GAP = 10; // gap between two side-by-side photos
    const IMG_W = Math.floor((PAGE_W - GAP) / 2); // 252
    const IMG_H = Math.floor(IMG_W * 3 / 4); // 189  (4:3)

    // ── Dark header bar — same style as Terms & Conditions ───────────────────
    const headerBar = {
        table: {
            widths: ['*'],
            body: [
                [{
                    text: 'PROJECT VISION & CONCEPTS',
                    fontSize: 9,
                    bold: true,
                    color: WHITE,
                    fillColor: DARK,
                    margin: [10, 7, 10, 7],
                    border: [false, false, false, false],
                    characterSpacing: 0.8,
                }]
            ]
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 10],
    };

    // ── Helper: one image cell (photo + optional caption) ────────────────────
    const makeImageCell = (img, colWidth) => {
        const dataUri = (img.image_data || '').startsWith('data:') ?
            img.image_data :
            'data:image/jpeg;base64,' + img.image_data;

        const stack = [{
            table: {
                widths: [colWidth - 2],
                body: [
                    [{
                        image: dataUri,
                        fit: [colWidth - 4, IMG_H],
                        alignment: 'center',
                        margin: [2, 2, 2, 2],
                        border: [true, true, true, true],
                        borderColor: [BORDER, BORDER, BORDER, BORDER],
                    }]
                ]
            },
            layout: {
                hLineColor: () => BORDER,
                vLineColor: () => BORDER,
                hLineWidth: () => 0.5,
                vLineWidth: () => 0.5,
            },
        }];

        const caption = (img.caption || '').trim();
        if (caption) {
            stack.push({
                text: caption,
                fontSize: 7.5,
                italics: true,
                color: GRAY,
                alignment: 'center',
                margin: [2, 5, 2, 0],
            });
        }

        return { stack, width: colWidth };
    };

    // ── Build a columns block for one pair of images ─────────────────────────
    const makeImageRow = (left, right, bottomMargin = 14) => {
        if (right) {
            return {
                columns: [
                    makeImageCell(left, IMG_W),
                    { width: GAP, text: '' },
                    makeImageCell(right, IMG_W),
                ],
                columnGap: 0,
                margin: [0, 0, 0, bottomMargin],
            };
        } else {
            // Odd last image — centred at 60%
            const centreW = Math.floor(PAGE_W * 0.6);
            return {
                columns: [
                    { width: '*', text: '' },
                    makeImageCell(left, centreW),
                    { width: '*', text: '' },
                ],
                columnGap: 0,
                margin: [0, 0, 0, bottomMargin],
            };
        }
    };

    // ── Chunk images into pairs ───────────────────────────────────────────────
    const pairs = [];
    for (let i = 0; i < pocImages.length; i += 2) {
        pairs.push({ left: pocImages[i], right: pocImages[i + 1] || null });
    }

    // ── THE KEY: wrap title + first image row in ONE unbreakable table ────────
    //
    //  A table with dontBreakRows:true cannot be split across pages.
    //  We put the header and the first image row inside a single table cell
    //  as a stack. If this combined block doesn't fit on the current page,
    //  pdfmake moves the entire table to the next page — keeping title and
    //  first images always together, no matter what.
    //
    const firstRow = makeImageRow(pairs[0].left, pairs[0].right, pairs.length === 1 ? 0 : 14);

    const anchorBlock = {
        // Single-row single-column table — acts as an unbreakable wrapper
        table: {
            widths: ['*'],
            dontBreakRows: true, // ← THE GUARANTEE: never split this row
            body: [
                [{
                    border: [false, false, false, false],
                    // Stack the header + first image row inside the cell
                    stack: [
                        headerBar,
                        firstRow,
                    ],
                    margin: [0, 0, 0, 0],
                }]
            ]
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 0],
    };

    // ── Remaining pairs flow freely (can page-break between them) ────────────
    const remainingRows = pairs.slice(1).map((pair, idx) => {
        const isLast = idx === pairs.length - 2;
        return makeImageRow(pair.left, pair.right, isLast ? 0 : 14);
    });

    // Return: [anchorBlock, ...remainingRows]
    // Wrap everything in a stack with the section's bottom margin
    return [{
        stack: [anchorBlock, ...remainingRows],
        margin: [0, 0, 0, 20],
    }];
}

// ─────────────────────────────────────────────────────────────────────────────
// Main PDF route
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:projectId', async(req, res) => {
    try {
        const pid = req.params.projectId;
        const isPreview = req.query.preview === '1';

        const [
            [
                [project]
            ],
            [items],
            [statements],
            [pocImages],
        ] = await Promise.all([
            db.query(
                `SELECT p.*, c.client_name, c.phone, c.email, c.address AS client_address
                 FROM projects p JOIN clients c ON c.id=p.client_id WHERE p.id=?`, [pid]
            ),
            db.query('SELECT * FROM quotation_items WHERE project_id=? ORDER BY sr_no, id', [pid]),
            db.query('SELECT * FROM quotation_statements WHERE project_id=? ORDER BY sort_order, id', [pid]),
            db.query(
                'SELECT id, image_data, caption, sort_order FROM quotation_poc_images WHERE project_id=? ORDER BY sort_order, id', [pid]
            ),
        ]);
        if (!project) return res.status(404).json({ error: 'Not found' });

        const totalAmount = items.reduce((s, r) => s + f(r.amount), 0);
        const hasLBH = items.some(r => f(r.l_ft) > 0 || f(r.b_ft) > 0 || f(r.h_ft) > 0);
        const hasUnit = items.some(r => r.unit && r.unit.trim() !== '');

        const invNum = project.invoice_number || `QUO-${pid}`;
        const invDate = project.invoice_date ? fDate(project.invoice_date) : fDate(new Date().toISOString().slice(0, 10));

        const sigClient = (project.sig_client && project.sig_client.trim()) ? project.sig_client.trim() : null;
        const sigCont = (project.sig_contractor && project.sig_contractor.trim()) ? project.sig_contractor.trim() : null;
        const sigContRaw = project.sig_contractor_img || null;
        const sigContImg = sigContRaw ?
            (sigContRaw.startsWith('data:') ? sigContRaw : 'data:image/jpeg;base64,' + sigContRaw) :
            null;

        const headers = hasLBH ? [
            hCell('#', 'center'), hCell('DESCRIPTION'),
            ...(hasUnit ? [hCell('UNIT', 'center')] : []),
            hCell('L (ft)', 'center'), hCell('B (ft)', 'center'), hCell('H (ft)', 'center'),
            hCell('AREA/VOL', 'right'), hCell('QTY', 'right'), hCell('RATE', 'right'), hCell('AMOUNT', 'right'),
        ] : [
            hCell('#', 'center'), hCell('DESCRIPTION'),
            ...(hasUnit ? [hCell('UNIT', 'center')] : []),
            hCell('QTY', 'right'), hCell('RATE', 'right'), hCell('AMOUNT', 'right'),
        ];

        const widths = hasLBH ?
            (hasUnit ? [20, '*', 32, 32, 32, 32, 44, 28, 52, 72] : [20, '*', 32, 32, 32, 44, 28, 52, 72]) :
            (hasUnit ? [20, '*', 40, 36, 52, 72] : [20, '*', 36, 52, 72]);

        const amountCell = r => ({
            columns: [
                { text: 'Rs.', fontSize: 7.5, color: ORANGE, width: 'auto', margin: [0, 0, 2, 0] },
                { text: parseFloat(r.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), fontSize: 8.5, bold: true, color: DARK, width: '*', alignment: 'right' },
            ],
            margin: [5, 4, 5, 4],
            noWrap: true,
        });

        const rows = items.map((r, i) => {
            const lbhResult = f(r.lbh_result);
            const isBlue = lbhResult > 0;
            if (hasLBH) return [
                cell(r.sr_no || i + 1, { align: 'center', color: GRAY, size: 8 }),
                cell(r.description, { bold: true, size: 8.5 }),
                ...(hasUnit ? [cell(r.unit || '—', { align: 'center', color: GRAY, size: 8 })] : []),
                { text: N3(r.l_ft), fontSize: 8, color: isBlue ? BLUE : GRAY, alignment: 'center', margin: [5, 5, 5, 5] },
                { text: N3(r.b_ft), fontSize: 8, color: isBlue ? BLUE : GRAY, alignment: 'center', margin: [5, 5, 5, 5] },
                { text: N3(r.h_ft), fontSize: 8, color: isBlue ? BLUE : GRAY, alignment: 'center', margin: [5, 5, 5, 5] },
                { text: isBlue ? lbhResult.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—', fontSize: 8, bold: isBlue, color: isBlue ? BLUE : GRAY, alignment: 'right', fillColor: isBlue ? BLUEBG : null, margin: [5, 5, 5, 5], noWrap: true },
                cell(NUM(r.quantity), { align: 'right', noWrap: true, size: 8 }),
                cell(NUM(r.rate), { align: 'right', noWrap: true, size: 8 }),
                amountCell(r),
            ];
            return [
                cell(r.sr_no || i + 1, { align: 'center', color: GRAY, size: 8 }),
                cell(r.description, { bold: true, size: 8.5 }),
                ...(hasUnit ? [cell(r.unit || '—', { align: 'center', color: GRAY, size: 8 })] : []),
                cell(NUM(r.quantity), { align: 'right', noWrap: true, size: 8 }),
                cell(NUM(r.rate), { align: 'right', noWrap: true, size: 8 }),
                amountCell(r),
            ];
        });

        const subtotalColSpan = hasLBH ? (hasUnit ? 8 : 7) : (hasUnit ? 4 : 3);
        const subtotalRow = [
            { text: '', colSpan: subtotalColSpan, border: [false, false, false, false], fillColor: LIGHT },
            ...Array(subtotalColSpan - 1).fill({ text: '', border: [false, false, false, false] }),
            { text: 'Subtotal', fontSize: 7.5, bold: true, color: GRAY, alignment: 'right', border: [false, true, false, true], borderColor: [BORDER, BORDER, BORDER, BORDER], fillColor: LIGHT, margin: [5, 5, 5, 5] },
            { columns: [{ text: 'Rs.', fontSize: 7.5, color: ORANGE, width: 'auto', margin: [0, 0, 2, 0] }, { text: totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), fontSize: 8.5, bold: true, color: DARK, width: '*', alignment: 'right' }], border: [false, true, false, true], borderColor: [BORDER, BORDER, BORDER, BORDER], fillColor: LIGHT, margin: [5, 4, 5, 4], noWrap: true },
        ];

        const pocSection = buildPocSection(pocImages);

        const docDef = {
            pageSize: 'A4',
            pageMargins: [40, 50, 40, 95],

            footer: (currentPage, pageCount) => {
                const strip = {
                    margin: [40, 0, 40, 0],
                    columns: [{
                        stack: [
                            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: BORDER }] },
                            {
                                columns: [
                                    { text: `Generated: ${fDate(new Date())}`, fontSize: 7, color: GRAY, margin: [0, 6, 0, 0] },
                                    { text: `Page ${currentPage} of ${pageCount}`, fontSize: 7, bold: true, color: ORANGE, alignment: 'right', margin: [0, 6, 0, 0] },
                                ]
                            }
                        ]
                    }]
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
                                                    { text: 'NAVYAKAR', fontSize: 15, bold: true, color: ORANGE, characterSpacing: 3, margin: [40, 13, 0, 3] },
                                                    { text: 'Building Dreams, Crafting Reality', fontSize: 6.5, color: '#94A3B8', italics: true, margin: [40, 0, 0, 13] },
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
                                                margin: [18, 11, 40, 11],
                                                stack: [
                                                    { text: 'FOLLOW US', fontSize: 6, bold: true, color: ORANGE, characterSpacing: 1.5, margin: [0, 0, 0, 5] },
                                                    { text: [{ text: 'IG  ', fontSize: 6.5, bold: true, color: ORANGE }, { text: '@navyakar', fontSize: 7, color: WHITE }], margin: [0, 0, 0, 3] },
                                                    { text: [{ text: 'FB  ', fontSize: 6.5, bold: true, color: ORANGE }, { text: '@navyakar', fontSize: 7, color: WHITE }] },
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

            content: [

                // ── Page header ───────────────────────────────────────────────
                {
                    stack: [
                        { text: 'NAVYAKAR', fontSize: 28, bold: true, color: DARK, alignment: 'center', characterSpacing: 3 },
                        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2.5, lineColor: ORANGE }], margin: [0, 8, 0, 8] },
                        { text: 'QUOTATION', fontSize: 14, bold: true, color: GRAY, alignment: 'center', characterSpacing: 3, margin: [0, 0, 0, 6] },
                        {
                            columns: [
                                { text: '', width: '*' },
                                {
                                    stack: [
                                        { text: invNum, fontSize: 9, bold: false, color: GRAY, alignment: 'right' },
                                        { text: invDate, fontSize: 8, color: '#94A3B8', alignment: 'right', margin: [0, 1, 0, 0] },
                                    ],
                                    width: 140
                                },
                            ],
                            margin: [0, 0, 0, 14],
                        },
                        {
                            columns: [{
                                    width: '50%',
                                    stack: [
                                        { text: 'TO', fontSize: 7, bold: true, color: ORANGE, margin: [0, 0, 0, 6], characterSpacing: 1 },
                                        { text: project.client_name, fontSize: 12, bold: true, color: DARK, margin: [0, 0, 0, 4] },
                                        ...(project.phone ? [{ text: `📞  ${project.phone}`, fontSize: 8.5, color: GRAY }] : []),
                                        ...(project.email ? [{ text: `✉   ${project.email}`, fontSize: 8.5, color: GRAY, margin: [0, 3, 0, 0] }] : []),
                                        ...(project.client_address ? [{ text: `📍  ${project.client_address}`, fontSize: 8.5, color: GRAY, margin: [0, 3, 0, 0] }] : []),
                                    ]
                                },
                                {
                                    width: '50%',
                                    stack: [
                                        { text: 'PROJECT', fontSize: 7, bold: true, color: ORANGE, alignment: 'right', margin: [0, 0, 0, 6], characterSpacing: 1 },
                                        { text: project.project_name, fontSize: 12, bold: true, color: DARK, alignment: 'right', margin: [0, 0, 0, 4] },
                                        ...(project.location ? [{ text: `📍  ${project.location}`, fontSize: 8.5, color: GRAY, alignment: 'right' }] : []),
                                        { text: `Start: ${fDate(project.start_date)}`, fontSize: 8.5, color: GRAY, alignment: 'right', margin: [0, 3, 0, 0] },
                                        { text: `Status: ${(project.status || '').replace('_', ' ').toUpperCase()}`, fontSize: 8.5, bold: true, color: ORANGE, alignment: 'right', margin: [0, 3, 0, 0] },
                                    ]
                                },
                            ],
                        },
                    ],
                    margin: [0, 0, 0, 20],
                },

                // ── Items table ───────────────────────────────────────────────
                {
                    table: {
                        headerRows: 1,
                        dontBreakRows: false,
                        keepWithHeaderRows: 1,
                        widths,
                        body: items.length > 0 ?
                            [headers, ...rows, subtotalRow] :
                            [headers, [{ text: 'No items added yet.', colSpan: headers.length, italics: true, fontSize: 9, color: GRAY, alignment: 'center', margin: [0, 16, 0, 16], border: [false, false, false, false] }, ...Array(headers.length - 1).fill({})]]
                    },
                    layout: {
                        fillColor: ri => ri === 0 ? null : (ri % 2 === 0 ? STRIPE : WHITE),
                        hLineColor: () => BORDER,
                        vLineColor: () => BORDER,
                        hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 0 : 0.4,
                        vLineWidth: () => 0,
                        paddingLeft: () => 0,
                        paddingRight: () => 0,
                        paddingTop: () => 0,
                        paddingBottom: () => 0,
                    },
                    margin: [0, 0, 0, 22],
                },

                // ── Total box ─────────────────────────────────────────────────
                {
                    columns: [
                        { width: '*', text: '' },
                        {
                            width: 290,
                            stack: [{
                                    table: {
                                        widths: ['*', 'auto'],
                                        body: [
                                            [
                                                { text: 'TOTAL AMOUNT', bold: true, fontSize: 10, color: WHITE, fillColor: DARK, margin: [14, 11, 10, 11], border: [false, false, false, false] },
                                                {
                                                    text: [
                                                        { text: 'Rs. ', fontSize: 9, color: ORANGE, bold: true },
                                                        { text: totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), fontSize: 12, bold: true, color: ORANGE },
                                                    ],
                                                    fillColor: DARK,
                                                    margin: [10, 12, 14, 10],
                                                    border: [false, false, false, false],
                                                    alignment: 'right',
                                                    noWrap: true,
                                                },
                                            ]
                                        ]
                                    },
                                    layout: 'noBorders',
                                },
                                {
                                    columns: [
                                        { text: '', width: '*' },
                                        { text: amountInWords(totalAmount), fontSize: 7, italics: true, color: '#94A3B8', alignment: 'right', width: 290 },
                                    ],
                                    margin: [0, 3, 0, 0],
                                },
                            ]
                        },
                    ],
                    margin: [0, 0, 0, 24],
                },

                // ── Project Vision & Concepts ─────────────────────────────────
                // The anchor block inside uses dontBreakRows:true on a single-cell
                // table to guarantee title + first image row always appear together.
                // If they don't fit on the current page, the whole block moves to
                // the next page. Zero gap between title and photos.
                ...pocSection,

                // ── Terms & Conditions ────────────────────────────────────────
                ...(statements.length > 0 ? [{
                    stack: [{
                            table: {
                                widths: ['*'],
                                body: [
                                    [{
                                        text: 'TERMS & CONDITIONS',
                                        fontSize: 9,
                                        bold: true,
                                        color: WHITE,
                                        fillColor: DARK,
                                        margin: [10, 7, 10, 7],
                                        border: [false, false, false, false],
                                        characterSpacing: 0.8,
                                    }]
                                ]
                            },
                            layout: 'noBorders',
                            margin: [0, 0, 0, 0],
                        },
                        {
                            table: {
                                widths: ['*'],
                                body: statements.map(s => ([{
                                    border: [false, false, false, false],
                                    margin: [10, 5, 10, 5],
                                    columns: [
                                        { text: '•', fontSize: 9, bold: true, color: BLUE, width: 12 },
                                        { text: s.statement, fontSize: 8.5, color: DARK, width: '*' },
                                    ],
                                }])),
                            },
                            layout: 'noBorders',
                        },
                    ],
                    margin: [0, 0, 0, 20],
                }] : []),

                // ── Signatures ────────────────────────────────────────────────
                ...(sigClient || sigCont || sigContImg ? [{
                    columns: [
                        sigClient ? {
                            width: '45%',
                            stack: [
                                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 185, y2: 0, lineWidth: 1, lineColor: DARK }] },
                                { text: sigClient, fontSize: 9, color: GRAY, margin: [0, 5, 0, 0] },
                                { text: 'CLIENT', fontSize: 7, bold: true, color: ORANGE, margin: [0, 2, 0, 0], characterSpacing: 0.8 },
                            ]
                        } : { width: '45%', text: '' },
                        { width: '10%', text: '' },
                        (sigCont || sigContImg) ? {
                            width: '45%',
                            stack: [
                                ...(sigContImg ? [{ image: sigContImg, width: 180, height: 70, fit: [180, 70], margin: [0, 0, 0, 8] }] : []),
                                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 185, y2: 0, lineWidth: 1, lineColor: DARK }] },
                                ...(sigCont ? [{ text: sigCont, fontSize: 9, color: GRAY, margin: [0, 5, 0, 0] }] : []),
                                { text: 'AUTHORIZED SIGNATORY', fontSize: 7, bold: true, color: ORANGE, margin: [0, 2, 0, 0], characterSpacing: 0.8 },
                            ]
                        } : { width: '45%', text: '' },
                    ]
                }] : []),

            ],

            defaultStyle: { font: 'Roboto', fontSize: 9, color: DARK, lineHeight: 1.35 },
        };

        const fname = `quotation_${project.project_name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', isPreview ? 'inline' : `attachment; filename="${fname}"`);

        if (!isPreview) {
            ensureSaveDir();
            const dateStr = new Date().toISOString().slice(0, 10);
            const savedName = `${dateStr}_QUO_${project.project_name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
            const savedPath = path.join(PDF_SAVE_DIR, savedName);

            const pdfDoc = printer.createPdfKitDocument(docDef);
            const chunks = [];
            pdfDoc.on('data', c => chunks.push(c));
            pdfDoc.on('end', async() => {
                const buf = Buffer.concat(chunks);
                try { fs.writeFileSync(savedPath, buf); } catch (e) { console.error('PDF save error:', e.message); }
                try {
                    await db.query(
                        "UPDATE pdf_downloads SET file_path=? WHERE project_id=? AND pdf_type='quotation' ORDER BY downloaded_at DESC LIMIT 1", [savedPath, pid]
                    );
                } catch (e) {}
                res.setHeader('Content-Length', buf.length);
                res.end(buf);
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
        console.error('Quotation PDF error:', err);
        if (!res.headersSent) res.status(500).json({ error: err.message });
    }
});

module.exports = router;