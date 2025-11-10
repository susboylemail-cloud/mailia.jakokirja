# Heroku Deployment Guide

## Prerequisites

1. **Heroku Account**: Sign up at [heroku.com](https://heroku.com)
2. **Heroku CLI**: Install from [devcenter.heroku.com/articles/heroku-cli](https://devcenter.heroku.com/articles/heroku-cli)
3. **Git**: Ensure your code is in a git repository

## Step-by-Step Deployment

### 1. Login to Heroku

```bash
heroku login
```

### 2. Create Heroku App

```bash
cd c:\Users\occab\OneDrive\Tiedostot\jakokirja\mailia.jakokirja
heroku create mailia-delivery-tracker
```

Replace `mailia-delivery-tracker` with your preferred app name (must be unique).

### 3. Add PostgreSQL Database

```bash
heroku addons:create heroku-postgresql:mini
```

This creates a PostgreSQL database and sets the `DATABASE_URL` environment variable automatically.

### 4. Set Environment Variables

```bash
# JWT Secrets (CHANGE THESE!)
heroku config:set JWT_SECRET="your-very-long-random-secret-key-here"
heroku config:set JWT_REFRESH_SECRET="another-very-long-random-secret-key"

# Node Environment
heroku config:set NODE_ENV=production

# Your app URL (replace with your actual Heroku app URL)
heroku config:set CLIENT_URL=https://mailia-delivery-tracker.herokuapp.com

# Rate limiting
heroku config:set RATE_LIMIT_WINDOW_MS=900000
heroku config:set RATE_LIMIT_MAX_REQUESTS=100

# JWT expiration
heroku config:set JWT_EXPIRES_IN=15m
heroku config:set JWT_REFRESH_EXPIRES_IN=7d
```

### 5. Update Database Configuration

The backend needs to be updated to use Heroku's `DATABASE_URL`. Edit `backend/src/config/database.ts`:

```typescript
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Heroku provides DATABASE_URL in production
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
    } : false
});

export default pool;
```

### 6. Initialize Database Schema

After first deployment, run database migrations:

```bash
# Get the DATABASE_URL
heroku config:get DATABASE_URL

# Run schema migration
heroku pg:psql < backend/database/schema.sql
```

### 7. Create Admin User

After database is set up, create an admin user:

```bash
heroku run bash
cd backend
npm run create:admin
# Follow prompts to create admin user
exit
```

### 8. Deploy to Heroku

```bash
# Add and commit all changes
git add .
git commit -m "Configure for Heroku deployment"

# Push to Heroku
git push heroku main
```

If your default branch is `master`:
```bash
git push heroku master
```

### 9. Open Your App

```bash
heroku open
```

### 10. View Logs

To monitor your application:

```bash
heroku logs --tail
```

## Import Circuit Data

After deployment, import your CSV circuit data:

```bash
heroku run bash
cd backend
npm run import:csv
exit
```

## Updating the App

To deploy updates:

```bash
git add .
git commit -m "Your update message"
git push heroku main
```

## Troubleshooting

### Check App Status
```bash
heroku ps
```

### View Environment Variables
```bash
heroku config
```

### Restart App
```bash
heroku restart
```

### Database Access
```bash
heroku pg:psql
```

### View Logs
```bash
heroku logs --tail
```

## Cost Estimation

- **Heroku Dyno**: $7/month (Eco dyno) or $25/month (Basic)
- **PostgreSQL**: $5/month (Mini plan) - 10,000 rows limit
- **Total**: ~$12-30/month

For production use with more data, consider upgrading to Standard plans.

## Security Checklist

- [x] Change JWT secrets from defaults
- [x] Set NODE_ENV=production
- [x] Enable HTTPS (automatic on Heroku)
- [x] Rate limiting configured
- [x] Helmet security headers enabled
- [ ] Set up monitoring/alerts
- [ ] Configure backup strategy

## Alternative: Fly.io (Free Tier Available)

If you need a free option, consider Fly.io which offers free tier:
https://fly.io/docs/postgres/

## Custom Domain (Optional)

To use your own domain:

```bash
heroku domains:add www.yourdomain.com
```

Then configure DNS according to Heroku's instructions.
