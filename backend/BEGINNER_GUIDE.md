# 🚀 Complete Beginner's Setup Guide for Mailia Backend

This guide assumes you have ZERO prior experience with backend development. We'll install everything step-by-step.

---

## Step 1: Install Node.js

Node.js is the runtime that lets you run JavaScript on your computer (not just in browsers).

### Download and Install

1. **Go to**: https://nodejs.org/
2. **Download**: The **LTS** version (Long Term Support) - currently v20.x
3. **Run the installer**: 
   - Click through the setup wizard
   - ✅ Accept the license agreement
   - ✅ Use default installation path
   - ✅ Check "Automatically install necessary tools" (this installs chocolatey)
   - Click "Install"
4. **Restart your computer** after installation

### Verify Installation

Open PowerShell and type:
```powershell
node --version
npm --version
```

You should see version numbers like:
```
v20.10.0
10.2.3
```

✅ **If you see version numbers, Node.js is installed!**

---

## Step 2: Install PostgreSQL Database

PostgreSQL is the database where we'll store all delivery data.

### Download and Install

1. **Go to**: https://www.postgresql.org/download/windows/
2. **Click**: "Download the installer"
3. **Download**: Latest version (PostgreSQL 16.x)
4. **Run the installer**:
   - Select components: ✅ PostgreSQL Server, ✅ pgAdmin 4, ✅ Command Line Tools
   - Choose installation directory: Use default
   - **Set a password**: Choose a password you'll remember (e.g., `postgres123`)
   - **WRITE DOWN THIS PASSWORD** - you'll need it later!
   - Port: Keep default `5432`
   - Locale: Keep default
   - Click through to finish

### Verify Installation

Open PowerShell and type:
```powershell
psql --version
```

You should see:
```
psql (PostgreSQL) 16.x
```

✅ **If you see this, PostgreSQL is installed!**

---

## Step 3: Install Dependencies

Now let's install all the packages the backend needs.

### Open PowerShell in the Backend Folder

1. **Open File Explorer**
2. **Navigate to**: `C:\Users\occab\OneDrive\Tiedostot\jakokirja\mailia.jakokirja\backend`
3. **In the address bar**, type `powershell` and press Enter
4. A PowerShell window opens in that folder

### Install npm Packages

In the PowerShell window, type:
```powershell
npm install
```

**What happens**: This downloads ~200MB of code libraries (it takes 2-5 minutes)

You'll see lots of output like:
```
added 523 packages in 3m
```

✅ **When it says "added X packages", installation is complete!**

---

## Step 4: Create the Database

Now we'll create the actual database where data will be stored.

### Method A: Using Command Line (Easier)

In PowerShell, type:
```powershell
psql -U postgres
```

**It will ask for password**: Enter the password you set during PostgreSQL installation

Then type these commands one by one:
```sql
CREATE DATABASE mailia_db;
\q
```

### Method B: Using pgAdmin (Visual)

1. **Open pgAdmin 4** (installed with PostgreSQL)
2. **Enter master password** if asked (same as your PostgreSQL password)
3. **Expand** "Servers" → "PostgreSQL 16" in the left panel
4. **Right-click** "Databases" → "Create" → "Database"
5. **Database name**: `mailia_db`
6. **Click** "Save"

✅ **You should now see `mailia_db` in the database list!**

---

## Step 5: Run Database Migrations

Migrations create all the tables (users, circuits, deliveries, etc.) in the database.

### In PowerShell (in the backend folder):

```powershell
psql -U postgres -d mailia_db -f database/schema.sql
```

**Enter password** when prompted.

You'll see lots of output like:
```
CREATE TABLE
CREATE TABLE
CREATE INDEX
...
```

✅ **When you see "CREATE TRIGGER" messages, migrations are done!**

---

## Step 6: Configure Environment Variables

Environment variables are like settings for your app (database password, secrets, etc.)

### Create .env File

In PowerShell (in backend folder):
```powershell
Copy-Item .env.example .env
```

### Edit .env File

1. **Open** `.env` file with Notepad:
   ```powershell
   notepad .env
   ```

2. **Change these lines** (replace with YOUR values):
   ```env
   # Database - CHANGE THIS PASSWORD to match your PostgreSQL password
   DB_PASSWORD=postgres123
   
   # JWT Secrets - CHANGE THESE to random strings
   JWT_SECRET=my-super-secret-key-12345-change-this
   JWT_REFRESH_SECRET=my-refresh-secret-67890-change-this
   
   # SFTP - Leave as-is for now (you'll configure this later)
   SFTP_HOST=sftp.example.com
   SFTP_USERNAME=your_username
   SFTP_PASSWORD=your_password
   ```

3. **Save and close** Notepad

✅ **.env file is configured!**

---

## Step 7: Create Your First Admin User

This creates an account you can log in with.

### In PowerShell (in backend folder):

```powershell
npm run create:admin
```

This creates:
- **Username**: `admin`
- **Password**: `admin123`
- **Email**: `admin@mailia.fi`

