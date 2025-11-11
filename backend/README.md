# Mailia Backend Server

Backend server for the Mailia delivery tracking system with real-time synchronization, offline support, and SFTP integration for subscription management.

## Features

- **Multi-user Authentication**: JWT-based authentication with refresh tokens
- **Real-time Synchronization**: WebSocket support for live updates across devices
- **Offline-First Architecture**: Queue-based sync for offline operation
- **SFTP Integration**: Automated subscription data import from third-party systems
- **Working Time Tracking**: Comprehensive time tracking and reporting
- **RESTful API**: Complete API for circuit, route, and delivery management
- **PostgreSQL Database**: Robust data persistence with proper relations
- **Duplicate Overlap Guard**: CSV import detects cross-circuit building/unit overlaps and can skip non-whitelisted duplicates

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Real-time**: Socket.IO
- **Authentication**: JWT (jsonwebtoken)
- **File Transfer**: SSH2 SFTP Client
- **CSV Parsing**: csv-parse
- **Scheduling**: node-cron
- **Logging**: Winston

## Setup

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- SFTP server access (optional, for subscription sync)

### Installation

1. **Install dependencies**:
   ```bash
   cd backend
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   ```
   
  Edit `.env` with your configuration. For local development against a non-SSL Postgres, prefer discrete DB_* vars and disable SSL:
   ```env
  # Database (local dev)
  USE_DATABASE_URL=false
  DB_SSL=false
  DB_HOST=localhost
  DB_PORT=5432
  DB_NAME=mailia_db
  DB_USER=postgres
  DB_PASSWORD=yourlocalpassword
   
  # Alternatively for hosted environments (e.g. Heroku/Railway)
  # USE_DATABASE_URL=true
  # DATABASE_URL=postgresql://user:pass@host:5432/dbname
   
   # JWT Secrets
   JWT_SECRET=your-super-secret-jwt-key-change-this
   JWT_REFRESH_SECRET=your-refresh-secret-key
   
   # SFTP Configuration
   SFTP_HOST=sftp.example.com
   SFTP_USERNAME=mailia_user
   SFTP_PASSWORD=your_password
   SFTP_REMOTE_PATH=/subscriptions
   ```

3. **Create PostgreSQL database**:
   ```bash
   createdb mailia_db
   ```

4. **Run database migrations**:
   ```bash
   psql -d mailia_db -f database/schema.sql
   ```

5. (Optional) Configure duplicate overlap handling

  Create a `duplicates-whitelist.json` in the project root to mark intentional shared buildings/units:

  ```json
  {
    "buildings": ["keskuskatu 10"],
    "units": [ { "key": "keskuskatu 10|a|12", "circuits": ["KP18"], "reason": "shared entrance" } ]
  }
  ```

  During CSV import, overlaps not in this whitelist are skipped unless `IMPORT_ALLOW_OVERLAP=true`.

5. **Create initial admin user** (run in psql):
   ```sql
   INSERT INTO users (username, email, password_hash, full_name, role)
   VALUES (
       'admin',
       'admin@mailia.fi',
       '$2a$10$YourHashedPasswordHere',  -- Use bcrypt to hash
       'System Administrator',
       'admin'
   );
   ```

### Development

Start the development server with hot reload:

```bash
npm run dev
```

Server runs on `http://localhost:3000`

If you need to run the server detached from your terminal (e.g., to run quick local HTTP tests in the same shell), you can use:

```powershell
# Windows PowerShell
Start-Process -FilePath 'node' -ArgumentList 'dist/server.js' -WorkingDirectory '<repo>\backend'
```

### Windows PowerShell quick tests

Build, start (detached), health check:

```powershell
cd '<repo>\backend'
npm run build
Start-Process -FilePath 'node' -ArgumentList 'dist/server.js' -WorkingDirectory (Get-Location)
Invoke-RestMethod -Uri 'http://localhost:3000/health' -Method Get | ConvertTo-Json -Depth 3
```

Login and route lifecycle via PowerShell:

