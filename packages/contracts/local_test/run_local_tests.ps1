# Local Testnet Test Runner
# This script helps you test contracts on a local Hardhat node

Write-Host "=== Local Testnet Test Runner ===" -ForegroundColor Cyan
Write-Host ""

# Check if Hardhat node is running
Write-Host "Checking if Hardhat node is running..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:8545" -Method POST -Body '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' -ContentType "application/json" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✅ Hardhat node is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Hardhat node is NOT running" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please start a Hardhat node in a separate terminal:" -ForegroundColor Yellow
    Write-Host "  cd packages/contracts" -ForegroundColor White
    Write-Host "  npx hardhat node" -ForegroundColor White
    Write-Host ""
    Write-Host "Then run this script again." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Select a test to run:" -ForegroundColor Cyan
Write-Host "1. Fund Deployer (funds the deployer account with ETH)" -ForegroundColor White
Write-Host "2. Verify Fix (tests the overflow fix with liquidity addition)" -ForegroundColor White
Write-Host "3. Verify Refund (tests refund logic)" -ForegroundColor White
Write-Host "4. Calculate Price (utility to calculate prices)" -ForegroundColor White
Write-Host "5. Decode Selectors (utility to decode error selectors)" -ForegroundColor White
Write-Host "6. Inspect Interface (utility to inspect contract interfaces)" -ForegroundColor White
Write-Host "7. Run All Tests (funds deployer, then runs verify_fix and verify_refund)" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Enter your choice (1-7)"

$script = switch ($choice) {
    "1" { "fund_deployer.ts" }
    "2" { "verify_fix.ts" }
    "3" { "verify_refund.ts" }
    "4" { "calc_price.ts" }
    "5" { "decode_selectors.ts" }
    "6" { "inspect_interface.ts" }
    "7" {
        Write-Host ""
        Write-Host "=== Running All Tests ===" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Step 1: Funding deployer..." -ForegroundColor Yellow
        npx hardhat run local_test/fund_deployer.ts --network localhost
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Failed to fund deployer" -ForegroundColor Red
            exit 1
        }
        Write-Host ""
        Write-Host "Step 2: Verifying fix..." -ForegroundColor Yellow
        npx hardhat run local_test/verify_fix.ts --network localhost
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Fix verification failed" -ForegroundColor Red
            exit 1
        }
        Write-Host ""
        Write-Host "Step 3: Verifying refund..." -ForegroundColor Yellow
        npx hardhat run local_test/verify_refund.ts --network localhost
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Refund verification failed" -ForegroundColor Red
            exit 1
        }
        Write-Host ""
        Write-Host "✅ All tests completed!" -ForegroundColor Green
        exit 0
    }
    default {
        Write-Host "Invalid choice" -ForegroundColor Red
        exit 1
    }
}

if ($script) {
    Write-Host ""
    Write-Host "Running $script on localhost..." -ForegroundColor Cyan
    Write-Host ""
    npx hardhat run "local_test/$script" --network localhost

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Test completed successfully!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "❌ Test failed with exit code $LASTEXITCODE" -ForegroundColor Red
        exit 1
    }
}
