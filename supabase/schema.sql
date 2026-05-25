-- Royani Poultry Supply Store - Database Schema
-- Run this in Supabase SQL Editor

-- Products (medicines and chicken food)
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text check (type in ('medicine', 'food', 'meel')),
  barcode text unique,
  batch_number text,
  unit text,
  purchase_price numeric not null default 0,
  purchase_price_usd numeric default 0,       -- USD price if bought in dollars
  sell_price numeric not null default 0,
  quantity numeric default 0,
  expiry_date date,
  low_stock_threshold numeric default 10,
  created_at timestamp with time zone default now()
);

-- Farms (client farms / customers)
create table if not exists farms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_name text,
  phone text,
  location text,
  total_debt numeric default 0,
  advance_payment numeric default 0,
  total_profit_generated numeric default 0,
  is_active boolean default true,
  notes text,
  created_at timestamp with time zone default now()
);

-- Dispatches (stock sent to farms — each dispatch = one invoice)
create table if not exists dispatches (
  id uuid primary key default gen_random_uuid(),
  invoice_number integer,                      -- auto-generated invoice number
  farm_id uuid references farms(id) on delete cascade,
  dispatch_date date not null,
  total_amount numeric default 0,
  notes text,
  created_at timestamp with time zone default now()
);

-- Dispatch Items (line items within each dispatch)
create table if not exists dispatch_items (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid references dispatches(id) on delete cascade,
  product_id uuid references products(id),
  batch_number text,                           -- batch at time of sale
  quantity numeric default 0,
  purchase_price_at_time numeric default 0,
  sell_price_at_time numeric default 0,
  profit_per_item numeric default 0,
  total_profit numeric default 0,
  total_amount numeric default 0
);

-- Payments (payments received from farms)
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid references farms(id) on delete cascade,
  amount numeric not null,
  payment_date date not null,
  notes text,
  created_at timestamp with time zone default now()
);

-- Expenses (business operating expenses)
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  amount numeric not null,
  category text check (category in ('fuel','salary','rent','maintenance','utilities','other')),
  expense_date date not null,
  notes text,
  created_at timestamp with time zone default now()
);

-- Stock Purchases (restocking inventory)
create table if not exists stock_purchases (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete set null,
  batch_number text,                           -- batch number on this purchase
  quantity numeric default 0,
  purchase_price numeric default 0,            -- price in AFN
  purchase_price_usd numeric default 0,        -- price in USD (if applicable)
  usd_to_afn_rate numeric default 0,           -- exchange rate used
  total_cost numeric default 0,
  purchase_date date,
  supplier text,
  notes text,
  created_at timestamp with time zone default now()
);

-- Walk-in Customers (counter customers, separate from farms)
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  total_debt numeric default 0,
  total_purchases numeric default 0,
  notes text,
  created_at timestamp with time zone default now()
);

-- Walk-in Sales (counter sales to walk-in customers)
create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  invoice_number integer,
  customer_id uuid references customers(id) on delete set null,
  customer_name text,                            -- snapshot name (for anonymous or quick entry)
  sale_date date not null,
  total_amount numeric default 0,
  amount_paid numeric default 0,
  remaining numeric default 0,
  payment_type text default 'cash',              -- 'cash' or 'credit'
  notes text,
  created_at timestamp with time zone default now()
);

-- Walk-in Sale Items
create table if not exists sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references sales(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text,                             -- snapshot at time of sale
  quantity numeric default 0,
  sell_price_at_time numeric default 0,
  purchase_price_at_time numeric default 0,
  total_amount numeric default 0,
  total_profit numeric default 0
);

-- Enable Row Level Security (open for now, add auth later)
alter table products enable row level security;
alter table farms enable row level security;
alter table dispatches enable row level security;
alter table dispatch_items enable row level security;
alter table payments enable row level security;
alter table expenses enable row level security;
alter table stock_purchases enable row level security;

-- Policies: allow all operations (single-user, no auth)
create policy "Allow all" on products for all using (true) with check (true);
create policy "Allow all" on farms for all using (true) with check (true);
create policy "Allow all" on dispatches for all using (true) with check (true);
create policy "Allow all" on dispatch_items for all using (true) with check (true);
create policy "Allow all" on payments for all using (true) with check (true);
create policy "Allow all" on expenses for all using (true) with check (true);
create policy "Allow all" on stock_purchases for all using (true) with check (true);
create policy "Allow all" on customers for all using (true) with check (true);
create policy "Allow all" on sales for all using (true) with check (true);
create policy "Allow all" on sale_items for all using (true) with check (true);


