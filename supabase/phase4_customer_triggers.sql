-- Phase 4 (part 2) — customer aggregate triggers.
--
-- Makes customers.total_debt, customers.total_debt_usd, and
-- customers.total_purchases impossible to drift, using the same pattern as
-- the farm triggers: pure compute functions, a BEFORE UPDATE trigger that
-- overrides any wrong write with the correct value, and an AFTER trigger on
-- the source table (sales) that forces the customer row to recompute.
--
-- After running this, use recompute_all_customers() ONCE to fix historical
-- drift; from then on the triggers keep everything correct on every
-- insert/update/delete.
--
-- Safe to re-run — everything is CREATE OR REPLACE / DROP IF EXISTS.

-- ============================================================================
-- 1. Pure computation functions
-- ============================================================================

CREATE OR REPLACE FUNCTION compute_customer_total_debt(p_customer_id UUID)
RETURNS NUMERIC
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(SUM(remaining), 0)
  FROM sales
  WHERE customer_id = p_customer_id;
$$;

CREATE OR REPLACE FUNCTION compute_customer_total_debt_usd(p_customer_id UUID)
RETURNS NUMERIC
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(SUM(remaining_usd), 0)
  FROM sales
  WHERE customer_id = p_customer_id;
$$;

CREATE OR REPLACE FUNCTION compute_customer_total_purchases(p_customer_id UUID)
RETURNS NUMERIC
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(SUM(total_amount), 0)
  FROM sales
  WHERE customer_id = p_customer_id;
$$;

-- ============================================================================
-- 2. BEFORE UPDATE trigger on customers — enforces correct aggregates
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_customer_aggregates_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.total_debt := compute_customer_total_debt(NEW.id);
  NEW.total_debt_usd := compute_customer_total_debt_usd(NEW.id);
  NEW.total_purchases := compute_customer_total_purchases(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_customer_aggregates_before_update ON customers;
CREATE TRIGGER trg_enforce_customer_aggregates_before_update
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION enforce_customer_aggregates_before_update();

-- ============================================================================
-- 3. AFTER trigger on sales — touches the affected customer to fire recompute
-- ============================================================================

CREATE OR REPLACE FUNCTION touch_customer(p_customer_id UUID)
RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  IF p_customer_id IS NOT NULL THEN
    -- No-op UPDATE. The BEFORE UPDATE trigger overrides the assignment with
    -- the correct recomputed values.
    UPDATE customers SET total_debt = total_debt WHERE id = p_customer_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION sales_touch_customer()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM touch_customer(OLD.customer_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND OLD.customer_id IS DISTINCT FROM NEW.customer_id THEN
    -- Sale moved between customers — recompute both.
    PERFORM touch_customer(OLD.customer_id);
    PERFORM touch_customer(NEW.customer_id);
    RETURN NEW;
  ELSE
    PERFORM touch_customer(NEW.customer_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_touch_customer ON sales;
CREATE TRIGGER trg_sales_touch_customer
AFTER INSERT OR UPDATE OR DELETE ON sales
FOR EACH ROW
EXECUTE FUNCTION sales_touch_customer();

-- ============================================================================
-- 4. One-shot bulk recompute — fixes historical drift after triggers install
-- ============================================================================

CREATE OR REPLACE FUNCTION recompute_all_customers()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE customers SET total_debt = total_debt WHERE id IS NOT NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================================
-- 5. Grants
-- ============================================================================
GRANT EXECUTE ON FUNCTION compute_customer_total_debt(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION compute_customer_total_debt_usd(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION compute_customer_total_purchases(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION recompute_all_customers() TO anon, authenticated;
