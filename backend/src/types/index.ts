export interface User {
    id: number;
    username: string;
    email: string;
    password_hash: string;
    full_name?: string;
    role: 'admin' | 'driver' | 'manager';
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface Circuit {
    id: number;
    circuit_id: string;
    circuit_name: string;
    description?: string;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface Subscriber {
    id: number;
    circuit_id: number;
    address: string;
    building_address?: string;
    name?: string;
    apartment?: string;
    stairwell?: string;
    order_index?: number;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
    products?: SubscriberProduct[];
}

export interface SubscriberProduct {
    id: number;
    subscriber_id: number;
    product_code: string;
    quantity: number;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface Route {
    id: number;
    user_id: number;
    circuit_id: number;
    route_date: Date;
    start_time?: Date;
    end_time?: Date;
    status: 'not-started' | 'in-progress' | 'completed' | 'cancelled';
    notes?: string;
    created_at: Date;
    updated_at: Date;
}

export interface Delivery {
    id: number;
    route_id: number;
    subscriber_id: number;
    delivered_at?: Date;
    is_delivered: boolean;
    notes?: string;
    sync_status: 'pending' | 'synced' | 'conflict';
    created_at: Date;
    updated_at: Date;
}

export interface WorkingTime {
    id: number;
    user_id: number;
    work_date: Date;
    start_time: Date;
    end_time?: Date;
    total_hours?: number;
    break_duration: number;
    notes?: string;
    created_at: Date;
    updated_at: Date;
}

export interface SubscriptionChange {
    id: number;
    circuit_id?: number;
    change_type: 'new' | 'modified' | 'cancelled';
    subscriber_data: any;
    processed: boolean;
    processed_at?: Date;
    source_file?: string;
    sftp_timestamp?: Date;
    created_at: Date;
}

export interface SyncQueueItem {
    id: number;
    user_id: number;
    entity_type: string;
    entity_id?: number;
    action: 'create' | 'update' | 'delete';
    data: any;
    client_timestamp: Date;
    synced_at?: Date;
    sync_status: 'pending' | 'synced' | 'failed' | 'conflict';
    error_message?: string;
    created_at: Date;
}

export interface RouteMessage {
    id: number;
    route_id: number;
    user_id: number;
    message_type: 'note' | 'issue' | 'alert';
    message: string;
    is_read: boolean;
    created_at: Date;
}

export interface JWTPayload {
    userId: number;
    username: string;
    role: string;
}