-- Supply Payments (store pays farms to buy their own supplies from market)
create table if not exists supply_payments (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid references farms(id) on delete cascade,
  supply_item text not null,
  amount numeric not null default 0,
  payment_date date not null,
  notes text,
  created_at timestamp with time zone default now()
);

alter table supply_payments enable row level security;
create policy "Allow all" on supply_payments for all using (true) with check (true);

-- ============================================================
-- MIGRATIONS: run these in Supabase SQL Editor if your tables
-- were created from an older version of this schema.
-- Safe to run multiple times (uses IF NOT EXISTS).
-- ============================================================
alter table farms add column if not exists advance_payment numeric default 0;
alter table products add column if not exists batch_number text;
alter table products add column if not exists purchase_price_usd numeric default 0;
alter table products add column if not exists sell_price_usd numeric default 0;
alter table dispatches add column if not exists invoice_number integer;
alter table dispatch_items add column if not exists batch_number text;
alter table stock_purchases add column if not exists batch_number text;
alter table stock_purchases add column if not exists purchase_price_usd numeric default 0;
alter table stock_purchases add column if not exists usd_to_afn_rate numeric default 0;

-- Suppliers (meel/feed suppliers)
create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  owner_name text,
  phone text,
  notes text,
  created_at timestamp with time zone default now()
);

-- Supplier Dispatches (inbound meel/feed from suppliers)
create table if not exists supplier_dispatches (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references suppliers(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text,
  dispatch_date date not null,
  quantity numeric default 0,
  price_per_bag numeric default 0,
  weight_kg numeric,
  total_amount numeric default 0,
  commission_per_bag numeric default 0,
  total_commission numeric default 0,
  notes text,
  created_at timestamp with time zone default now()
);

-- Supplier Payments (payments made to suppliers)
create table if not exists supplier_payments (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references suppliers(id) on delete cascade,
  amount numeric not null,
  payment_date date not null,
  notes text,
  created_at timestamp with time zone default now()
);

alter table suppliers disable row level security;
alter table supplier_dispatches disable row level security;
alter table supplier_payments disable row level security;

-- App Settings (key-value store for global config like exchange rate)
create table if not exists settings (
  key text primary key,
  value text not null
);
alter table settings disable row level security;
insert into settings (key, value) values ('usd_to_afn_rate', '73') on conflict (key) do nothing;

-- Fix: allow meel type in products (migration if table already exists)
alter table products drop constraint if exists products_type_check;
alter table products add constraint products_type_check
  check (type in ('medicine', 'food', 'meel'));

-- Personal Cash Ledger (individual loans/borrowings, unrelated to farms/suppliers)
create table if not exists cash_ledger (
  id uuid primary key default gen_random_uuid(),
  person_name text not null,
  phone text,
  amount numeric not null default 0,
  type text not null check (type in ('lent', 'borrowed')),
  note text,
  transaction_date date not null default current_date,
  created_at timestamp with time zone default now()
);
alter table cash_ledger disable row level security;

-- Add bill_number and dana_type to supplier_dispatches
alter table supplier_dispatches add column if not exists bill_number text;
alter table supplier_dispatches add column if not exists dana_type text;
alter table supplier_dispatches drop constraint if exists supplier_dispatches_dana_type_check;
alter table supplier_dispatches add constraint supplier_dispatches_dana_type_check
  check (dana_type in ('4_number', '6_number', '9_number', '12_number', 'other'));

-- Chicken mortality tracking
alter table farms add column if not exists initial_chicken_count integer default 0;
alter table farms add column if not exists price_per_chicken numeric default 0;

-- Market Sellers (Commission Workers / کمیشن کار)
create table if not exists market_sellers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  shop_number text,
  phone text,
  notes text,
  created_at timestamp with time zone default now()
);
alter table market_sellers disable row level security;

-- Market Transactions (chickens sent from farms to market via sellers)
create table if not exists market_transactions (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references market_sellers(id) on delete cascade,
  farm_id uuid references farms(id) on delete set null,
  bill_number text,
  chicken_count integer not null default 0,
  price_per_chicken numeric default 0,
  total_amount numeric default 0,
  transaction_date date not null default current_date,
  notes text,
  farm_payment_id uuid references payments(id) on delete set null,
  created_at timestamp with time zone default now()
);
alter table market_transactions disable row level security;

