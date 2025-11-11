-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(20) DEFAULT 'driver' CHECK (role IN ('admin', 'driver', 'manager')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Refresh tokens for JWT authentication
CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Circuits table
CREATE TABLE circuits (
    id SERIAL PRIMARY KEY,
    circuit_id VARCHAR(20) UNIQUE NOT NULL,
    circuit_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subscribers table
CREATE TABLE subscribers (
    id SERIAL PRIMARY KEY,
    circuit_id INTEGER REFERENCES circuits(id) ON DELETE CASCADE,
    address VARCHAR(255) NOT NULL,
    building_address VARCHAR(255),
    name VARCHAR(255),
    apartment VARCHAR(50),
    stairwell VARCHAR(50),
    order_index INTEGER,
    key_info TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(circuit_id, address)
);

-- Products for each subscriber
CREATE TABLE subscriber_products (
    id SERIAL PRIMARY KEY,
    subscriber_id INTEGER REFERENCES subscribers(id) ON DELETE CASCADE,
    product_code VARCHAR(20) NOT NULL,
    quantity INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Routes (daily delivery routes)
CREATE TABLE routes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    circuit_id INTEGER REFERENCES circuits(id) ON DELETE CASCADE,
    route_date DATE NOT NULL,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    status VARCHAR(20) DEFAULT 'not-started' CHECK (status IN ('not-started', 'in-progress', 'completed', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, circuit_id, route_date)
);

-- Deliveries (tracking individual address deliveries)
CREATE TABLE deliveries (
    id SERIAL PRIMARY KEY,
    route_id INTEGER REFERENCES routes(id) ON DELETE CASCADE,
    subscriber_id INTEGER REFERENCES subscribers(id) ON DELETE CASCADE,
    delivered_at TIMESTAMP,
    is_delivered BOOLEAN DEFAULT false,
    notes TEXT,
    sync_status VARCHAR(20) DEFAULT 'synced' CHECK (sync_status IN ('pending', 'synced', 'conflict')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(route_id, subscriber_id)
);

-- Working times tracking
CREATE TABLE working_times (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    total_hours DECIMAL(5,2),
    break_duration INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subscription changes from SFTP
CREATE TABLE subscription_changes (
    id SERIAL PRIMARY KEY,
    circuit_id INTEGER REFERENCES circuits(id) ON DELETE SET NULL,
    change_type VARCHAR(20) CHECK (change_type IN ('new', 'modified', 'cancelled')),
    subscriber_data JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP,
    source_file VARCHAR(255),
    sftp_timestamp TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sync queue for offline changes
CREATE TABLE sync_queue (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER,
    action VARCHAR(20) CHECK (action IN ('create', 'update', 'delete')),
    data JSONB NOT NULL,
    client_timestamp TIMESTAMP NOT NULL,
    synced_at TIMESTAMP,
    sync_status VARCHAR(20) DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed', 'conflict')),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Route messages for communication
CREATE TABLE route_messages (
    id SERIAL PRIMARY KEY,
    route_id INTEGER REFERENCES routes(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    message_type VARCHAR(20) CHECK (message_type IN ('note', 'issue', 'alert')),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_circuits_circuit_id ON circuits(circuit_id);
CREATE INDEX idx_subscribers_circuit_id ON subscribers(circuit_id);
CREATE INDEX idx_subscribers_address ON subscribers(address);
CREATE INDEX idx_routes_user_date ON routes(user_id, route_date);
CREATE INDEX idx_routes_circuit_date ON routes(circuit_id, route_date);
CREATE INDEX idx_deliveries_route_id ON deliveries(route_id);
CREATE INDEX idx_working_times_user_date ON working_times(user_id, work_date);
CREATE INDEX idx_subscription_changes_processed ON subscription_changes(processed);
CREATE INDEX idx_sync_queue_user_status ON sync_queue(user_id, sync_status);
CREATE INDEX idx_route_messages_route_id ON route_messages(route_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_circuits_updated_at BEFORE UPDATE ON circuits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscribers_updated_at BEFORE UPDATE ON subscribers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriber_products_updated_at BEFORE UPDATE ON subscriber_products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON routes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_deliveries_updated_at BEFORE UPDATE ON deliveries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_working_times_updated_at BEFORE UPDATE ON working_times FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
