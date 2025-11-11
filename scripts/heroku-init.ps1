param(
    [Parameter(Mandatory = $true)]
    [string]$AppName,

    [string]$AdminUser = 'admin',
    [string]$AdminPassword = 'admin123',
    [string]$AdminEmail = 'admin@mailia.fi',
    [string]$AdminFullName = 'Admin User',

    [switch]$SkipConfig
)

Write-Host "[Mailia] Heroku bootstrap starting for app '$AppName'" -ForegroundColor Cyan

$herokuCli = Get-Command heroku -ErrorAction SilentlyContinue
if (-not $herokuCli) {
    Write-Host "ERROR: Heroku CLI not found in PATH." -ForegroundColor Red
    Write-Host "       Install from https://devcenter.heroku.com/articles/heroku-cli" -ForegroundColor Yellow
    exit 1
}

function Assert-LastExit() {
    param(
        [string]$Message
    )
    if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: $Message" -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

function Ensure-ConfigValue {
    param(
        [string]$Key,
        [string]$Value,
        [bool]$IsSecret = $false
    )

    $existing = heroku config:get $Key -a $AppName 2>$null
    if ($LASTEXITCODE -ne 0) {
    Write-Host "   WARN: Could not read config var $Key (is the app name correct?)." -ForegroundColor Yellow
        exit 1
    }

    if ([string]::IsNullOrWhiteSpace($existing)) {
        $display = $Value
        if ($IsSecret) {
            $display = '<generated>'
        }
    Write-Host "   Setting $Key = $display"
        heroku config:set $Key=$Value -a $AppName | Out-Null
        Assert-LastExit "Failed to set $Key"
    }
    else {
    Write-Host "   $Key already set" -ForegroundColor Green
    }
}

Write-Host "Checking that the Heroku app exists..."
heroku apps:info -a $AppName > $null
Assert-LastExit "App '$AppName' was not found. Create it first via 'heroku create $AppName'."
Write-Host "   App found" -ForegroundColor Green

if (-not $SkipConfig) {
    Write-Host "Ensuring required config vars are set..."

    # Deterministic defaults
    Ensure-ConfigValue -Key 'NODE_ENV' -Value 'production'
    Ensure-ConfigValue -Key 'USE_DATABASE_URL' -Value 'true'
    Ensure-ConfigValue -Key 'CLIENT_URL' -Value "https://$AppName.herokuapp.com"
    Ensure-ConfigValue -Key 'RATE_LIMIT_WINDOW_MS' -Value '900000'
    Ensure-ConfigValue -Key 'RATE_LIMIT_MAX_REQUESTS' -Value '100'
    Ensure-ConfigValue -Key 'JWT_EXPIRES_IN' -Value '15m'
    Ensure-ConfigValue -Key 'JWT_REFRESH_EXPIRES_IN' -Value '7d'

    function New-RandomSecret {
        param([int]$Length = 64)
        $chars = ('A'..'Z') + ('a'..'z') + ('0'..'9')
        -join (1..$Length | ForEach-Object { $chars | Get-Random })
    }

    Ensure-ConfigValue -Key 'JWT_SECRET' -Value (New-RandomSecret) -IsSecret $true
    Ensure-ConfigValue -Key 'JWT_REFRESH_SECRET' -Value (New-RandomSecret) -IsSecret $true
    Write-Host "   Config step complete" -ForegroundColor Green
}
else {
    Write-Host "Skipping config var setup as requested (-SkipConfig)." -ForegroundColor Yellow
}

Write-Host "Applying database schema (backend/database/schema.sql)..."
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$schemaPath = Join-Path $repoRoot 'backend\database\schema.sql'
if (-not (Test-Path $schemaPath)) {
    Write-Host "ERROR: Could not find schema file at $schemaPath" -ForegroundColor Red
    exit 1
}

Get-Content $schemaPath | heroku pg:psql -a $AppName
Assert-LastExit "Failed to apply schema to app '$AppName'"
Write-Host "   Schema applied" -ForegroundColor Green

Write-Host "Ensuring admin user exists..."
$adminCmd = "cd backend && npm run create:admin -- '$AdminUser' '$AdminPassword' '$AdminEmail' '$AdminFullName'"
heroku run --app $AppName -- bash -c "$adminCmd"
Assert-LastExit "Failed to create admin user"
Write-Host "   Admin user ensured" -ForegroundColor Green

Write-Host "Heroku bootstrap complete. You can now log in with '$AdminUser' / '$AdminPassword'." -ForegroundColor Cyan
Write-Host "   To skip re-generating config vars next time, rerun with -SkipConfig." -ForegroundColor DarkGray
