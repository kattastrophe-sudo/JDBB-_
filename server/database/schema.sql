-- JDBB Jewellery & Lock-Up System Database Schema
-- PostgreSQL Database Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS & AUTHENTICATION
-- ============================================

CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('Admin', 'Monitor', 'Student')),
  display_name VARCHAR(255),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================
-- STUDENTS (Tag # Database)
-- ============================================

CREATE TABLE students (
  student_id VARCHAR(50) PRIMARY KEY,
  student_code VARCHAR(10) NOT NULL UNIQUE, -- 3-4 letter initials for product codes
  tag_number VARCHAR(10) NOT NULL UNIQUE, -- 01-99 QR tag
  legal_name VARCHAR(255) NOT NULL,
  preferred_name VARCHAR(255),
  pronouns VARCHAR(50),
  college_email VARCHAR(255),
  personal_email VARCHAR(255),
  status VARCHAR(50) CHECK (status IN ('Full-time', 'Part-time')),
  courses TEXT,
  notes TEXT,
  user_id UUID REFERENCES users(user_id),
  date_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_students_tag ON students(tag_number);
CREATE INDEX idx_students_code ON students(student_code);

-- ============================================
-- CONFIGURATION TABLES
-- ============================================

-- Categories (single source of truth for dropdowns)
CREATE TABLE categories (
  category_id VARCHAR(50) PRIMARY KEY,
  domain VARCHAR(50) NOT NULL CHECK (domain IN (
    'Tool', 'JewelleryItem', 'Material', 'Stone',
    'Pronouns', 'Payment', 'MetalType'
  )),
  name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_categories_domain ON categories(domain);

-- Email Templates
CREATE TABLE email_templates (
  template_id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL, -- Supports placeholders like {PreferredName}, {Amount}
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Metal Pricing
CREATE TABLE metal_pricing (
  metal_id VARCHAR(50) PRIMARY KEY,
  metal_type VARCHAR(50) NOT NULL,
  purity DECIMAL(5,3) NOT NULL, -- e.g., 0.925, 0.585
  spot_per_troy_ounce DECIMAL(10,2) NOT NULL,
  markup_default DECIMAL(5,2) DEFAULT 0.20,
  labor_fee_default DECIMAL(10,2) DEFAULT 0.00,
  effective_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_metal_pricing_current ON metal_pricing(metal_type, is_current);

-- Fee Tiers (configurable fee rules)
CREATE TABLE fee_tiers (
  tier_id VARCHAR(50) PRIMARY KEY,
  lower_bound DECIMAL(10,2) NOT NULL,
  upper_bound DECIMAL(10,2), -- NULL means infinity
  rate DECIMAL(5,2) NOT NULL,
  applies_to VARCHAR(50) CHECK (applies_to IN ('Store', 'CustomRepair')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TOOLS & EQUIPMENT
-- ============================================

CREATE TABLE tools (
  tool_id VARCHAR(50) PRIMARY KEY,
  tool_name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  status VARCHAR(50) DEFAULT 'Available' CHECK (status IN (
    'Available', 'On Loan', 'In Repair', 'Lost'
  )),
  replacement_cost DECIMAL(10,2),
  is_kit BOOLEAN DEFAULT FALSE,
  location VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tools_status ON tools(status);

-- Tool Loans
CREATE TABLE tool_loans (
  loan_id SERIAL PRIMARY KEY,
  tool_id VARCHAR(50) REFERENCES tools(tool_id),
  student_id VARCHAR(50) REFERENCES students(student_id),
  loan_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  due_date TIMESTAMP NOT NULL,
  return_date TIMESTAMP,
  condition TEXT,
  status VARCHAR(50) DEFAULT 'On Loan' CHECK (status IN (
    'On Loan', 'Returned', 'Overdue'
  )),
  created_by UUID REFERENCES users(user_id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tool_loans_student ON tool_loans(student_id);
CREATE INDEX idx_tool_loans_tool ON tool_loans(tool_id);
CREATE INDEX idx_tool_loans_status ON tool_loans(status);

-- Tool Reservations
CREATE TABLE tool_reservations (
  reservation_id SERIAL PRIMARY KEY,
  tool_id VARCHAR(50) REFERENCES tools(tool_id),
  student_id VARCHAR(50) REFERENCES students(student_id),
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN (
    'Pending', 'Notified', 'Fulfilled', 'Expired', 'Cancelled'
  )),
  notified_at TIMESTAMP,
  expires_at TIMESTAMP,
  fulfilled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tool_reservations_status ON tool_reservations(status);
CREATE INDEX idx_tool_reservations_tool ON tool_reservations(tool_id);

-- ============================================
-- LOCK-UP STORE (Materials & Supplies)
-- ============================================

CREATE TABLE lockup_items (
  item_id VARCHAR(50) PRIMARY KEY,
  item_name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  unit VARCHAR(50), -- g / each / kit
  weight DECIMAL(10,3),
  selling_price DECIMAL(10,2),
  markup_rate DECIMAL(5,2),
  allowed_payments TEXT[], -- Array: Cash, OneCard, LockupAccount
  status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'PendingPricing', 'Inactive')),
  metal_type VARCHAR(50),
  use_metal_formula BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_lockup_items_status ON lockup_items(status);

-- Lock-Up Sales
CREATE TABLE lockup_sales (
  sale_id SERIAL PRIMARY KEY,
  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  item_id VARCHAR(50) REFERENCES lockup_items(item_id),
  student_id VARCHAR(50) REFERENCES students(student_id),
  quantity DECIMAL(10,3) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  payment_method TEXT[], -- Can be multiple: Cash, OneCard, LockupAccount
  payment_cash DECIMAL(10,2) DEFAULT 0,
  payment_onecard DECIMAL(10,2) DEFAULT 0,
  payment_account DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES users(user_id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_lockup_sales_student ON lockup_sales(student_id);
CREATE INDEX idx_lockup_sales_date ON lockup_sales(date);

-- ============================================
-- JEWELLERY STORE
-- ============================================

CREATE TABLE store_items (
  item_id VARCHAR(50) PRIMARY KEY,
  student_id VARCHAR(50) REFERENCES students(student_id),
  item_name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  materials TEXT,
  size VARCHAR(50),
  images TEXT[], -- Array of image file paths
  price_final DECIMAL(10,2) NOT NULL, -- Includes HST
  price_pre_tax DECIMAL(10,2) GENERATED ALWAYS AS (price_final / 1.13) STORED,
  store_fee_rate DECIMAL(5,2),
  store_fee_amount DECIMAL(10,2),
  student_share DECIMAL(10,2),
  type VARCHAR(50) CHECK (type IN ('Store', 'Custom', 'Repair')),
  status VARCHAR(50) DEFAULT 'Available' CHECK (status IN (
    'Available', 'Sold', 'Removed', 'PendingApproval'
  )),
  date_submitted DATE DEFAULT CURRENT_DATE,
  date_sold DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_store_items_student ON store_items(student_id);
CREATE INDEX idx_store_items_status ON store_items(status);

-- Trigger to calculate fees for store items
CREATE OR REPLACE FUNCTION calculate_store_fees()
RETURNS TRIGGER AS $$
DECLARE
  subtotal DECIMAL(10,2);
  fee_rate DECIMAL(5,2);
BEGIN
  subtotal := NEW.price_pre_tax;

  -- Determine fee rate
  IF NEW.type IN ('Custom', 'Repair') THEN
    fee_rate := 0.15;
  ELSE
    -- Tiered rates for Store items
    IF subtotal <= 250 THEN
      fee_rate := 0.20;
    ELSIF subtotal <= 500 THEN
      fee_rate := 0.15;
    ELSE
      fee_rate := 0.10;
    END IF;
  END IF;

  NEW.store_fee_rate := fee_rate;
  NEW.store_fee_amount := subtotal * fee_rate;
  NEW.student_share := subtotal - NEW.store_fee_amount;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_store_fees
  BEFORE INSERT OR UPDATE OF price_final, type
  ON store_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_store_fees();

-- Store Sales
CREATE TABLE store_sales (
  sale_id SERIAL PRIMARY KEY,
  item_id VARCHAR(50) REFERENCES store_items(item_id),
  student_id VARCHAR(50), -- Denormalized from item
  date_sold TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  payment_type VARCHAR(50) CHECK (payment_type IN ('Visa', 'MC', 'Debit')),
  tax_exempt BOOLEAN DEFAULT FALSE,
  price_final DECIMAL(10,2) NOT NULL,
  store_fee_amount DECIMAL(10,2) NOT NULL,
  student_share_amount DECIMAL(10,2) NOT NULL,
  created_by UUID REFERENCES users(user_id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_store_sales_student ON store_sales(student_id);
CREATE INDEX idx_store_sales_date ON store_sales(date_sold);
CREATE INDEX idx_store_sales_payment ON store_sales(payment_type);

-- ============================================
-- FINANCIAL LEDGER
-- ============================================

CREATE TABLE lockup_account_transactions (
  trans_id SERIAL PRIMARY KEY,
  student_id VARCHAR(50) REFERENCES students(student_id),
  date DATE DEFAULT CURRENT_DATE,
  type VARCHAR(50) CHECK (type IN (
    'Sale', 'Fee', 'Payment', 'Credit', 'Adjustment'
  )),
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL, -- Positive = credit, Negative = charge
  related_id INTEGER, -- Optional reference to sale/loan/etc
  related_table VARCHAR(50), -- Which table related_id refers to
  created_by UUID REFERENCES users(user_id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transactions_student ON lockup_account_transactions(student_id);
CREATE INDEX idx_transactions_date ON lockup_account_transactions(date);

-- View for student balances
CREATE OR REPLACE VIEW student_balances AS
SELECT
  s.student_id,
  s.preferred_name,
  s.legal_name,
  s.tag_number,
  COALESCE(SUM(t.amount), 0) as lockup_balance,
  MAX(t.date) as last_transaction_date
FROM students s
LEFT JOIN lockup_account_transactions t ON s.student_id = t.student_id
GROUP BY s.student_id, s.preferred_name, s.legal_name, s.tag_number;

-- ============================================
-- PAYOUTS
-- ============================================

CREATE TABLE payouts (
  payout_id SERIAL PRIMARY KEY,
  student_id VARCHAR(50) REFERENCES students(student_id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_student_share DECIMAL(10,2) NOT NULL,
  method VARCHAR(50) CHECK (method IN ('Cheque', 'ApplyToLockup')),
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN (
    'Pending', 'Processed', 'Cancelled'
  )),
  notes TEXT,
  created_by UUID REFERENCES users(user_id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payouts_student ON payouts(student_id);
CREATE INDEX idx_payouts_status ON payouts(status);

-- ============================================
-- SEED DATA FOR CATEGORIES
-- ============================================

INSERT INTO categories (category_id, domain, name, is_active, sort_order) VALUES
-- Tools
('CAT001', 'Tool', 'Rolling Mill', TRUE, 10),
('CAT002', 'Tool', 'Soldering Kit', TRUE, 20),
('CAT003', 'Tool', 'Polishing Kit', TRUE, 30),
('CAT004', 'Tool', 'Files Set', TRUE, 40),
('CAT005', 'Tool', 'Pliers Set', TRUE, 50),

-- Jewellery Items
('CAT050', 'JewelleryItem', 'Ring', TRUE, 10),
('CAT051', 'JewelleryItem', 'Necklace', TRUE, 20),
('CAT052', 'JewelleryItem', 'Bracelet', TRUE, 30),
('CAT053', 'JewelleryItem', 'Earrings', TRUE, 40),
('CAT054', 'JewelleryItem', 'Brooch', TRUE, 50),
('CAT055', 'JewelleryItem', 'Pendant', TRUE, 60),

-- Materials
('CAT080', 'Material', 'Silver Wire', TRUE, 10),
('CAT081', 'Material', 'Gold Wire', TRUE, 20),
('CAT082', 'Material', 'Copper Sheet', TRUE, 30),
('CAT083', 'Material', 'Flux', TRUE, 40),
('CAT084', 'Material', 'Solder', TRUE, 50),

-- Pronouns
('CAT101', 'Pronouns', 'she/her', TRUE, 1),
('CAT102', 'Pronouns', 'he/him', TRUE, 2),
('CAT103', 'Pronouns', 'they/them', TRUE, 3),
('CAT104', 'Pronouns', 'she/they', TRUE, 4),
('CAT105', 'Pronouns', 'he/they', TRUE, 5),

-- Payment Types
('CAT200', 'Payment', 'Visa', TRUE, 1),
('CAT201', 'Payment', 'MC', TRUE, 2),
('CAT202', 'Payment', 'Debit', TRUE, 3),
('CAT203', 'Payment', 'Cash', TRUE, 4),
('CAT204', 'Payment', 'OneCard', TRUE, 5),
('CAT205', 'Payment', 'LockupAccount', TRUE, 6),

-- Metal Types
('CAT300', 'MetalType', 'Silver', TRUE, 1),
('CAT301', 'MetalType', 'Gold10K', TRUE, 2),
('CAT302', 'MetalType', 'Gold14K', TRUE, 3),
('CAT303', 'MetalType', 'Gold18K', TRUE, 4),
('CAT304', 'MetalType', 'Copper', TRUE, 5),
('CAT305', 'MetalType', 'Brass', TRUE, 6);

-- ============================================
-- SEED DATA FOR METAL PRICING
-- ============================================

INSERT INTO metal_pricing (metal_id, metal_type, purity, spot_per_troy_ounce, markup_default, labor_fee_default, effective_date, is_current) VALUES
('MET-SIL', 'Silver', 0.925, 34.50, 0.20, 0.00, CURRENT_DATE, TRUE),
('MET-G10', 'Gold10K', 0.417, 2375.00, 0.25, 0.00, CURRENT_DATE, TRUE),
('MET-G14', 'Gold14K', 0.585, 2375.00, 0.25, 0.00, CURRENT_DATE, TRUE),
('MET-G18', 'Gold18K', 0.750, 2375.00, 0.25, 0.00, CURRENT_DATE, TRUE);

-- ============================================
-- SEED DATA FOR FEE TIERS
-- ============================================

INSERT INTO fee_tiers (tier_id, lower_bound, upper_bound, rate, applies_to, is_active) VALUES
('TIER_0_250', 0, 250, 0.20, 'Store', TRUE),
('TIER_250_500', 250, 500, 0.15, 'Store', TRUE),
('TIER_500_PLUS', 500, NULL, 0.10, 'Store', TRUE),
('CUSTOM_FLAT', 0, NULL, 0.15, 'CustomRepair', TRUE);

-- ============================================
-- SEED DATA FOR EMAIL TEMPLATES
-- ============================================

INSERT INTO email_templates (template_id, name, subject, body, is_active, notes) VALUES
('EML001', 'StudentSaleNotice', 'Your piece just sold!',
'Good news {PreferredName}!

Your jewellery piece "{ItemTitle}" just sold for {FinalPrice}. After the program fee, your share is {StudentShare}.

You can choose to receive a cheque or apply this amount to your Lock-Up account balance at the end of the month.

Congratulations!
JDBB Team', TRUE, ''),

('EML010', 'BalanceReminder', 'Your current JDBB balance',
'Hello {PreferredName},

Your Lock-Up account balance is {Balance}. Please settle this amount by {DueDate}.

You can pay via cash, OneCard, or come see us to discuss payment options.

Thank you!
JDBB Team', TRUE, ''),

('EML020', 'DailyStoreSummary', 'Today''s Store Sales Summary',
'Daily Sales Report - {Date}

Visa: {VisaTotal}
MasterCard: {MCTotal}
Debit: {DebitTotal}

Total: {GrandTotal}

Please verify against terminal batch.', TRUE, ''),

('EML030', 'ToolOverdue', 'Tool return reminder',
'Hello {PreferredName},

The tool "{ToolName}" (ID: {ToolID}) was due back on {DueDate} and is now overdue.

Please return it to the tool crib as soon as possible.

Thank you!
JDBB Team', TRUE, ''),

('EML040', 'ReservationReady', 'Your reserved tool is available',
'Hello {PreferredName},

Good news! The tool "{ToolName}" you requested is now available.

Please come pick it up within 24 hours or your reservation will expire.

JDBB Team', TRUE, '');

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_store_items_date_submitted ON store_items(date_submitted);
CREATE INDEX idx_store_sales_created_at ON store_sales(created_at);
CREATE INDEX idx_lockup_sales_created_at ON lockup_sales(created_at);
CREATE INDEX idx_tool_loans_due_date ON tool_loans(due_date);
CREATE INDEX idx_tool_reservations_expires_at ON tool_reservations(expires_at);

-- ============================================
-- AUDIT TRAIL FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tools_updated_at BEFORE UPDATE ON tools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lockup_items_updated_at BEFORE UPDATE ON lockup_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_items_updated_at BEFORE UPDATE ON store_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
