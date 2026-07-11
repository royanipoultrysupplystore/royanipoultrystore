-- Phase 4 — farm aggregate triggers.
--
-- Makes farms.total_debt and farms.total_profit_generated impossible to drift.
-- Every source table (dispatches, payments, supply_payments, farm_batches,
-- dispatch_items) fires an AFTER trigger that recomputes the parent farm's
-- aggregates from scratch. Additionally, a BEFORE UPDATE trigger on farms
-- itself refuses any write that would set the aggregate columns to a value
-- that disagrees with the live calculation — so even buggy app code cannot
-- drift these columns going forward.
--
-- Also adds a BEFORE INSERT/UPDATE trigger on dispatch_items that refuses
-- any operation which would over-dispatch a supplier bill (dispatched > bought).
--
-- Safe to re-run. Everything is CREATE OR REPLACE.
--
-- After running this, use recompute_all_farms() ONCE to fix historical drift.

-- ============================================================================
-- 1. Pure computation functions — the source of truth
-- ============================================================================

-- Correct farms.total_debt for one farm.
--   = max(0, Σ dispatches + Σ supply + Σ (batches × price) − Σ payments)
CREATE OR REPLACE FUNCTION compute_farm_total_debt(p_farm_id UUID)
RETURNS NUMERIC
LANGUAGE sql STABLE AS $$
  SELECT GREATEST(0,
      COALESCE((SELECT SUM(total_amount) FROM dispatches WHERE farm_id = p_farm_id), 0)
    + COALESCE((SELECT SUM(amount) FROM supply_payments WHERE farm_id = p_farm_id), 0)
    + COALESCE((SELECT SUM(COALESCE(initial_chicken_count, 0) * COALESCE(price_per_chicken, 0))
                FROM farm_batches WHERE farm_id = p_farm_id), 0)
    - COALESCE((SELECT SUM(amount) FROM payments WHERE farm_id = p_farm_id), 0)
  );
$$;

-- Correct farms.total_profit_generated for one farm.
--   = Σ dispatch_items.total_profit joined to that farm's dispatches
CREATE OR REPLACE FUNCTION compute_farm_total_profit(p_farm_id UUID)
RETURNS NUMERIC
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(SUM(di.total_profit), 0)
  FROM dispatch_items di
  JOIN dispatches d ON d.id = di.dispatch_id
  WHERE d.farm_id = p_farm_id;
$$;