-- Chicken Deaths (mortality log per farm)
create table if not exists chicken_deaths (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid references farms(id) on delete cascade,
  death_count integer not null default 0,
  reason text,
  death_date date not null default current_date,
  notes text,
  created_at timestamp with time zone default now()
);
alter table chicken_deaths disable row level security;

-- ============================================================
-- Supplier Types: medicine and choza added alongside meel
-- ============================================================
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS type text DEFAULT 'meel';

-- Link stock_purchases to medicine suppliers
ALTER TABLE stock_purchases ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL;

-- Choza transactions (small chicks)
CREATE TABLE IF NOT EXISTS choza_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES suppliers(id) ON DELETE CASCADE,
  transaction_date date NOT NULL DEFAULT current_date,
  choza_type text NOT NULL,
  afghani_subtype text,
  price_per_choza numeric DEFAULT 0,
  total_choza integer DEFAULT 0,
  total_amount numeric DEFAULT 0,
  sale_price_per_choza numeric DEFAULT 0,
  total_profit numeric DEFAULT 0,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE choza_transactions DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- COMMISSION MODULE: Daily chicken car sales (independent system)
-- ============================================================

-- Daily car deliveries
CREATE TABLE IF NOT EXISTS commission_cars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_date date NOT NULL DEFAULT current_date,
  total_chickens integer NOT NULL DEFAULT 500,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE commission_cars DISABLE ROW LEVEL SECURITY;

-- Commission customers (buyers, separate from walk-in customers)
CREATE TABLE IF NOT EXISTS commission_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE commission_customers DISABLE ROW LEVEL SECURITY;

