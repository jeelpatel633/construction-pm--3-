-- ============================================================
-- ConstructPro — Database Schema (v2)
-- ============================================================
CREATE DATABASE IF NOT EXISTS construction_pm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE construction_pm;

-- ── Clients ──────────────────────────────────────────────────
CREATE TABLE clients (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  client_name VARCHAR(200) NOT NULL,
  phone       VARCHAR(20),
  email       VARCHAR(150),
  address     TEXT,
  notes       TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── Projects ─────────────────────────────────────────────────
CREATE TABLE projects (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  client_id         INT NOT NULL,
  project_name      VARCHAR(250) NOT NULL,
  location          VARCHAR(250),
  start_date        DATE,
  end_date          DATE,
  status            ENUM('planning','active','on_hold','completed','cancelled') DEFAULT 'planning',
  notes             TEXT,
  invoice_notes     TEXT,
  sig_client        VARCHAR(200),
  sig_contractor    VARCHAR(200),
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- ── Architect Work (Main Estimation) ─────────────────────────
CREATE TABLE architect_work (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  project_id      INT NOT NULL,
  item_name       VARCHAR(250) NOT NULL,
  unit            VARCHAR(50),
  quantity        DECIMAL(12,2) DEFAULT 0,
  rate            DECIMAL(12,2) DEFAULT 0,
  subtotal        DECIMAL(15,2) GENERATED ALWAYS AS (quantity * rate) STORED,
  additional_cost DECIMAL(12,2) DEFAULT 0,
  tax_percent     DECIMAL(5,2)  DEFAULT 0,
  grand_total     DECIMAL(15,2) GENERATED ALWAYS AS (
                    (quantity * rate) + additional_cost +
                    ((quantity * rate) * tax_percent / 100)
                  ) STORED,
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- ── Contractor Work (Site / Rough Estimation) ─────────────────
CREATE TABLE contractor_work (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  project_id      INT NOT NULL,
  item_name       VARCHAR(250) NOT NULL,
  unit            VARCHAR(50),
  quantity        DECIMAL(12,2) DEFAULT 0,
  rate            DECIMAL(12,2) DEFAULT 0,
  subtotal        DECIMAL(15,2) GENERATED ALWAYS AS (quantity * rate) STORED,
  additional_cost DECIMAL(12,2) DEFAULT 0,
  tax_percent     DECIMAL(5,2)  DEFAULT 0,
  grand_total     DECIMAL(15,2) GENERATED ALWAYS AS (
                    (quantity * rate) + additional_cost +
                    ((quantity * rate) * tax_percent / 100)
                  ) STORED,
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- ── Client Payments (Advance / Instalments) ──────────────────
CREATE TABLE client_payments (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  project_id     INT NOT NULL,
  payment_date   DATE NOT NULL,
  amount         DECIMAL(15,2) NOT NULL DEFAULT 0,
  payment_method ENUM('cash','bank_transfer','cheque','upi','other') DEFAULT 'cash',
  reference      VARCHAR(200),
  notes          TEXT,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- ── Invoice Statements (custom bullet points for PDF) ─────────
CREATE TABLE invoice_statements (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  statement  VARCHAR(500) NOT NULL,
  sort_order INT DEFAULT 0,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX idx_client_name   ON clients(client_name);
CREATE INDEX idx_proj_client   ON projects(client_id);
CREATE INDEX idx_arch_proj     ON architect_work(project_id);
CREATE INDEX idx_cont_proj     ON contractor_work(project_id);
CREATE INDEX idx_pay_proj      ON client_payments(project_id);
CREATE INDEX idx_stmt_proj     ON invoice_statements(project_id);
