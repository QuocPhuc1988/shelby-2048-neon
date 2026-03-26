# Shelby Protocol - Managed Deployment Script
# Automates Next.js build and Shelbynet blob upload

Write-Host "🚀 Starting Shelby Deployment Pipeline..." -ForegroundColor Cyan

# 1. CLEAN & BUILD
Write-Host "📦 Stage 1: Compiling Static Assets (npm run build)..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Build failed! Please fix TypeScript or Lint errors before deploying."
    exit $LASTEXITCODE
}

# 2. VERIFY EXPORT
if (-Not (Test-Path "./out")) {
    Write-Error "❌ Static 'out/' directory not found. Ensure next.config.js has 'output: export'."
    exit 1
}

# 3. SHELBY UPLOAD
Write-Host "🌐 Stage 2: Synchronizing 'out/' to Shelbynet..." -ForegroundColor Yellow
# Note: Blobs are set to expire in 30 days by default. 
# We use 'game_v1' as the blob directory name.
shelby upload ./out game_v1 -e "in 30 days" --assume-yes

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ Shelby CLI upload encountered an issue." -ForegroundColor Red
    Write-Host "💡 Tip: run 'shelby fund' to ensure you have ShelbyUSD for storage fees."
} else {
    Write-Host "✨ Deployment Complete! Your game is being indexed on Shelbynet." -ForegroundColor Green
    Write-Host "🔗 View your blobs at: https://explorer.shelby.xyz/testnet" -ForegroundColor Cyan
}
