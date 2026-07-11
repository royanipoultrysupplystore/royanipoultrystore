-- Reconciliation setup — Phase 3.
-- Safe to re-run. Everything is CREATE IF NOT EXISTS / CREATE OR REPLACE.
--
-- Every reconciliation write goes through the RPCs below. They ALWAYS snapshot
-- the current stored value into integrity_backups BEFORE overwriting it, so
-- every fix can be undone row-by-row or batch-by-batch.

-- 1. Snapshot / audit table for every reconciliation write
CREATE TABLE IF NOT EXISTS integrity_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  column_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  section TEXT NOT NULL,             -- 'farms' | 'customers' | 'products'
  reconciled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reconciled_by TEXT,
  undone_at TIMESTAMPTZ               -- populated by undo_reconcile_batch
);

CREATE INDEX IF NOT EXISTS idx_integrity_backups_batch ON integrity_backups(batch_id);
CREATE INDEX IF NOT EXISTS idx_integrity_backups_section ON integrity_backups(section);

-- 2. Reconcile ONE farm's total_debt to the value the client computed from
--    raw transactions. Snapshots old value first.
CREATE OR REPLACE FUNCTION reconcile_farm_debt(
  p_farm_id UUID,
  p_new_debt NUMERIC,
  p_batch_id UUID,
  p_user_name TEXT
)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_old NUMERIC;
BEGIN
  SELECT total_debt INTO v_old FROM farms WHERE id = p_farm_id;
  IF v_old IS NULL THEN RETURN 0; END IF;

  INSERT INTO integrity_backups(batch_id, table_name, row_id, column_name, old_value, new_value, section, reconciled_by)
  VALUES (p_batch_id, 'farms', p_farm_id::text, 'total_debt', v_old::text, p_new_debt::text, 'farms', p_user_name);

  UPDATE farms SET total_debt = p_new_debt WHERE id = p_farm_id;
  RETURN 1;
END;
$$;

-- 3. Reconcile ONE walk-in customer's total_debt
CREATE OR REPLACE FUNCTION reconcile_customer_debt(
  p_customer_id UUID,
  p_new_debt NUMERIC,
  p_batch_id UUID,
  p_user_name TEXT
)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_old NUMERIC;
BEGIN
  SELECT total_debt INTO v_old FROM customers WHERE id = p_customer_id;
  IF v_old IS NULL THEN RETURN 0; END IF;

  INSERT INTO integrity_backups(batch_id, table_name, row_id, column_name, old_value, new_value, section, reconciled_by)
  VALUES (p_batch_id, 'customers', p_customer_id::text, 'total_debt', v_old::text, p_new_debt::text, 'customers', p_user_name);

  UPDATE customers SET total_debt = p_new_debt WHERE id = p_customer_id;
  RETURN 1;
END;
$$;

-- 4. Reconcile ONE product's stored quantity to the bills-minus-dispatched value
CREATE OR REPLACE FUNCTION reconcile_product_quantity(
  p_product_id UUID,
  p_new_qty NUMERIC,
  p_batch_id UUID,
  p_user_name TEXT
)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_old NUMERIC;
BEGIN
  SELECT quantity INTO v_old FROM products WHERE id = p_product_id;
  IF v_old IS NULL THEN RETURN 0; END IF;

  INSERT INTO integrity_backups(batch_id, table_name, row_id, column_name, old_value, new_value, section, reconciled_by)
  VALUES (p_batch_id, 'products', p_product_id::text, 'quantity', v_old::text, p_new_qty::text, 'products', p_user_name);

  UPDATE products SET quantity = p_new_qty WHERE id = p_product_id;
  RETURN 1;
END;
$$;

-- 5. Undo an entire reconciliation batch. Restores every stored value from the
--    snapshot rows and marks them as undone (kept for audit).
CREATE OR REPLACE FUNCTION undo_reconcile_batch(p_batch_id UUID)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rec RECORD;
  v_count INT := 0;
BEGIN
  FOR v_rec IN
    SELECT * FROM integrity_backups
    WHERE batch_id = p_batch_id AND undone_at IS NULL
  LOOP
    IF v_rec.table_name = 'farms' AND v_rec.column_name = 'total_debt' THEN
      UPDATE farms SET total_debt = v_rec.old_value::numeric WHERE id = v_rec.row_id::uuid;
    ELSIF v_rec.table_name = 'customers' AND v_rec.column_name = 'total_debt' THEN
      UPDATE customers SET total_debt = v_rec.old_value::numeric WHERE id = v_rec.row_id::uuid;
    ELSIF v_rec.table_name = 'products' AND v_rec.column_name = 'quantity' THEN
      UPDATE products SET quantity = v_rec.old_value::numeric WHERE id = v_rec.row_id::uuid;
    ELSE
      CONTINUE;
    END IF;
    v_count := v_count + 1;
  END LOOP;
  UPDATE integrity_backups SET undone_at = NOW()
    WHERE batch_id = p_batch_id AND undone_at IS NULL;
  RETURN v_count;
END;
$$;

-- 6. Grants — the anon key must be able to call these from the app.
GRANT EXECUTE ON FUNCTION reconcile_farm_debt(UUID, NUMERIC, UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION reconcile_customer_debt(UUID, NUMERIC, UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION reconcile_product_quantity(UUID, NUMERIC, UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION undo_reconcile_batch(UUID) TO anon, authenticated;
