# Site Timer Blocker - Distribution Preparation Script (PowerShell)
# This script creates a clean distribution package for Chrome Web Store submission

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Site Timer Blocker Distribution Prep" -ForegroundColor Green  
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Create dist directory and subdirectories in project root
Write-Host "Creating distribution directory structure..." -ForegroundColor Yellow
if (Test-Path "..\dist") { Remove-Item "..\dist" -Recurse -Force }
New-Item -ItemType Directory -Path "..\dist" | Out-Null
New-Item -ItemType Directory -Path "..\dist\extension" | Out-Null
New-Item -ItemType Directory -Path "..\dist\store-assets" | Out-Null
New-Item -ItemType Directory -Path "..\dist\docs" | Out-Null

Write-Host ""
Write-Host "Copying extension files..." -ForegroundColor Yellow

# Copy core extension files to dist/extension
Copy-Item "..\src\manifest.json" "..\dist\extension\"
Copy-Item "..\src\background.js" "..\dist\extension\"
Copy-Item "..\src\content.js" "..\dist\extension\"
Copy-Item "..\src\options.html" "..\dist\extension\"
Copy-Item "..\src\options.js" "..\dist\extension\"
Copy-Item "..\src\storage-utils.js" "..\dist\extension\"
Copy-Item "..\docs\README.md" "..\dist\extension\"

# Copy icons directory
Write-Host "Copying icons..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path "..\dist\extension\icons" | Out-Null
Copy-Item "..\src\icons\*.png" "..\dist\extension\icons\"

# Copy store submission materials
Write-Host ""
Write-Host "Copying store submission materials..." -ForegroundColor Yellow
Copy-Item "..\docs\CHROME_WEB_STORE_SUBMISSION.md" "..\dist\store-assets\"
Copy-Item "..\docs\RELEASE_CHECKLIST.md" "..\dist\store-assets\"

# Copy design assets
Write-Host "Copying design assets..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path "..\dist\store-assets\design-assets" | Out-Null
Copy-Item "..\assets\*" "..\dist\store-assets\design-assets\" -Recurse

# Create the extension ZIP package
Write-Host ""
Write-Host "Creating extension package..." -ForegroundColor Yellow
$zipPath = "..\dist\site-timer-blocker-v1.0.zip"
Compress-Archive -Path "..\dist\extension\*" -DestinationPath $zipPath -Force

# Create distribution README
Write-Host ""
Write-Host "Creating distribution instructions..." -ForegroundColor Yellow

$readme = @"
SITE TIMER BLOCKER - DISTRIBUTION PACKAGE
========================================

This directory contains everything needed for Chrome Web Store submission:

FILES IN THIS PACKAGE:

1. EXTENSION PACKAGE
   site-timer-blocker-v1.0.zip - Ready to upload to Chrome Web Store

2. STORE ASSETS NEEDED
   /store-assets/
   ├── CHROME_WEB_STORE_SUBMISSION.md - Complete submission guide
   ├── RELEASE_CHECKLIST.md - Pre-submission checklist  
   └── /design-assets/ - Icon source files

3. EXTENSION SOURCE
   /extension/ - Unpackaged extension files for reference

SUBMISSION CHECKLIST:
□ Create 5 screenshots (1280x800) - see submission guide
□ Create promotional tile (440x280) - use design assets
□ Host privacy policy online - HTML provided in submission guide
□ Register Chrome Web Store developer account (`$5 fee)
□ Upload site-timer-blocker-v1.0.zip to Chrome Web Store
□ Fill out listing using content from submission guide
□ Submit for review

NEXT STEPS:
1. Open CHROME_WEB_STORE_SUBMISSION.md for detailed instructions
2. Create required screenshots and promotional images
3. Host privacy policy at a public URL
4. Upload site-timer-blocker-v1.0.zip to Chrome Web Store

Good luck with your submission! 🚀

Package created: $(Get-Date)
"@

$readme | Out-File "..\dist\DISTRIBUTION_README.txt" -Encoding UTF8

# Create screenshot helper script
$screenshotHelper = @"
# Screenshot Creation Helper
# Run this script to get guidance for taking screenshots

Write-Host "Site Timer Blocker - Screenshot Helper" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""
Write-Host "To create the required 5 screenshots:"
Write-Host ""
Write-Host "1. Load the extension in Chrome:" -ForegroundColor Cyan
Write-Host "   - Open Chrome"
Write-Host "   - Go to chrome://extensions/"
Write-Host "   - Enable Developer mode"
Write-Host "   - Click 'Load unpacked'"
Write-Host "   - Select the 'extension' folder in this directory"
Write-Host ""
Write-Host "2. Take screenshots (1280x800 resolution):" -ForegroundColor Cyan
Write-Host "   Screenshot 1: Main options page"
Write-Host "   Screenshot 2: Smart URL input with preview"
Write-Host "   Screenshot 3: Usage analytics table"
Write-Host "   Screenshot 4: Dark mode interface"
Write-Host "   Screenshot 5: Onboarding welcome message"
Write-Host ""
Write-Host "3. Create promotional tile (440x280):" -ForegroundColor Cyan
Write-Host "   - Use design-assets/icon.svg as base"
Write-Host "   - Add 'Site Timer Blocker' text"
Write-Host "   - Include tagline: 'Take Control of Your Time'"
Write-Host ""
Write-Host "4. Host privacy policy:" -ForegroundColor Cyan
Write-Host "   - Use HTML from CHROME_WEB_STORE_SUBMISSION.md"
Write-Host "   - Host on GitHub Pages, Netlify, or Google Sites"
Write-Host ""
Write-Host "Press any key to open the extension folder..."
Read-Host
Invoke-Item "extension"
"@

$screenshotHelper | Out-File "..\dist\create-screenshots.ps1" -Encoding UTF8

# Show package info
Write-Host ""
Write-Host "Analyzing package..." -ForegroundColor Yellow
$zipInfo = Get-ChildItem $zipPath | Select-Object Name, @{Name='Size(KB)';Expression={[math]::Round($_.Length/1KB,2)}}
$zipInfo | Format-Table -AutoSize

# Create file manifest
Write-Host "Creating file manifest..." -ForegroundColor Yellow
$manifest = @"
EXTENSION PACKAGE CONTENTS
=========================

Files included in site-timer-blocker-v1.0.zip:
"@

Get-ChildItem "..\dist\extension" -Recurse | ForEach-Object {
    $relativePath = $_.FullName.Replace((Get-Location).Path + "\..\dist\extension\", "")
    $manifest += "`n- $relativePath"
}

$manifest | Out-File "..\dist\PACKAGE_MANIFEST.txt" -Encoding UTF8

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "DISTRIBUTION PACKAGE CREATED!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Package location: " -NoNewline
Write-Host "..\dist\" -ForegroundColor Cyan
Write-Host "Extension ZIP: " -NoNewline  
Write-Host "..\dist\site-timer-blocker-v1.0.zip" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Review ..\dist\DISTRIBUTION_README.txt"
Write-Host "2. Open ..\dist\store-assets\CHROME_WEB_STORE_SUBMISSION.md"
Write-Host "3. Run ..\dist\create-screenshots.ps1 for screenshot guidance"
Write-Host ""
Write-Host "Ready for Chrome Web Store submission! 🚀" -ForegroundColor Green
Write-Host ""
Write-Host "Press any key to open distribution folder..."
Read-Host
Invoke-Item "..\dist"