You'll see output like:
```
Creating admin user...
Admin user created successfully:
{
  "id": 1,
  "username": "admin",
  "email": "admin@mailia.fi",
  "role": "admin"
}
```

✅ **You can now login as `admin` with password `admin123`!**

**Want a custom username?** Run:
```powershell
npm run create:admin myusername mypassword myemail@example.com "My Full Name"
```

---

## Step 8: Import CSV Data

This loads all your existing CSV files (KP3 DATA.csv, etc.) into the database.

### In PowerShell (in backend folder):

```powershell
npm run import:csv
```

You'll see:
```
Scanning directory for CSV files: C:\Users\occab\OneDrive\Tiedostot\jakokirja\mailia.jakokirja
Found 50 CSV files
Importing CSV file: KP3 DATA.csv as circuit KP3
Parsed 45 subscribers from KP3 DATA.csv
Imported circuit KP3 with 45 subscribers
...
CSV import completed
```

✅ **All your circuits and subscribers are now in the database!**

---

## Step 9: Start the Backend Server

Time to run your backend!

### In PowerShell (in backend folder):

```powershell
npm run dev
```

You'll see:
```
Server running on port 3000
Environment: development
Client URL: http://localhost:5500
WebSocket server initialized
```

✅ **Your backend is running!** 

**Keep this PowerShell window open** - this is your server running.

---

## Step 10: Test the Backend

Let's make sure everything works!

### Open a NEW PowerShell window

**Test 1: Health Check**
```powershell
curl http://localhost:3000/health
```

Expected output:
```json
{"status":"ok","timestamp":"2025-11-10T..."}
```

### Test 2: Login

```powershell
$body = @{
    username = "admin"
    password = "admin123"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

Expected output:
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "user": {
    "id": 1,
    "username": "admin",
    ...
  }
}
```

### Test 3: Get Circuits (using token from login)

```powershell
# Save the token from previous response
$token = "PASTE_YOUR_ACCESS_TOKEN_HERE"

Invoke-RestMethod -Uri "http://localhost:3000/api/circuits" `
    -Headers @{ Authorization = "Bearer $token" }
```

Expected: List of all your circuits!

✅ **If all tests pass, your backend is working perfectly!**

---

## 📊 Understanding What You've Built

### What's Running?

- **PostgreSQL**: Database running in the background (stores all data)
- **Node.js Backend**: Your API server (handles requests, processes data)
- **WebSocket Server**: Real-time communication (syncs across devices)

### How It Works

```
Frontend (Browser)
    ↓
HTTP Requests → Backend API (localhost:3000)
    ↓
PostgreSQL Database (stores data)
```

### Important URLs

- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health
- **API Docs**: See `backend/README.md`

---

## 🐛 Troubleshooting

### ❌ "Cannot find module 'express'"

**Problem**: npm packages not installed  
**Solution**: Run `npm install` in backend folder

### ❌ "ECONNREFUSED 127.0.0.1:5432"

**Problem**: PostgreSQL not running  
**Solution**: 
1. Open Services (press Win+R, type `services.msc`)
2. Find "postgresql-x64-16"
3. Right-click → Start

### ❌ "password authentication failed"

**Problem**: Wrong database password in .env  
**Solution**: Edit `.env` and set `DB_PASSWORD` to your PostgreSQL password

### ❌ "Port 3000 already in use"

**Problem**: Another app is using port 3000  
**Solution**: 
1. Edit `.env`
2. Change `PORT=3000` to `PORT=3001`
3. Restart backend

### ❌ Can't run PowerShell scripts

**Problem**: Script execution disabled  
**Solution**:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 🎯 Quick Reference

### Start Backend
```powershell
cd backend
npm run dev
```

### Stop Backend
Press `Ctrl+C` in the PowerShell window

### View Logs
```powershell
Get-Content logs/combined.log -Tail 50
```

### Create New User
```powershell
npm run create:admin username password email "Full Name"
```

### Re-import CSV Data
```powershell
npm run import:csv
```

---

## ✅ Checklist

After following this guide, you should have:

- [x] Node.js installed and working
- [x] PostgreSQL installed and running
- [x] Backend dependencies installed
- [x] Database created (mailia_db)
- [x] Database tables created (migrations)
- [x] .env file configured
- [x] Admin user created
- [x] CSV data imported
- [x] Backend server running
- [x] API tested and working

---

## 🎓 Next Steps

Now that your backend is running, you can:

1. **Test with Postman**: Download Postman to test API endpoints visually
2. **Explore the database**: Use pgAdmin to browse your data
3. **Read API docs**: Check `backend/README.md` for all endpoints
4. **Integrate frontend**: Connect your frontend app to use the backend

---

## 📞 Need More Help?

- Check logs: `backend/logs/combined.log`
- Read docs: `backend/README.md`
- Review schema: `backend/database/schema.sql`

---

**🎉 Congratulations! You've set up a professional backend server!**
