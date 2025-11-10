#!/bin/bash

# Mailia Heroku Deployment Script
# Run this script to deploy to Heroku

echo "🚀 Mailia Heroku Deployment Script"
echo "===================================="
echo ""

# Check if Heroku CLI is installed
if ! command -v heroku &> /dev/null; then
    echo "❌ Heroku CLI not found. Please install it from:"
    echo "   https://devcenter.heroku.com/articles/heroku-cli"
    exit 1
fi

echo "✅ Heroku CLI found"
echo ""

# Login to Heroku
echo "📝 Logging into Heroku..."
heroku login

# Create app (if not exists)
read -p "Enter your Heroku app name (e.g., mailia-tracker): " APP_NAME

if heroku apps:info -a $APP_NAME &> /dev/null; then
    echo "✅ App '$APP_NAME' already exists"
else
    echo "Creating new Heroku app..."
    heroku create $APP_NAME
fi

# Add PostgreSQL
echo ""
echo "📊 Setting up PostgreSQL database..."
if heroku addons -a $APP_NAME | grep -q "heroku-postgresql"; then
    echo "✅ PostgreSQL already added"
else
    heroku addons:create heroku-postgresql:mini -a $APP_NAME
fi

# Set environment variables
echo ""
echo "🔐 Setting environment variables..."

# Generate random JWT secrets
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
JWT_REFRESH_SECRET=$(openssl rand -base64 64 | tr -d '\n')

heroku config:set \
    NODE_ENV=production \
    JWT_SECRET="$JWT_SECRET" \
    JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET" \
    JWT_EXPIRES_IN=15m \
    JWT_REFRESH_EXPIRES_IN=7d \
    CLIENT_URL="https://$APP_NAME.herokuapp.com" \
    RATE_LIMIT_WINDOW_MS=900000 \
    RATE_LIMIT_MAX_REQUESTS=100 \
    -a $APP_NAME

echo "✅ Environment variables set"

# Deploy
echo ""
echo "🚀 Deploying to Heroku..."
git push heroku main || git push heroku master

# Wait for deployment
echo ""
echo "⏳ Waiting for deployment to complete..."
sleep 10

# Run database migration
echo ""
echo "📊 Running database migrations..."
heroku pg:psql -a $APP_NAME < backend/database/schema.sql

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📱 Your app is available at: https://$APP_NAME.herokuapp.com"
echo ""
echo "Next steps:"
echo "1. Create admin user: heroku run bash -a $APP_NAME"
echo "   Then run: cd backend && npm run create:admin"
echo "2. Import circuit data: cd backend && npm run import:csv"
echo "3. View logs: heroku logs --tail -a $APP_NAME"
echo ""
echo "🎉 Deployment successful!"
