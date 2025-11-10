# Mailia Heroku Deployment Script (Windows PowerShell)
# Run this script to deploy to Heroku

Write-Host "🚀 Mailia Heroku Deployment Script" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Check if Heroku CLI is installed
$herokuCheck = Get-Command heroku -ErrorAction SilentlyContinue
if (-not $herokuCheck) {
    Write-Host "❌ Heroku CLI not found. Please install it from:" -ForegroundColor Red
    Write-Host "   https://devcenter.heroku.com/articles/heroku-cli" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Heroku CLI found" -ForegroundColor Green
Write-Host ""

# Login to Heroku
Write-Host "📝 Logging into Heroku..." -ForegroundColor Yellow
heroku login

# Create app (if not exists)
$APP_NAME = Read-Host "Enter your Heroku app name (e.g., mailia-tracker)"

$appExists = heroku apps:info -a $APP_NAME 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ App '$APP_NAME' already exists" -ForegroundColor Green
} else {
    Write-Host "Creating new Heroku app..." -ForegroundColor Yellow
    heroku create $APP_NAME
}

# Add PostgreSQL
Write-Host ""
Write-Host "📊 Setting up PostgreSQL database..." -ForegroundColor Yellow
$addons = heroku addons -a $APP_NAME 2>&1
if ($addons -match "heroku-postgresql") {
    Write-Host "✅ PostgreSQL already added" -ForegroundColor Green
} else {
    heroku addons:create heroku-postgresql:mini -a $APP_NAME
}

# Set environment variables
Write-Host ""
Write-Host "🔐 Setting environment variables..." -ForegroundColor Yellow

# Generate random JWT secrets (PowerShell method)
$JWT_SECRET = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
$JWT_REFRESH_SECRET = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})

heroku config:set `
    NODE_ENV=production `
    JWT_SECRET="$JWT_SECRET" `
    JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET" `
    JWT_EXPIRES_IN=15m `
    JWT_REFRESH_EXPIRES_IN=7d `
    CLIENT_URL="https://$APP_NAME.herokuapp.com" `
    RATE_LIMIT_WINDOW_MS=900000 `
    RATE_LIMIT_MAX_REQUESTS=100 `
    -a $APP_NAME

Write-Host "✅ Environment variables set" -ForegroundColor Green

# Deploy
Write-Host ""
Write-Host "🚀 Deploying to Heroku..." -ForegroundColor Yellow

# Try main branch first, fall back to master
git push heroku main 2>&1
if ($LASTEXITCODE -ne 0) {
    git push heroku master
}

# Wait for deployment
Write-Host ""
Write-Host "⏳ Waiting for deployment to complete..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Run database migration
Write-Host ""
Write-Host "📊 Running database migrations..." -ForegroundColor Yellow
Get-Content backend\database\schema.sql | heroku pg:psql -a $APP_NAME

Write-Host ""
Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📱 Your app is available at: https://$APP_NAME.herokuapp.com" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Create admin user: heroku run bash -a $APP_NAME"
Write-Host "   Then run: cd backend && npm run create:admin"
Write-Host "2. Import circuit data: cd backend && npm run import:csv"
Write-Host "3. View logs: heroku logs --tail -a $APP_NAME"
Write-Host ""
Write-Host "🎉 Deployment successful!" -ForegroundColor Green
