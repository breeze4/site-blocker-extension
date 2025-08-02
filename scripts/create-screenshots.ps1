# Screenshot Creation Helper for Site Timer Blocker
# This script provides guidance for creating Chrome Web Store screenshots

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Site Timer Blocker - Screenshot Helper" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "Required Screenshots for Chrome Web Store:" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. MAIN OPTIONS PAGE (1280x800)" -ForegroundColor Yellow
Write-Host "   - Load extension in Chrome (chrome://extensions/)"
Write-Host "   - Right-click extension icon → Options"
Write-Host "   - Show full interface with some domains added"
Write-Host "   - Caption: 'Clean, intuitive interface for managing site timers and usage analytics'"
Write-Host ""

Write-Host "2. SMART URL INPUT (1280x800)" -ForegroundColor Yellow  
Write-Host "   - Focus on the URL input section"
Write-Host "   - Show preview of domain extraction"
Write-Host "   - Example: Type 'https://reddit.com/r/programming' → shows 'Will track: reddit.com'"
Write-Host "   - Caption: 'Paste any URL and see exactly what domain will be tracked'"
Write-Host ""

Write-Host "3. USAGE ANALYTICS (1280x800)" -ForegroundColor Yellow
Write-Host "   - Show table with populated time tracking data"
Write-Host "   - Highlight the analytics columns (24h, 7d, 30d, All Time)"
Write-Host "   - Include some realistic usage data"
Write-Host "   - Caption: 'Comprehensive time tracking with rolling windows and session management'"
Write-Host ""

Write-Host "4. DARK MODE (1280x800)" -ForegroundColor Yellow
Write-Host "   - Set system to dark mode"
Write-Host "   - Show the extension automatically adapting"
Write-Host "   - Same content as screenshot 1 but in dark theme"
Write-Host "   - Caption: 'Full dark mode support that adapts to your system preferences'"
Write-Host ""

Write-Host "5. ONBOARDING (1280x800)" -ForegroundColor Yellow
Write-Host "   - Fresh install or add ?onboarding=true to URL"
Write-Host "   - Show the welcome banner with instructions"
Write-Host "   - Capture the helpful onboarding flow"
Write-Host "   - Caption: 'Guided setup helps new users get started quickly'"
Write-Host ""

Write-Host "PROMOTIONAL TILE NEEDED:" -ForegroundColor Cyan
Write-Host ""
Write-Host "• Size: 440x280 pixels" -ForegroundColor Yellow
Write-Host "• Include extension icon from assets/icon.svg"
Write-Host "• Add text: 'Site Timer Blocker'"
Write-Host "• Tagline: 'Take Control of Your Time'"
Write-Host "• Use green color scheme matching the extension"
Write-Host ""

Write-Host "TIPS FOR GREAT SCREENSHOTS:" -ForegroundColor Cyan
Write-Host ""
Write-Host "✓ Use realistic domain names (reddit.com, twitter.com, etc.)" -ForegroundColor Green
Write-Host "✓ Show the extension in action with real data" -ForegroundColor Green
Write-Host "✓ Keep browser UI minimal (hide bookmarks bar, etc.)" -ForegroundColor Green
Write-Host "✓ Use consistent time values that make sense" -ForegroundColor Green
Write-Host "✓ Ensure text is readable at smaller sizes" -ForegroundColor Green
Write-Host "✓ Take screenshots at exactly 1280x800 resolution" -ForegroundColor Green
Write-Host ""

Write-Host "SCREENSHOT TOOLS:" -ForegroundColor Cyan
Write-Host "• Windows: Snipping Tool or Win+Shift+S" -ForegroundColor Gray
Write-Host "• Browser DevTools: Toggle device toolbar for exact dimensions" -ForegroundColor Gray
Write-Host "• Online tools: Screenshot extensions or browser dev mode" -ForegroundColor Gray
Write-Host ""

Write-Host "Ready to create screenshots?" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Load extension for testing"
Write-Host "2. Open Chrome Web Store submission guide"
Write-Host "3. Exit"
Write-Host ""

$choice = Read-Host "Select option (1-3)"

switch ($choice) {
    "1" { 
        Write-Host "Opening source folder to load extension..." -ForegroundColor Green
        Invoke-Item "..\src" 
    }
    "2" { 
        Write-Host "Opening submission guide..." -ForegroundColor Green
        Invoke-Item "..\docs\CHROME_WEB_STORE_SUBMISSION.md" 
    }
    "3" { 
        Write-Host "Good luck with your screenshots! 📸" -ForegroundColor Green
        exit 
    }
    default { 
        Write-Host "Opening source folder for extension loading..." -ForegroundColor Green
        Invoke-Item "..\src" 
    }
}