-- ============================================================================
-- 2. BEFORE UPDATE trigger on farms — refuses to persist wrong aggregate values
-- ============================================================================
--
-- If any application code (or manual SQL) tries to UPDATE farms with a
-- total_debt or total_profit_generated that disagrees with the live math,
-- this trigger silently overrides the write with the correct value.
--
-- This is the safety net: even a bug in a hook, or a forgotten increment, or
-- a mistaken manual UPDATE cannot leave a wrong number in the row.
CREATE OR REPLACE FUNCTION enforce_farm_aggregates_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.total_debt := compute_farm_total_debt(NEW.id);
  NEW.total_profit_generated := compute_farm_total_profit(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_farm_aggregates_before_update ON farms;
CREATE TRIGGER trg_enforce_farm_aggregates_before_update
BEFORE UPDATE ON farms
FOR EACH ROW
EXECUTE FUNCTION enforce_farm_aggregates_before_update();

-- ============================================================================
-- 3. AFTER-change triggers on source tables — force the parent farm to
--    recompute whenever a source row changes
-- ============================================================================
--
-- Each source table (dispatches, payments, supply_payments, farm_batches,
-- dispatch_items) has an AFTER INSERT/UPDATE/DELETE trigger that issues a
-- no-op UPDATE on the affected farm row. That UPDATE fires the BEFORE UPDATE
-- trigger above, which sets the correct aggregate value.

-- Helper: safely UPDATE a farm to fire the BEFORE trigger recompute.
CREATE OR REPLACE FUNCTION touch_farm(p_farm_id UUID)
RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  IF p_farm_id IS NOT NULL THEN
    -- WHERE id = ... satisfies pg-safeupdate. The SET is a no-op — the BEFORE
    -- trigger will replace whatever we set with the correct computed value.
    UPDATE farms SET total_debt = total_debt WHERE id = p_farm_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION dispatches_touch_farm()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM touch_farm(OLD.farm_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND OLD.farm_id IS DISTINCT FROM NEW.farm_id THEN
    PERFORM touch_farm(OLD.farm_id);
    PERFORM touch_farm(NEW.farm_id);
    RETURN NEW;
  ELSE
    PERFORM touch_farm(NEW.farm_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispatches_touch_farm ON dispatches;
CREATE TRIGGER trg_dispatches_touch_farm
AFTER INSERT OR UPDATE OR DELETE ON dispatches
FOR EACH ROW
EXECUTE FUNCTION dispatches_touch_farm();

CREATE OR REPLACE FUNCTION payments_touch_farm()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN PERFORM touch_farm(OLD.farm_id); RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND OLD.farm_id IS DISTINCT FROM NEW.farm_id THEN
    PERFORM touch_farm(OLD.farm_id); PERFORM touch_farm(NEW.farm_id); RETURN NEW;
  ELSE PERFORM touch_farm(NEW.farm_id); RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_touch_farm ON payments;
CREATE TRIGGER trg_payments_touch_farm
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW
EXECUTE FUNCTION payments_touch_farm();

CREATE OR REPLACE FUNCTION supply_payments_touch_farm()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN PERFORM touch_farm(OLD.farm_id); RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND OLD.farm_id IS DISTINCT FROM NEW.farm_id THEN
    PERFORM touch_farm(OLD.farm_id); PERFORM touch_farm(NEW.farm_id); RETURN NEW;
  ELSE PERFORM touch_farm(NEW.farm_id); RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_supply_payments_touch_farm ON supply_payments;
CREATE TRIGGER trg_supply_payments_touch_farm
AFTER INSERT OR UPDATE OR DELETE ON supply_payments
FOR EACH ROW
EXECUTE FUNCTION supply_payments_touch_farm();

CREATE OR REPLACE FUNCTION farm_batches_touch_farm()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN PERFORM touch_farm(OLD.farm_id); RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND OLD.farm_id IS DISTINCT FROM NEW.farm_id THEN
    PERFORM touch_farm(OLD.farm_id); PERFORM touch_farm(NEW.farm_id); RETURN NEW;
  ELSE PERFORM touch_farm(NEW.farm_id); RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_farm_batches_touch_farm ON farm_batches;
CREATE TRIGGER trg_farm_batches_touch_farm
AFTER INSERT OR UPDATE OR DELETE ON farm_batches
FOR EACH ROW
EXECUTE FUNCTION farm_batches_touch_farm();

-- dispatch_items joins to farm via dispatches → look up dispatch's farm_id
CREATE OR REPLACE FUNCTION dispatch_items_touch_farm()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_old_farm UUID;
  v_new_farm UUID;
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    SELECT farm_id INTO v_new_farm FROM dispatches WHERE id = NEW.dispatch_id;
    PERFORM touch_farm(v_new_farm);
  END IF;
  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    SELECT farm_id INTO v_old_farm FROM dispatches WHERE id = OLD.dispatch_id;
    IF v_old_farm IS DISTINCT FROM v_new_farm THEN
      PERFORM touch_farm(v_old_farm);
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispatch_items_touch_farm ON dispatch_items;
CREATE TRIGGER trg_dispatch_items_touch_farm
AFTER INSERT OR UPDATE OR DELETE ON dispatch_items
FOR EACH ROW
EXECUTE FUNCTION dispatch_items_touch_farm();

-- ============================================================================
-- 4. Over-dispatch prevention on dispatch_items
-- ============================================================================
--
-- Refuse any INSERT or UPDATE on dispatch_items that would cause the summed
-- dispatched quantity for a supplier_dispatch (bill) to exceed the bill's
-- purchased quantity. Enforced at the database level so no application code
-- (or manual SQL) can create phantom bags.

CREATE OR REPLACE FUNCTION prevent_over_dispatch()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_bought NUMERIC;
  v_dispatched NUMERIC;
  v_bill_id UUID;
  v_quantity NUMERIC;
BEGIN
  v_bill_id := NEW.supplier_dispatch_id;
  v_quantity := COALESCE(NEW.quantity, 0);
  IF v_bill_id IS NULL OR v_quantity <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT quantity INTO v_bought FROM supplier_dispatches WHERE id = v_bill_id;
  IF v_bought IS NULL THEN RETURN NEW; END IF;

  -- Sum of all OTHER dispatch_items on this bill (exclude the row we're
  -- INSERT/UPDATE-ing so an edit isn't measured against its own old value).
  SELECT COALESCE(SUM(quantity), 0) INTO v_dispatched
  FROM dispatch_items
  WHERE supplier_dispatch_id = v_bill_id
    AND (TG_OP = 'INSERT' OR id != NEW.id);

  IF v_dispatched + v_quantity > v_bought THEN
    RAISE EXCEPTION 'Over-dispatch refused: bill % has only % bags left (dispatching %). Adjust bill quantity or reduce this dispatch.',
      v_bill_id, (v_bought - v_dispatched), v_quantity
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_over_dispatch ON dispatch_items;
CREATE TRIGGER trg_prevent_over_dispatch
BEFORE INSERT OR UPDATE ON dispatch_items
FOR EACH ROW
EXECUTE FUNCTION prevent_over_dispatch();

-- ============================================================================
-- 5. One-shot bulk recompute — fixes historical drift after triggers install
-- ============================================================================
--
-- Iterates every farm and touches it, causing the BEFORE UPDATE trigger to
-- overwrite total_debt and total_profit_generated with the correct live math.
-- Return value is how many farm rows were updated.

CREATE OR REPLACE FUNCTION recompute_all_farms()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE farms SET total_debt = total_debt WHERE id IS NOT NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================================
-- 6. Grants — the anon key (used by the app) must be able to call the
--    RPC-callable functions.
-- ============================================================================

GRANT EXECUTE ON FUNCTION compute_farm_total_debt(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION compute_farm_total_profit(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION recompute_all_farms() TO anon, authenticated;
