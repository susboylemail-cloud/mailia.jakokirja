# PowerShell script to set Mapon API key in Heroku
# Run this script to configure the Mapon GPS API integration on Heroku

Write-Host "Setting Mapon API key in Heroku..." -ForegroundColor Cyan

# Set the API key
heroku config:set MAPON_API_KEY=b6a5ce738b76b134d06e8b072a754918019a9ed7

Write-Host "`nVerifying configuration..." -ForegroundColor Cyan

# Verify it's set
$apiKey = heroku config:get MAPON_API_KEY

if ($apiKey -eq "b6a5ce738b76b134d06e8b072a754918019a9ed7") {
    Write-Host "✅ MAPON_API_KEY successfully configured!" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to set MAPON_API_KEY" -ForegroundColor Red
    exit 1
}

Write-Host "`nCurrent Heroku config:" -ForegroundColor Cyan
heroku config

Write-Host "`n✅ Mapon GPS integration is now configured!" -ForegroundColor Green
Write-Host "Next: Deploy to activate the changes" -ForegroundColor Yellow
Write-Host "  git push heroku main" -ForegroundColor White
