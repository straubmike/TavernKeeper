# SAFE PR #1 MERGE INSTRUCTIONS
## Contributions Folder Only - Step by Step

## ✅ SAFETY CHECKLIST
- [x] Backup branch created: `backup-before-pr-inspection-20251208-150307`
- [x] You're on `main` branch
- [x] All PR files are in `apps/web/contributions/` folder ✓

## 📊 WHAT WILL HAPPEN

### NEW FILES (50+ files - SAFE TO ADD):
These files don't exist locally and will be added:
- `adventurer-tracking/` - Complete new system
- `combat-system/` - Complete new system
- `inventory-tracking/` - Complete new system
- `monster-stat-blocks/` - Complete new system
- `themed-dungeon-generation/` - Complete new system
- `tools/` - New tools
- Various documentation files

### EXISTING FILES (15 files - WILL BE SKIPPED):
These files exist locally and will NOT be touched:
- `apps/web/contributions/README.md`
- `apps/web/contributions/procedural-item-generation/README.md`
- `apps/web/contributions/procedural-item-generation/code/README.md`
- `world-generation-system/code/generators/*.ts` (multiple files)

## 🛡️ SAFEST METHOD: Manual Step-by-Step

### Option 1: Use GitHub Web Interface (SAFEST)
1. Go to PR #1 in your browser: `gh pr view 1 --web`
2. Review each file
3. Manually copy new files you want
4. This way you have full control

### Option 2: Use Git Apply with Filter (SAFE)
```powershell
# Step 1: Create a patch file (read-only, no changes)
gh pr diff 1 > pr-1.patch

# Step 2: Review the patch file
notepad pr-1.patch

# Step 3: Apply ONLY contributions folder (if satisfied)
git apply --directory=apps/web/contributions pr-1.patch

# Step 4: Check what was added
git status

# Step 5: If you don't like it, discard:
git restore apps/web/contributions/
```

### Option 3: Selective File Copy (SAFEST - Manual)
```powershell
# 1. Get list of new files
$newFiles = gh pr diff 1 --name-only | Select-String "^apps/web/contributions/" | ForEach-Object { if (-not (Test-Path $_.Line.Trim())) { $_.Line.Trim() } }

# 2. Review the list
$newFiles

# 3. For each file you want, manually download from GitHub web interface
# Or use: gh pr view 1 --web to see files and copy them manually
```

## ⚠️ WHAT NOT TO DO
- ❌ DON'T run `gh pr merge 1` - this merges everything
- ❌ DON'T run `git merge` without checking first
- ❌ DON'T overwrite existing files

## ✅ RECOMMENDED: Review First
```powershell
# 1. See what files are in PR
gh pr view 1 --json files --jq '.files[].path'

# 2. See the actual changes
gh pr diff 1

# 3. Open in browser to review
gh pr view 1 --web

# 4. Then decide if you want to proceed
```

## 🔄 IF SOMETHING GOES WRONG
```powershell
# Restore from backup
git checkout backup-before-pr-inspection-20251208-150307

# Or restore specific files
git restore apps/web/contributions/

# Or discard all changes
git reset --hard HEAD
```

