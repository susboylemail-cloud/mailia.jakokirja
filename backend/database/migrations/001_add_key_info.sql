-- Migration: Add key_info column to subscribers table
-- Date: 2025-11-11

-- Add key_info column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subscribers' AND column_name = 'key_info'
    ) THEN
        ALTER TABLE subscribers ADD COLUMN key_info TEXT;
        RAISE NOTICE 'Added key_info column to subscribers table';
    ELSE
        RAISE NOTICE 'key_info column already exists';
    END IF;
END $$;
