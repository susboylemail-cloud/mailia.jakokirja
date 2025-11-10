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
   
   Edit `.env` with your configuration:
   ```env
   # Database
   DATABASE_URL=postgresql://postgres:password@localhost:5432/mailia_db
   
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

## License

MIT
