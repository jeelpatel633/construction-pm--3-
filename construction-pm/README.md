# 🏗️ ConstructPro v2 — Construction Project Management

Clean, white-theme project management for architects and contractors.

---

## Setup (3 steps)

### Step 1 — MySQL
Open MySQL Workbench and run:
```
SOURCE /path/to/construction-pm/database/schema.sql;
```

### Step 2 — Backend
```
cd construction-pm/backend
copy .env.example .env         (Windows)
cp .env.example .env           (Mac/Linux)
```
Edit `.env` → set DB_PASSWORD  
```
npm install
npm run dev
```
→ Running at http://localhost:5000

### Step 3 — Frontend (new terminal)
```
cd construction-pm/frontend
npm install
npm run dev
```
→ Open http://localhost:3000

---

## How it works

### Financial Logic
```
Architect Work Total   (main estimation)
+ Contractor Work Total (site execution)
= TOTAL BILL  ← Client Has to Pay

- Advance / Payments Received
= BALANCE DUE
```

### Tabs
| Tab | Purpose |
|---|---|
| Architect Work | Main cost estimation (designed by architect) |
| Contractor Work | Site execution estimate (actual construction) |
| Payments | Record client advance/installments — auto deducted |
| Invoice & PDF | Statements, signatures, notes → Download PDF |

### PDF includes
- Client + Project info
- Architect work table (all rows, auto page-break)
- Contractor work table
- Payment history
- Financial calculation breakdown
- Terms & statements (bullet points)
- Signature area

---

## Tables
```
clients              → client master
projects             → 1 per client (expandable)
architect_work       → main estimation rows
contractor_work      → site execution rows
client_payments      → advance / installments
invoice_statements   → PDF bullet points
```