```powershell
# Login
$body = @{ username='admin'; password='admin123' } | ConvertTo-Json
$login = Invoke-RestMethod -Uri 'http://localhost:3000/api/auth/login' -Method Post -ContentType 'application/json' -Body $body
$login | ConvertTo-Json -Depth 5
$token = $login.accessToken

# Start route
$startBody = @{ circuitId='KP3'; routeDate=(Get-Date).ToString('yyyy-MM-dd') } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://localhost:3000/api/routes/start' -Headers @{ Authorization = "Bearer $token" } -Method Post -ContentType 'application/json' -Body $startBody | ConvertTo-Json -Depth 5

# Complete route (replace 123 with your route id)
Invoke-RestMethod -Uri 'http://localhost:3000/api/routes/123/complete' -Headers @{ Authorization = "Bearer $token" } -Method Post | ConvertTo-Json -Depth 5
```

Or use the included helper scripts (recommended to avoid quoting issues):

```powershell
# Login
node scripts/http-login.mjs 'http://localhost:3000' 'admin' 'admin123'

# Start a route for KP3 today
node scripts/start-route.mjs 'http://localhost:3000' 'admin' 'admin123' 'KP3'

# Complete route (replace <id>)
node scripts/complete-route.mjs 'http://localhost:3000' 'admin' 'admin123' <id>

# Watch WebSocket route:updated events
node scripts/ws-watch-route-updates.mjs 'http://localhost:3000' 'admin' 'admin123'
```

### Production

1. **Build TypeScript**:
   ```bash
   npm run build
   ```

2. **Start production server**:
   ```bash
   npm start
   ```

## API Documentation

### Authentication

#### POST `/api/auth/login`
Login with username and password.

**Request**:
```json
{
  "username": "driver1",
  "password": "password123"
}
```

**Response**:
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "user": {
    "id": 1,
    "username": "driver1",
    "email": "driver1@mailia.fi",
    "fullName": "John Doe",
    "role": "driver"
  }
}
```

#### POST `/api/auth/refresh`
Refresh access token using refresh token.

#### POST `/api/auth/logout`
Logout and invalidate refresh token.

#### GET `/api/auth/me`
Get current user information (requires authentication).

### Circuits

#### GET `/api/circuits`
Get all active circuits with subscriber counts.

#### GET `/api/circuits/:circuitId`
Get circuit details with all subscribers and products.

### Routes

#### GET `/api/routes`
Get user's routes. Query params: `date`, `status`

#### POST `/api/routes/start`
Start a new route.

**Request**:
```json
{
  "circuitId": "KP3",
  "routeDate": "2025-11-10"
}
```

#### POST `/api/routes/:routeId/complete`
Mark route as completed.

### Deliveries

#### POST `/api/deliveries/update`
Update delivery status.

**Request**:
```json
{
  "routeId": 123,
  "subscriberId": 456,
  "isDelivered": true,
  "notes": "Left at door"
}
```

#### GET `/api/deliveries/route/:routeId`
Get all deliveries for a route.

### Working Times

#### POST `/api/working-times/start`
Record work start time.

#### POST `/api/working-times/end`
Record work end time with optional break duration.

#### GET `/api/working-times`
Get user's working times. Query params: `startDate`, `endDate`

#### GET `/api/working-times/all`
Get all users' working times (admin/manager only).

### Subscriptions

#### GET `/api/subscriptions/changes`
Get subscription changes from SFTP (admin/manager only).

#### POST `/api/subscriptions/changes/:id/process`
Mark subscription change as processed.

### Sync

#### POST `/api/sync/queue`
Submit offline changes for synchronization.

**Request**:
```json
{
  "items": [
    {
      "clientId": "temp-123",
      "entity_type": "delivery",
      "action": "update",
      "data": { ... },
      "client_timestamp": "2025-11-10T10:30:00Z"
    }
  ]
}
```

#### GET `/api/sync/pending`
Get pending sync items for user.

## WebSocket Events

### Client → Server

- `delivery:update` - Update delivery status
- `route:update` - Update route status
- `workingTime:update` - Update working time
- `message:send` - Send route message
- `sync:request` - Request data sync
- `route:join` - Join route room
- `route:leave` - Leave route room

### Server → Client

- `delivery:updated` - Delivery status changed
- `route:updated` - Route status changed
- `workingTime:updated` - Working time changed
- `message:received` - New route message
- `subscription:changed` - Subscription data changed (SFTP)
- `sync:acknowledged` - Sync request acknowledged
- `sync:completed` - Sync operation completed

### Connection

```javascript
const socket = io('http://localhost:3000', {
  auth: {
    token: 'your-jwt-access-token'
  }
});