-- Sales: per-chicken or per-kg pricing
CREATE TABLE IF NOT EXISTS commission_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id uuid REFERENCES commission_cars(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES commission_customers(id) ON DELETE CASCADE,
  sale_date date NOT NULL DEFAULT current_date,
  sale_type text NOT NULL CHECK (sale_type IN ('per_chicken', 'per_kg')),
  chicken_count integer NOT NULL DEFAULT 0,
  weight_kg numeric DEFAULT 0,
  price_per_unit numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE commission_sales DISABLE ROW LEVEL SECURITY;

-- Customer payments
CREATE TABLE IF NOT EXISTS commission_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES commission_customers(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  payment_date date NOT NULL DEFAULT current_date,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE commission_payments DISABLE ROW LEVEL SECURITY;

-- Commission: car closed flag + expenses
ALTER TABLE commission_cars ADD COLUMN IF NOT EXISTS is_closed boolean DEFAULT false;
ALTER TABLE commission_cars ADD COLUMN IF NOT EXISTS closed_at timestamp with time zone;

CREATE TABLE IF NOT EXISTS commission_car_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id uuid REFERENCES commission_cars(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE commission_car_expenses DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- COMMISSION DEALERS: Whose chickens are being sold (commission/agency model)
-- ============================================================

CREATE TABLE IF NOT EXISTS commission_dealers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE commission_dealers DISABLE ROW LEVEL SECURITY;

-- Link cars to a dealer + snapshot the commission rate at car creation
ALTER TABLE commission_cars ADD COLUMN IF NOT EXISTS dealer_id uuid REFERENCES commission_dealers(id) ON DELETE SET NULL;
ALTER TABLE commission_cars ADD COLUMN IF NOT EXISTS commission_rate_per_chicken numeric DEFAULT 5;

-- Track shop's payments to dealers (for finished car payouts)
CREATE TABLE IF NOT EXISTS commission_dealer_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id uuid REFERENCES commission_dealers(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  payment_date date NOT NULL DEFAULT current_date,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE commission_dealer_payments DISABLE ROW LEVEL SECURITY;

-- Default commission rate setting
INSERT INTO settings (key, value) VALUES ('commission_rate_per_chicken', '5')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- COMMISSION FEE EXPENSES: shop's overhead expenses (rent, utilities, etc.)
-- These minus from commission earned to compute the shop's actual profit.
-- Independent from per-car expenses.
-- ============================================================
CREATE TABLE IF NOT EXISTS commission_fee_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  note text,
  expense_date date NOT NULL DEFAULT current_date,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE commission_fee_expenses DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- USER AUTHENTICATION (admin / associate roles)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  username text UNIQUE NOT NULL,
  password text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'associate')),
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE app_users DISABLE ROW LEVEL SECURITY;

-- Default admin: username=admin, password=admin123 (CHANGE AFTER FIRST LOGIN)
INSERT INTO app_users (name, username, password, role)
VALUES ('Admin', 'admin', crypt('admin123', gen_salt('bf')), 'admin')
ON CONFLICT (username) DO NOTHING;

-- Login RPC
CREATE OR REPLACE FUNCTION auth_login(p_username text, p_password text)
RETURNS TABLE (id uuid, name text, username text, role text)
LANGUAGE plpgsql AS $func$
BEGIN
  RETURN QUERY
  SELECT u.id, u.name, u.username, u.role FROM app_users u
  WHERE u.username = p_username AND u.password = crypt(p_password, u.password);
END;
$func$;

-- Create user (admin only — caller must verify role)
CREATE OR REPLACE FUNCTION add_user(p_name text, p_username text, p_password text, p_role text)
RETURNS uuid LANGUAGE plpgsql AS $func$
DECLARE v_id uuid;
BEGIN
  INSERT INTO app_users (name, username, password, role)
  VALUES (p_name, p_username, crypt(p_password, gen_salt('bf')), p_role)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$func$;

-- Update user (password is optional — empty string = keep existing)
CREATE OR REPLACE FUNCTION update_user(p_id uuid, p_name text, p_username text, p_role text, p_password text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $func$
BEGIN
  IF p_password IS NULL OR p_password = '' THEN
    UPDATE app_users SET name = p_name, username = p_username, role = p_role WHERE id = p_id;
  ELSE
    UPDATE app_users SET name = p_name, username = p_username, role = p_role,
      password = crypt(p_password, gen_salt('bf')) WHERE id = p_id;
  END IF;
END;
$func$;

-- ============================================================
-- TEMPLATE FIXES — back-ported from Anas Hadi rollout 2026-05-23.
-- All statements are idempotent; safe to re-run on existing or fresh DBs.
-- Without these, a fresh client DB created from this script breaks:
--   • the app's joins select farms.name_fa/name_ps (400-errors if absent)
--   • choza suppliers can't insert products (type constraint blocks them)
--   • Chickens / batches and market-seller-payment features have no tables
--   • Supabase keeps RLS enforced even after `disable row level security`,
--     so the anon key reads return [] and writes throw policy violations.
-- ============================================================

-- 1. Bilingual name columns on farms (Dari = _fa, Pashto = _ps).
alter table farms add column if not exists name_fa text;
alter table farms add column if not exists name_ps text;
alter table farms add column if not exists owner_name_fa text;
alter table farms add column if not exists owner_name_ps text;

-- 2. Allow 'choza' as a product type (alongside medicine / food / meel).
alter table products drop constraint if exists products_type_check;
alter table products add constraint products_type_check
  check (type in ('medicine', 'food', 'meel', 'choza'));

-- 3. Per-farm chicken batches (seasons).
create table if not exists farm_batches (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid references farms(id) on delete cascade,
  batch_number integer not null default 1,
  start_date date,
  end_date date,
  initial_chicken_count integer default 0,
  price_per_chicken numeric default 0,
  supplier_id uuid references suppliers(id) on delete set null,
  notes text,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

-- 4. Cash payments received from market sellers, independent of farm finances.
create table if not exists market_seller_payments (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references market_sellers(id) on delete cascade,
  amount numeric not null default 0,
  payment_date date not null default current_date,
  notes text,
  created_at timestamp with time zone default now()
);

-- 5. Batch tagging on tables that record per-batch events.
alter table chicken_deaths    add column if not exists batch_id uuid references farm_batches(id) on delete set null;
alter table market_transactions add column if not exists batch_id uuid references farm_batches(id) on delete set null;

-- 6. RLS POLICIES — Supabase keeps RLS enforced on every public-schema table
--    exposed via PostgREST, so `disable row level security` is not enough.
--    Every table needs an explicit permissive policy for the anon key to work.
do $$
declare t text;
begin
  for t in select unnest(array[
    'products','farms','dispatches','dispatch_items','payments','expenses','stock_purchases',
    'customers','sales','sale_items','supply_payments','suppliers','supplier_dispatches',
    'supplier_payments','settings','cash_ledger','market_sellers','market_transactions',
    'chicken_deaths','choza_transactions','commission_cars','commission_customers',
    'commission_sales','commission_payments','commission_car_expenses','commission_dealers',
    'commission_dealer_payments','commission_fee_expenses','app_users','farm_batches',
    'market_seller_payments'
  ]) loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "Allow all" on %I', t);
    execute format('create policy "Allow all" on %I for all using (true) with check (true)', t);
  end loop;
end $$;

-- meel/feed dispatch sell price (profit tracking)
alter table supplier_dispatches add column if not exists sell_price_per_bag numeric default 0;
