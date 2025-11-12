# Git Setup Script for Windows
# This script will help you install Git and pull the latest changes

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Git Setup for Mailia Project" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if Git is already installed
try {
    $gitVersion = git --version 2>$null
    Write-Host "Git is already installed!" -ForegroundColor Green
    Write-Host $gitVersion -ForegroundColor White
    $gitInstalled = $true
} catch {
    Write-Host "Git is not installed" -ForegroundColor Yellow
    $gitInstalled = $false
}

if (-not $gitInstalled) {
    Write-Host ""
    Write-Host "OPTION 1: Install Git via Winget (Recommended)" -ForegroundColor Cyan
    Write-Host "Run this command:" -ForegroundColor White
    Write-Host "  winget install --id Git.Git -e --source winget" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "OPTION 2: Download Git manually" -ForegroundColor Cyan
    Write-Host "Visit: https://git-scm.com/download/win" -ForegroundColor White
    Write-Host ""
    
    $choice = Read-Host "Try installing via winget now? (y/n)"
    
    if ($choice -eq 'y') {
        Write-Host "Installing Git..." -ForegroundColor Yellow
        winget install --id Git.Git -e --source winget
        Write-Host "Please restart PowerShell and run this script again." -ForegroundColor Yellow
        exit
    }
    exit
}

Write-Host ""
Write-Host "Checking Git configuration..." -ForegroundColor Cyan

$gitUserName = git config --global user.name 2>$null
$gitUserEmail = git config --global user.email 2>$null

if ([string]::IsNullOrWhiteSpace($gitUserName)) {
    $userName = Read-Host "Enter your name for Git commits"
    git config --global user.name "$userName"
    Write-Host "User name configured" -ForegroundColor Green
}

if ([string]::IsNullOrWhiteSpace($gitUserEmail)) {
    $userEmail = Read-Host "Enter your email for Git commits"
    git config --global user.email "$userEmail"
    Write-Host "User email configured" -ForegroundColor Green
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Pulling Latest Changes" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan

Write-Host "Fetching from GitHub..." -ForegroundColor Yellow
git fetch origin

Write-Host "Pulling changes..." -ForegroundColor Yellow
git pull origin main

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "All latest features are now in your local files:" -ForegroundColor Green
Write-Host "- Floating Action Button (FAB)" -ForegroundColor White
Write-Host "- Pull-to-refresh" -ForegroundColor White
Write-Host "- Haptic feedback" -ForegroundColor White
Write-Host "- Multi-language support" -ForegroundColor White
Write-Host "- 4 themes" -ForegroundColor White
Write-Host "- Skeleton screens" -ForegroundColor White
Write-Host "- Success animations" -ForegroundColor White
Write-Host "- GPS tracking" -ForegroundColor White
Write-Host ""

