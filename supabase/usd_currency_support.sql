-- USD currency support for medicine dispatches and POS sales.
--
-- Adds parallel USD columns on every table that tracks medicine transactions.
-- AFN behavior is unchanged; USD debt is tracked as an entirely separate
-- balance so a farm or walk-in customer can carry both an AFN debt and a USD
-- debt at the same time. Payments today are AFN-only (Royani converts USD
-- debt to AFN at the exchange rate when the customer pays). A future migration
-- will add a "convert USD debt to AFN" workflow.
--
-- Safe to re-run: everything is IF NOT EXISTS or ADD COLUMN IF NOT EXISTS.

-- ============================================================================
-- 1. Products — optional USD sell price for medicine
-- ============================================================================
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sell_price_usd NUMERIC;

-- ============================================================================
-- 2. Dispatch items — per-line currency and USD price snapshots
-- ============================================================================
ALTER TABLE dispatch_items
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'AFN',
  ADD COLUMN IF NOT EXISTS purchase_price_usd_at_time NUMERIC,
  ADD COLUMN IF NOT EXISTS sell_price_usd_at_time NUMERIC,
  ADD COLUMN IF NOT EXISTS total_amount_usd NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_profit_usd NUMERIC NOT NULL DEFAULT 0;

-- ============================================================================
-- 3. Dispatches — running USD total per invoice
-- ============================================================================
ALTER TABLE dispatches
  ADD COLUMN IF NOT EXISTS total_amount_usd NUMERIC NOT NULL DEFAULT 0;

-- ============================================================================
-- 4. Sale items — same columns as dispatch_items
-- ============================================================================
ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'AFN',
  ADD COLUMN IF NOT EXISTS purchase_price_usd_at_time NUMERIC,
  ADD COLUMN IF NOT EXISTS sell_price_usd_at_time NUMERIC,
  ADD COLUMN IF NOT EXISTS total_amount_usd NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_profit_usd NUMERIC NOT NULL DEFAULT 0;

-- ============================================================================
-- 5. Sales — USD totals + paid + remaining (parallel to AFN)
-- ============================================================================
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS total_amount_usd NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paid_usd NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_usd NUMERIC NOT NULL DEFAULT 0;

-- ============================================================================
-- 6. Farms — separate USD debt + USD profit
-- ============================================================================
ALTER TABLE farms
  ADD COLUMN IF NOT EXISTS total_debt_usd NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_profit_generated_usd NUMERIC NOT NULL DEFAULT 0;

-- ============================================================================
-- 7. Customers — separate USD debt
-- ============================================================================
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS total_debt_usd NUMERIC NOT NULL DEFAULT 0;

-- ============================================================================
-- 8. Update Phase 4 farm aggregate triggers to include USD
-- ============================================================================
-- The existing compute_farm_total_debt function already treats non-USD
-- dispatches correctly (it sums dispatches.total_amount which is the AFN
-- figure). Add a parallel function for USD, and extend the BEFORE UPDATE
-- trigger on farms to also enforce total_debt_usd and total_profit_generated_usd.

CREATE OR REPLACE FUNCTION compute_farm_total_debt_usd(p_farm_id UUID)
RETURNS NUMERIC
LANGUAGE sql STABLE AS $$
  -- Sum of USD dispatch amounts minus (future USD payments). Right now no USD
  -- payment path exists, so payment side is 0. Later we can subtract from a
  -- payments_usd table or a converted-to-AFN adjustment.
  SELECT GREATEST(0,
    COALESCE((SELECT SUM(total_amount_usd) FROM dispatches WHERE farm_id = p_farm_id), 0)
  );
$$;

CREATE OR REPLACE FUNCTION compute_farm_total_profit_usd(p_farm_id UUID)
RETURNS NUMERIC
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(SUM(di.total_profit_usd), 0)
  FROM dispatch_items di
  JOIN dispatches d ON d.id = di.dispatch_id
  WHERE d.farm_id = p_farm_id;
$$;

CREATE OR REPLACE FUNCTION enforce_farm_aggregates_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.total_debt := compute_farm_total_debt(NEW.id);
  NEW.total_profit_generated := compute_farm_total_profit(NEW.id);
  NEW.total_debt_usd := compute_farm_total_debt_usd(NEW.id);
  NEW.total_profit_generated_usd := compute_farm_total_profit_usd(NEW.id);
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 9. Grants
-- ============================================================================
GRANT EXECUTE ON FUNCTION compute_farm_total_debt_usd(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION compute_farm_total_profit_usd(UUID) TO anon, authenticated;
