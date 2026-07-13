-- Phase B — USD support extended to farm payments and Store Cash.
--
-- Farm payments become currency-aware: an AFN payment reduces farms.total_debt,
-- a USD payment reduces farms.total_debt_usd. Store Cash gains a parallel USD
-- balance so cash physically kept in dollars can be tracked independently.
--
-- Safe to re-run: everything is IF NOT EXISTS or CREATE OR REPLACE.

-- ============================================================================
-- 1. Payments — currency flag + USD amount
-- ============================================================================
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'AFN',
  ADD COLUMN IF NOT EXISTS amount_usd NUMERIC NOT NULL DEFAULT 0;

-- ============================================================================
-- 2. Store cash transactions — currency flag
-- ============================================================================
--   AFN row: currency = 'AFN', amount is AFN
--   USD row: currency = 'USD', amount is USD (dollars, not cents)
-- Balance is computed per-currency by summing rows with matching currency.
ALTER TABLE store_cash_transactions
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'AFN';

-- ============================================================================
-- 3. Extend Phase 4 farm USD debt trigger to subtract USD payments
-- ============================================================================
--   USD debt = Σ dispatches.total_amount_usd − Σ payments.amount_usd (currency=USD)
--   Clamped at zero so an over-payment doesn't create a negative balance.
CREATE OR REPLACE FUNCTION compute_farm_total_debt_usd(p_farm_id UUID)
RETURNS NUMERIC
LANGUAGE sql STABLE AS $$
  SELECT GREATEST(0,
      COALESCE((SELECT SUM(total_amount_usd) FROM dispatches WHERE farm_id = p_farm_id), 0)
    - COALESCE((SELECT SUM(amount_usd) FROM payments
                WHERE farm_id = p_farm_id AND currency = 'USD'), 0)
  );
$$;

-- Payments already fires touch_farm() via the existing AFTER trigger. That will
-- pick up USD payments too because it forwards farm_id regardless of currency.

GRANT EXECUTE ON FUNCTION compute_farm_total_debt_usd(UUID) TO anon, authenticated;
