# SAFE MERGE SCRIPT - PR #1 Contributions Folder Only
# This script ONLY adds NEW files from PR #1
# It will NOT modify or overwrite any existing files
# Review this script carefully before running!

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SAFE PR MERGE - CONTRIBUTIONS FOLDER ONLY" -ForegroundColor Cyan
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

# Step 2: Verify backup exists
$backupBranch = git branch --list "backup-*" | Select-Object -First 1
if ($backupBranch) {
    Write-Host "✓ Backup branch found: $backupBranch" -ForegroundColor Green
} else {
    Write-Host "WARNING: No backup branch found!" -ForegroundColor Yellow
    Write-Host "Creating backup now..." -ForegroundColor Yellow
    $backupName = "backup-before-pr-merge-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    git branch $backupName
    Write-Host "✓ Backup created: $backupName" -ForegroundColor Green
}

# Step 3: Get list of NEW files only (files that don't exist locally)
Write-Host ""
Write-Host "Getting list of NEW files from PR #1..." -ForegroundColor Yellow
$newFiles = gh pr diff 1 --name-only | Select-String "^apps/web/contributions/" | ForEach-Object {
    $file = $_.Line.Trim()
    if (-not (Test-Path $file)) {
        $file
    }
}

if ($newFiles.Count -eq 0) {
    Write-Host "No new files to add. Exiting." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "FILES TO BE ADDED (NEW FILES ONLY):" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
$newFiles | ForEach-Object { Write-Host "  + $_" -ForegroundColor Green }
Write-Host ""
Write-Host "Total: $($newFiles.Count) new files" -ForegroundColor Cyan
Write-Host ""

# Step 4: Get list of existing files (for information only)
$existingFiles = gh pr diff 1 --name-only | Select-String "^apps/web/contributions/" | ForEach-Object {
    $file = $_.Line.Trim()
    if (Test-Path $file) {
        $file
    }
}

if ($existingFiles.Count -gt 0) {
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "EXISTING FILES (WILL BE SKIPPED):" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    $existingFiles | ForEach-Object { Write-Host "  ⊘ $_" -ForegroundColor Gray }
    Write-Host ""
    Write-Host "These files exist locally and will NOT be modified." -ForegroundColor Yellow
    Write-Host ""
}

# Step 5: CONFIRMATION REQUIRED
Write-Host "========================================" -ForegroundColor Red
Write-Host "CONFIRMATION REQUIRED" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""
Write-Host "This script will:" -ForegroundColor White
Write-Host "  ✓ Add $($newFiles.Count) NEW files from PR #1" -ForegroundColor Green
Write-Host "  ✓ Skip $($existingFiles.Count) existing files (no changes)" -ForegroundColor Yellow
Write-Host "  ✓ NOT modify any existing files" -ForegroundColor Green
Write-Host "  ✓ NOT merge the PR (just copy new files)" -ForegroundColor Green
Write-Host ""
$confirmation = Read-Host "Type 'YES' to proceed, or anything else to cancel"

if ($confirmation -ne "YES") {
    Write-Host ""
    Write-Host "Cancelled. No changes made." -ForegroundColor Yellow
    exit 0
}

# Step 6: Download PR files (safest method - use gh pr diff to get file contents)
Write-Host ""
Write-Host "Downloading new files from PR #1..." -ForegroundColor Yellow

# Create a temporary directory to extract PR files
$tempDir = "temp-pr-files-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

try {
    # Get the PR diff and extract new files
    # We'll use git to fetch the PR branch content
    Write-Host "Fetching PR content..." -ForegroundColor Yellow

    # Alternative: Use gh pr diff to see what would be added
    # For safety, we'll manually copy files using git show
    $filesAdded = 0
    $filesSkipped = 0

    foreach ($file in $newFiles) {
        try {
            # Create directory structure if needed
            $fileDir = Split-Path $file -Parent
            if ($fileDir -and -not (Test-Path $fileDir)) {
                New-Item -ItemType Directory -Path $fileDir -Force | Out-Null
            }

            # Get file content from PR using git show
            # PR is from straubmike:main branch
            $prBranch = "straubmike:main"
            $fileContent = gh pr diff 1 --name-only | Select-String $file

            # Actually, we need to get the file from the PR branch
            # This is tricky without checking out. Let's use a safer approach:
            # Download the raw file from GitHub

            Write-Host "  Downloading: $file" -ForegroundColor Cyan

            # Use GitHub API to get file content
            $repo = "dutchiono/TavernKeeper"
            $prNumber = 1

            # Get PR details to find the branch
            $prInfo = gh pr view 1 --json headRefName,headRepository --jq '{branch: .headRefName, repo: .headRepository.nameWithOwner}'
            $prJson = $prInfo | ConvertFrom-Json

            # Construct GitHub raw URL
            $rawUrl = "https://raw.githubusercontent.com/$($prJson.repo)/$($prJson.branch)/$file"

            # Download file
            try {
                $response = Invoke-WebRequest -Uri $rawUrl -UseBasicParsing -ErrorAction Stop
                [System.IO.File]::WriteAllText((Resolve-Path ".").Path + "\$file", $response.Content)
                $filesAdded++
                Write-Host "    ✓ Added" -ForegroundColor Green
            } catch {
                Write-Host "    ⊘ Could not download (may not exist in PR branch)" -ForegroundColor Yellow
                $filesSkipped++
            }

        } catch {
            Write-Host "    ✗ Error: $_" -ForegroundColor Red
            $filesSkipped++
        }
    }

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "SUMMARY" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Files added: $filesAdded" -ForegroundColor Green
    Write-Host "Files skipped: $filesSkipped" -ForegroundColor Yellow
    Write-Host ""

    if ($filesAdded -gt 0) {
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "  1. Review the added files: git status" -ForegroundColor White
        Write-Host "  2. Review changes: git diff" -ForegroundColor White
        Write-Host "  3. If satisfied, commit: git add apps/web/contributions/ && git commit -m 'Add new contributions from PR #1'" -ForegroundColor White
        Write-Host "  4. If not satisfied, restore: git restore apps/web/contributions/" -ForegroundColor White
    }

} finally {
    # Cleanup temp directory
    if (Test-Path $tempDir) {
        Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host "Done! Your work is safe - no existing files were modified." -ForegroundColor Green

