-- Create the wallet_recharges table in your Supabase database
-- Run this SQL in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS wallet_recharges (
    id BIGSERIAL PRIMARY KEY,
    user_address TEXT NOT NULL,
    credited_amount NUMERIC NOT NULL,
    tx_hash TEXT UNIQUE NOT NULL,
    network TEXT DEFAULT 'polygon-amoy',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index for faster queries
CREATE INDEX IF NOT EXISTS idx_wallet_recharges_user_address
ON wallet_recharges(user_address);

CREATE INDEX IF NOT EXISTS idx_wallet_recharges_tx_hash
ON wallet_recharges(tx_hash);

-- Enable Row Level Security (optional)
ALTER TABLE wallet_recharges ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow all operations (you can make this more restrictive)
CREATE POLICY "Allow all operations on wallet_recharges"
ON wallet_recharges
FOR ALL
USING (true)
WITH CHECK (true);