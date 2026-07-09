-- Store Cash tracking — every AFN in/out through the till.
-- Amount is always positive; direction is on `type`.
-- Source + reference_id let us find and reverse the row if the
-- originating transaction is edited or deleted.

CREATE TABLE IF NOT EXISTS store_cash_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric NOT NULL CHECK (amount >= 0),
  type text NOT NULL CHECK (type IN ('in', 'out', 'opening_balance', 'adjustment_in', 'adjustment_out')),
  source text,            -- 'payment' | 'expense' | 'supplier_payment' | 'walk_in_sale'
                          --   | 'cash_ledger' | 'opening' | 'manual' | ...
  reference_id uuid,      -- optional link to the originating row (payments.id, etc.)
  note text,
  transaction_date date NOT NULL DEFAULT current_date,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_cash_source_ref
  ON store_cash_transactions (source, reference_id);

ALTER TABLE store_cash_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON store_cash_transactions;
CREATE POLICY "Allow all" ON store_cash_transactions FOR ALL USING (true) WITH CHECK (true);
