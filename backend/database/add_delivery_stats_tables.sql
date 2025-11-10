-- Add tables for storing historical delivery statistics

-- Monthly delivery statistics (resets each month, stored for history)
CREATE TABLE IF NOT EXISTS monthly_delivery_stats (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    circuit_id VARCHAR(50),
    total_addresses INTEGER DEFAULT 0,
    total_papers INTEGER DEFAULT 0,
    delivered_addresses INTEGER DEFAULT 0,
    delivered_papers INTEGER DEFAULT 0,
    routes_count INTEGER DEFAULT 0,
    completed_routes INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_month_circuit UNIQUE(year, month, circuit_id)
);

-- Yearly delivery statistics (full calendar year, stored for history)
CREATE TABLE IF NOT EXISTS yearly_delivery_stats (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    circuit_id VARCHAR(50),
    total_addresses INTEGER DEFAULT 0,
    total_papers INTEGER DEFAULT 0,
    delivered_addresses INTEGER DEFAULT 0,
    delivered_papers INTEGER DEFAULT 0,
    routes_count INTEGER DEFAULT 0,
    completed_routes INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_year_circuit UNIQUE(year, circuit_id)
);

-- Daily delivery snapshots (for tracking daily totals)
CREATE TABLE IF NOT EXISTS daily_delivery_stats (
    id SERIAL PRIMARY KEY,
    stat_date DATE NOT NULL,
    circuit_id VARCHAR(50),
    total_addresses INTEGER DEFAULT 0,
    total_papers INTEGER DEFAULT 0,
    delivered_addresses INTEGER DEFAULT 0,
    delivered_papers INTEGER DEFAULT 0,
    routes_count INTEGER DEFAULT 0,
    completed_routes INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_date_circuit UNIQUE(stat_date, circuit_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_monthly_stats_year_month ON monthly_delivery_stats(year, month);
CREATE INDEX IF NOT EXISTS idx_monthly_stats_circuit ON monthly_delivery_stats(circuit_id);
CREATE INDEX IF NOT EXISTS idx_yearly_stats_year ON yearly_delivery_stats(year);
CREATE INDEX IF NOT EXISTS idx_yearly_stats_circuit ON yearly_delivery_stats(circuit_id);
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_delivery_stats(stat_date);
CREATE INDEX IF NOT EXISTS idx_daily_stats_circuit ON daily_delivery_stats(circuit_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_delivery_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for auto-updating timestamps
DROP TRIGGER IF EXISTS update_monthly_delivery_stats_updated_at ON monthly_delivery_stats;
CREATE TRIGGER update_monthly_delivery_stats_updated_at
    BEFORE UPDATE ON monthly_delivery_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_delivery_stats_updated_at();

DROP TRIGGER IF EXISTS update_yearly_delivery_stats_updated_at ON yearly_delivery_stats;
CREATE TRIGGER update_yearly_delivery_stats_updated_at
    BEFORE UPDATE ON yearly_delivery_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_delivery_stats_updated_at();

DROP TRIGGER IF EXISTS update_daily_delivery_stats_updated_at ON daily_delivery_stats;
CREATE TRIGGER update_daily_delivery_stats_updated_at
    BEFORE UPDATE ON daily_delivery_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_delivery_stats_updated_at();
