# Development Helper Script
# Quick commands for Chrome extension development

Write-Host "Site Timer Blocker - Development Helper" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""

Write-Host "Development Commands:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Load Extension in Chrome:" -ForegroundColor Yellow
Write-Host "   - Open chrome://extensions/"
Write-Host "   - Enable Developer mode"
Write-Host "   - Click 'Load unpacked'"
Write-Host "   - Select the 'src' folder"
Write-Host ""
Write-Host "2. Create Distribution Package:" -ForegroundColor Yellow
Write-Host "   Run: .\prepare-distribution.ps1"
Write-Host ""
Write-Host "3. View Documentation:" -ForegroundColor Yellow
Write-Host "   - Extension docs: ..\docs\README.md"
Write-Host "   - Store submission: ..\docs\CHROME_WEB_STORE_SUBMISSION.md"
Write-Host "   - Technical specs: ..\docs\SPEC.md"
Write-Host ""

Write-Host "Project Structure:" -ForegroundColor Cyan
Write-Host "├── src/          Extension source code" -ForegroundColor Gray
Write-Host "├── scripts/      Build and distribution tools" -ForegroundColor Gray  
Write-Host "├── docs/         Documentation" -ForegroundColor Gray
Write-Host "└── assets/       Design files and tools" -ForegroundColor Gray
Write-Host ""

Write-Host "Quick Actions:" -ForegroundColor Yellow
Write-Host "1. Open source folder for development"
Write-Host "2. Open documentation folder"
Write-Host "3. Create distribution package"
Write-Host "4. Exit"
Write-Host ""

$choice = Read-Host "Select option (1-4)"

switch ($choice) {
    "1" { Invoke-Item "..\src" }
    "2" { Invoke-Item "..\docs" }
    "3" { .\prepare-distribution.ps1 }
    "4" { exit }
    default { 
        Write-Host "Opening src folder for development..." -ForegroundColor Green
        Invoke-Item "..\src" 
    }
}