socket.on('connect', () => {
  console.log('Connected to WebSocket');
  socket.emit('route:join', routeId);
});

socket.on('delivery:updated', (data) => {
  console.log('Delivery updated:', data);
});
```

## SFTP Integration

The backend automatically polls the SFTP server for new subscription files at the configured interval (default: every 15 minutes).

### Configuration

Set these environment variables:

```env
SFTP_HOST=sftp.example.com
SFTP_PORT=22
SFTP_USERNAME=mailia_user
SFTP_PASSWORD=your_password
SFTP_REMOTE_PATH=/subscriptions
SFTP_LOCAL_PATH=./data/sftp_downloads
SFTP_SYNC_INTERVAL=*/15 * * * *
```

### Manual Sync

Trigger manual SFTP sync:

```bash
npm run sftp:sync
```

### CSV Format

The SFTP service accepts CSV files with these fields:

```csv
circuit_id,street,number,stairwell,apartment,name,products,status
KP3,ENSONTIE,33,A,4,John Doe,"UV,HS",active
```

## Database Schema

### Key Tables

- **users** - User accounts and roles
- **circuits** - Postal circuits
- **subscribers** - Delivery addresses
- **subscriber_products** - Products for each subscriber
- **routes** - Daily delivery routes
- **deliveries** - Individual address deliveries
- **working_times** - Time tracking
- **subscription_changes** - SFTP import tracking
- **sync_queue** - Offline sync queue

## Offline Support

The system uses a queue-based sync mechanism:

1. **Offline**: Changes stored in client's IndexedDB
2. **Online**: Client sends queued items to `/api/sync/queue`
3. **Server**: Processes each item and updates database
4. **Real-time**: WebSocket broadcasts changes to all connected clients

### Conflict Resolution

- Last-write-wins for simple updates
- Server timestamp used as authoritative source
- Conflicts marked in `sync_queue` table for manual review

## Logging

Logs are stored in `./logs/` directory:

- `error.log` - Error messages only
- `combined.log` - All log messages

View logs in development:

```bash
tail -f logs/combined.log
```

## Security

- **JWT Authentication**: All API endpoints require valid JWT
- **Role-based Access**: Admin/manager routes protected
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Helmet**: Security headers enabled
- **Password Hashing**: bcrypt with salt rounds = 10
- **SQL Injection**: Parameterized queries only

## Deployment

### Using PM2

```bash
npm install -g pm2
pm2 start dist/server.js --name mailia-backend
pm2 save
pm2 startup
```

### Using Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

## Troubleshooting

### Database connection fails

Check PostgreSQL is running and credentials are correct:

```bash
psql -U postgres -d mailia_db
```

If you see "The server does not support SSL connections" in logs when running locally, ensure:

- `USE_DATABASE_URL=false` and `DB_SSL=false` are set in `.env`
- You restarted the server after changing `.env`

### SFTP sync not working

Test SFTP connection manually:

```bash
sftp username@sftp.example.com
```

Verify SFTP credentials in `.env` file.

### WebSocket not connecting

Ensure CORS is configured for your frontend URL in `.env`:

```env
CLIENT_URL=http://localhost:5500
```

### CSV import skips addresses

If you see `High-risk overlap` warnings in logs, the importer detected an address overlapping another circuit.

- If intentional, add it to `duplicates-whitelist.json` (project root) and re-run the import.
- To force accept temporarily, set `IMPORT_ALLOW_OVERLAP=true` in environment.

To create a review list and suggestions:

```bash
node scripts/find-duplicates.js
node scripts/remediate-duplicates.js --write-suggestions
```

Review `remediation-report.csv` and curate `duplicates-whitelist.json` using `duplicates-whitelist.suggestions.json` as a starting point.

## License

MIT
