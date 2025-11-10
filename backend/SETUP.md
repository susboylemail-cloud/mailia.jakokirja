# Mailia Backend - Quick Start Guide

## 🚀 Quick Setup

### 1. Install Dependencies

```powershell
cd backend
npm install
```

### 2. Set Up PostgreSQL Database

**Install PostgreSQL** (if not already installed):
- Download from: https://www.postgresql.org/download/windows/
- Or use chocolatey: `choco install postgresql`

**Create database**:
```powershell
# Using psql command line
psql -U postgres
CREATE DATABASE mailia_db;
\q
```

**Run migrations**:
```powershell
psql -U postgres -d mailia_db -f database/schema.sql
```

### 3. Configure Environment

**Copy environment template**:
```powershell
cp .env.example .env
```

**Edit `.env` file** with your settings:
```env
# Database
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/mailia_db
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mailia_db
DB_USER=postgres
DB_PASSWORD=YOUR_PASSWORD

# JWT Secrets (generate random strings)
JWT_SECRET=super-secret-key-change-in-production-12345
JWT_REFRESH_SECRET=refresh-secret-key-also-change-12345

# SFTP (optional - configure later if needed)
SFTP_HOST=your-sftp-server.com
SFTP_USERNAME=your_username
SFTP_PASSWORD=your_password
```

### 4. Create First Admin User

**Generate password hash** (using Node.js):
```javascript
// Run in Node.js REPL: node
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('admin123', 10);
console.log(hash);
// Copy the output hash
```

**Insert admin user**:
```sql
-- Run in psql
psql -U postgres -d mailia_db

INSERT INTO users (username, email, password_hash, full_name, role)
VALUES (
    'admin',
    'admin@mailia.fi',
    '$2a$10$PASTE_YOUR_HASH_HERE',
    'System Administrator',
    'admin'
);
```

### 5. Import CSV Data

**Option A: Import all CSV files from root directory**:
```typescript
// Create a script: backend/scripts/import-csv.ts
import { importAllCSVFiles } from '../src/services/csvImport';
import path from 'path';

const rootDir = path.join(__dirname, '../../');
importAllCSVFiles(rootDir).then(() => {
    console.log('Import completed');
    process.exit(0);
}).catch(error => {
    console.error('Import failed:', error);
    process.exit(1);
});
```

**Run the import**:
```powershell
npx ts-node backend/scripts/import-csv.ts
```

### 6. Start the Server

**Development mode** (with hot reload):
```powershell
npm run dev
```

**Production mode**:
```powershell
npm run build
npm start
```

Server will run on: `http://localhost:3000`

### 7. Test the API

**Health check**:
```powershell
curl http://localhost:3000/health
```

**Login**:
```powershell
curl -X POST http://localhost:3000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"username":"admin","password":"admin123"}'
```

**Get circuits** (using token from login):
```powershell
curl http://localhost:3000/api/circuits `
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 📱 Frontend Integration

### Update Frontend to Use Backend

**Connect to WebSocket**:
```javascript
// In app.js, after login
const socket = io('http://localhost:3000', {
    auth: { token: accessToken }
});

socket.on('connect', () => {
    console.log('Connected to backend');
});

socket.on('delivery:updated', (data) => {
    console.log('Delivery update received:', data);
    // Update UI
});
```

**Replace localStorage calls with API**:
```javascript
// Before: localStorage
const startTime = localStorage.getItem(`route_start_${circuitId}`);

// After: API call
const response = await fetch(`http://localhost:3000/api/routes?circuitId=${circuitId}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
});
const routes = await response.json();
```

## 🔧 Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Solution**: Start PostgreSQL service:
```powershell
# Windows Services
services.msc
# Find "postgresql" and start it

# Or via command line
net start postgresql-x64-14
```

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::3000
```
**Solution**: Change port in `.env`:
```env
PORT=3001
```

### TypeScript Errors
```
Cannot find module 'express'
```
**Solution**: Reinstall dependencies:
```powershell
rm -r node_modules
rm package-lock.json
npm install
```

### SFTP Connection Fails
**Solution**: 
1. Verify SFTP credentials in `.env`
2. Test connection: `sftp username@hostname`
3. Disable SFTP temporarily: Remove `ENABLE_SFTP_SYNC=true` from `.env`

## 📚 Next Steps

1. **Import existing CSV data** into database
2. **Create driver accounts** via `/api/auth/register` endpoint
3. **Configure SFTP** for subscription updates
4. **Update frontend** to use backend APIs
5. **Test offline sync** with IndexedDB

## 🔐 Security Checklist

Before deploying to production:

- [ ] Change JWT_SECRET and JWT_REFRESH_SECRET to random values
- [ ] Use strong database password
- [ ] Enable HTTPS (not HTTP)
- [ ] Configure CORS for your domain only
- [ ] Set NODE_ENV=production
- [ ] Review and update rate limiting settings
- [ ] Set up proper logging and monitoring
- [ ] Configure backup strategy for database

## 📖 Documentation

- **API Reference**: `backend/README.md`
- **Database Schema**: `backend/database/schema.sql`
- **Frontend Guide**: `../README.md`
- **Copilot Instructions**: `../.github/copilot-instructions.md`

## 🆘 Need Help?

Check the logs:
```powershell
# View all logs
cat logs/combined.log

# View errors only
cat logs/error.log

# Follow logs in real-time
Get-Content logs/combined.log -Wait
```
