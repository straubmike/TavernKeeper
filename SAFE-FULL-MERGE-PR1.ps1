# SAFE FULL MERGE - PR #1 (Including Mike's Dungeon Run Changes)
# This script merges ALL changes from PR #1 including production files
# Review this script carefully before running!

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SAFE FULL MERGE - PR #1" -ForegroundColor Cyan
Write-Host "Includes Contributions + Production Files" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Verify we're on main branch
$currentBranch = git branch --show-current
if ($currentBranch -ne "main") {
    Write-Host "ERROR: Not on main branch! Current: $currentBranch" -ForegroundColor Red
    Write-Host "Please switch to main branch first: git checkout main" -ForegroundColor Yellow
    exit 1
}
Write-Host "✓ On main branch" -ForegroundColor Green

# Step 2: Check for uncommitted changes
$status = git status --porcelain
if ($status) {
    Write-Host "WARNING: You have uncommitted changes!" -ForegroundColor Yellow
    Write-Host "Current changes:" -ForegroundColor Yellow
    git status --short
    Write-Host ""
    $continue = Read-Host "Continue anyway? (yes/no)"
    if ($continue -ne "yes") {
        exit 1
    }
}

# Step 3: Verify backup exists
$backupBranch = git branch --list "backup-*" | Select-Object -First 1
if ($backupBranch) {
    Write-Host "✓ Backup branch found: $backupBranch" -ForegroundColor Green
} else {
    Write-Host "Creating backup branch..." -ForegroundColor Yellow
    $backupName = "backup-before-pr1-full-merge-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    git branch $backupName
    Write-Host "✓ Backup created: $backupName" -ForegroundColor Green
}

# Step 4: Show what will be merged
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PR #1 SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Files: 81 total"
Write-Host "Additions: +7,325 lines"
Write-Host "Deletions: -1,334 lines"
Write-Host ""
Write-Host "Includes:" -ForegroundColor Yellow
Write-Host "  ✓ All contributions folder files (70 files)"
Write-Host "  ✓ New API endpoints (dungeons, world/initialize)"
Write-Host "  ✓ New services (dungeonRunService, heroAdventurerInit, worldInitializationService)"
Write-Host "  ✓ Mike's dungeon run changes (runWorker.ts, runs/route.ts, MapScene.tsx)"
Write-Host "  ✓ Hero ownership updates (adventurer initialization)"
Write-Host "  ✓ Worker updates (world initialization)"
Write-Host ""

# Step 5: Confirm merge
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CONFIRMATION REQUIRED" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will merge ALL changes from PR #1 including:" -ForegroundColor Yellow
Write-Host "  - Contributions folder (safe)"
Write-Host "  - Production file changes (Mike's dungeon run system)"
Write-Host ""
Write-Host "⚠️  IMPORTANT: After merge, you'll need to:" -ForegroundColor Yellow
Write-Host "  1. Run database migrations (see DATABASE_MIGRATIONS.md)"
Write-Host "  2. Test dungeon runs"
Write-Host "  3. Test hero syncing"
Write-Host "  4. Monitor worker logs"
Write-Host ""
$confirm = Read-Host "Type 'MERGE' to proceed with full merge"

if ($confirm -ne "MERGE") {
    Write-Host "Merge cancelled." -ForegroundColor Yellow
    exit 0
}

# Step 6: Fetch PR branch
Write-Host ""
Write-Host "Fetching PR branch..." -ForegroundColor Yellow
gh pr checkout 1 --branch pr-1-temp-merge 2>&1 | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to checkout PR branch" -ForegroundColor Red
    exit 1
}

# Step 7: Merge into main
Write-Host "Merging PR #1 into main..." -ForegroundColor Yellow
git checkout main
git merge pr-1-temp-merge --no-ff -m "Merge PR #1: Contributions + Mike's dungeon run system"

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Merge failed! Check for conflicts." -ForegroundColor Red
    Write-Host "You can abort with: git merge --abort" -ForegroundColor Yellow
    Write-Host "Or resolve conflicts and continue." -ForegroundColor Yellow
    exit 1
}

# Step 8: Cleanup
Write-Host "Cleaning up temporary branch..." -ForegroundColor Yellow
git branch -D pr-1-temp-merge

# Step 9: Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "MERGE COMPLETE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Review changes: git status" -ForegroundColor White
Write-Host "  2. Check for conflicts: git diff" -ForegroundColor White
Write-Host "  3. Run database migrations (see apps/web/DATABASE_MIGRATIONS.md)" -ForegroundColor White
Write-Host "  4. Test the application" -ForegroundColor White
Write-Host "  5. If everything works, commit: git add . && git commit -m 'Merge PR #1 complete'" -ForegroundColor White
Write-Host "  6. If something breaks, restore: git reset --hard HEAD~1" -ForegroundColor White
Write-Host ""
Write-Host "Backup branch: $backupBranch" -ForegroundColor Green
Write-Host ""

