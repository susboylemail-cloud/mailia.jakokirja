# Mailia Delivery Tracking System

This is a Finnish mail delivery tracking application for Imatra postal circuits with real-time multi-user support, offline capabilities, and SFTP integration.

## Architecture Overview

### Full-Stack Application
- **Frontend**: Vanilla JavaScript SPA with IndexedDB for offline storage
- **Backend**: Node.js/Express/TypeScript with PostgreSQL database
- **Real-time**: Socket.IO for cross-device synchronization
- **Data Flow**: REST API + WebSocket + offline sync queue

### Legacy Support
- Original frontend (`app.js`, `index.html`, `style.css`) still functional standalone
- CSV files (50+) serve as initial data source and fallback
- Backend migration enables multi-user, offline sync, and SFTP integration

## CSV Data Formats

The app handles two CSV formats:
- **Legacy format**: `"Sivu","Katu","Osoite","Nimi","Merkinnät"` (used by files like `KP3 DATA.csv`)
- **New format**: `Katu,Osoitenumero,Porras/Huom,Asunto,Tilaaja,Tilaukset` (used by files like `kp13.csv`)

Products are extracted from the "Merkinnät"/"Tilaukset" field and can be multi-line or comma-separated.

## Key Application Features

### Multi-User Backend System
- **Authentication**: JWT-based with refresh tokens (`backend/src/routes/auth.ts`)
- **Real-time Sync**: WebSocket server broadcasts changes across devices (`backend/src/services/websocket.ts`)
- **Offline Support**: Queue-based sync for offline operation (`backend/src/routes/sync.ts`)
- **Working Time Tracking**: Comprehensive time logging and reporting
- **Role-based Access**: Admin, manager, and driver roles with different permissions

### Circuit Management
- 50+ postal circuits with patterns: `KP3`, `KPR1`, `K28`, etc.
- Circuit data stored in PostgreSQL with full relational model
- CSV import service preserves original data structure (`backend/src/services/csvImport.ts`)
- Building addresses grouped automatically while preserving CSV order via `orderIndex`

### Route Tracking
- **Multi-user routes**: Each driver has independent route state
- **Real-time updates**: Route progress syncs across all connected devices
- **Route timing**: Database-backed start/end times per user per circuit per date
- **Delivery checkboxes**: Synced delivery status with conflict resolution
- **Route messages**: In-app communication for delivery issues and notes

### SFTP Integration
- **Automated polling**: Checks SFTP server every 15 minutes (configurable)
- **Subscription updates**: Detects new, modified, and cancelled subscriptions
- **Real-time broadcast**: Changes pushed to all connected clients instantly
- **Change tracking**: Full audit trail of subscription modifications
- **Service**: `backend/src/services/sftpSync.ts` handles file download and processing

### Product Categories
Products have specific color coding in CSS:
- `ES`/`ESLS`: Cyan (#17a2b8)
- `UV`: Light yellow (#fff9c4)  
- `HS`/`HSTS`/`MALA`: Light green (#c8e6c9)
- `STF`: Orange (#ff7f50)

## File Organization Patterns

- **Main app logic**: `app.js` (single 1000+ line file)
- **Styling**: `style.css` with CSS custom properties for theming
- **Circuit data**: CSV files with patterns `KP{number} DATA.csv` or `kp{number}.csv`
- **Navigation links**: Google Maps integration for route optimization

## Development Workflows

### Backend Setup
1. Install PostgreSQL and create database: `createdb mailia_db`
2. Run migrations: `psql -d mailia_db -f backend/database/schema.sql`
3. Install dependencies: `cd backend && npm install`
4. Configure `.env` from `.env.example` (database, JWT secrets, SFTP credentials)
5. Start dev server: `npm run dev` (runs on port 3000)

### CSV Data Import
- **Bulk import**: Import all CSV files into database using `backend/src/services/csvImport.ts`
- **Format detection**: Automatically detects old vs new CSV format
- **Preserves order**: Maintains delivery sequence via `order_index` field
- Both formats supported: old (`"Sivu","Katu","Osoite","Nimi","Merkinnät"`) and new (`Katu,Osoitenumero,Porras/Huom,Asunto,Tilaaja,Tilaukset`)

### Adding New Circuits
1. Add CSV file to root directory
2. Run CSV import service or add via backend API
3. Circuit automatically appears in frontend dropdown
4. Circuit ID extraction handled by `extractCircuitId()` in both frontend and backend

### Frontend Development
- Standalone mode still works without backend for testing
- API integration in progress - will replace localStorage calls
- WebSocket client connects with JWT token
- IndexedDB for offline storage and sync queue

### SFTP Configuration
- Edit `backend/.env` with SFTP credentials
- Set sync interval (cron format): `SFTP_SYNC_INTERVAL=*/15 * * * *`
- CSV format must match expected fields (circuit_id, street, number, etc.)
- View subscription changes at `/api/subscriptions/changes`

## LocalStorage Schema (Legacy - Being Migrated)

Critical localStorage keys (frontend-only mode):
- `mailiaAuth`: Authentication state (session-based)
- `darkMode`: Theme preference
- `hideStf`/`hideDelivered`: Filter states
- `lastResetDate`: Tracks daily reset
- `route_start_${circuit}`: Route start timestamp
- `route_end_${circuit}`: Route completion timestamp  
- `checkbox_${circuit}_${address}`: Individual delivery status

**Note**: These are being replaced by database storage and IndexedDB for offline sync.

## Backend Database Schema

### Core Tables
- **users**: Multi-user authentication (username, email, role, password_hash)
- **circuits**: Postal circuits (circuit_id, circuit_name)
- **subscribers**: Delivery addresses (circuit_id, address, building_address, order_index)
- **subscriber_products**: Products per subscriber (subscriber_id, product_code, quantity)
- **routes**: Daily delivery routes (user_id, circuit_id, route_date, start_time, end_time, status)
- **deliveries**: Individual address deliveries (route_id, subscriber_id, is_delivered, sync_status)
- **working_times**: Time tracking (user_id, work_date, start_time, end_time, total_hours)
- **subscription_changes**: SFTP import tracking (change_type, subscriber_data, processed)
- **sync_queue**: Offline sync queue (user_id, entity_type, action, data, sync_status)

### Key Patterns
- All timestamps use PostgreSQL `TIMESTAMP` type
- Soft deletes via `is_active` boolean flags
- Updated timestamps via triggers on `updated_at` columns
- Unique constraints prevent duplicate deliveries/routes per day
- Foreign keys with `ON DELETE CASCADE` for data integrity

## Integration Points

- **Google Maps**: Navigation links with formatted addresses for route optimization
- **Phone dialing**: Quick dial button in header (`tel:0503728330`)
- **Session management**: Authentication persists only during browser session

When modifying this codebase, maintain the single-file architecture, preserve CSV parsing compatibility for both formats, and ensure localStorage keys follow established patterns for proper daily reset functionality.