# Packaging Verification Checklist

Complete this checklist before submitting to Chrome Web Store to ensure everything works correctly.

## 📦 Pre-Packaging Verification

### Source Code Checks
- [ ] All source files present in `src/` directory
- [ ] `manifest.json` has correct version number (1.0.0)
- [ ] All icon files are real PNG images (not text files)
- [ ] No console.log statements in production code
- [ ] Content Security Policy is properly configured
- [ ] All permissions are justified and documented

### File Structure Validation
```
✓ Required files in src/:
├── manifest.json       ✓ Extension manifest
├── background.js       ✓ Service worker  
├── content.js          ✓ Content script
├── options.html        ✓ Options page UI
├── options.js          ✓ Options page logic
├── storage-utils.js    ✓ Storage utilities
└── icons/              ✓ All PNG icon files
    ├── icon16.png      ✓ 16x16 PNG
    ├── icon32.png      ✓ 32x32 PNG  
    ├── icon48.png      ✓ 48x48 PNG
    └── icon128.png     ✓ 128x128 PNG
```

## 📋 Distribution Package Creation

### Run Packaging Script
- [ ] Execute: `.\scripts\prepare-distribution.ps1`
- [ ] Verify script completes without errors
- [ ] Check that `dist/` folder is created
- [ ] Confirm ZIP file `site-timer-blocker-v1.0.zip` exists

### Package Contents Verification
- [ ] Extract ZIP file to temporary location
- [ ] Verify all source files are included
- [ ] Check icons directory exists with all PNG files
- [ ] Confirm no development files are included (no .md, .ps1, etc.)
- [ ] Verify README.md is the extension documentation (not project README)

## 🧪 Functional Testing

### Fresh Installation Test
- [ ] Load unpacked extension from `dist/extension/` folder
- [ ] Verify extension appears in chrome://extensions/
- [ ] Test that options page opens correctly
- [ ] Add a test domain (e.g., example.com) with 1-minute timer
- [ ] Visit test domain and confirm timer starts
- [ ] Wait for timer to expire and verify blocking works
- [ ] Check that usage analytics are recorded

### Feature Verification Checklist
- [ ] **Smart URL Input**: Paste URL, verify domain extraction works
- [ ] **Timer Functionality**: Set timer, visit site, confirm countdown
- [ ] **Blocking**: Wait for timer expiry, verify redirect to new tab
- [ ] **Analytics**: Check that time tracking data appears
- [ ] **Reset Functions**: Test individual and global reset buttons
- [ ] **Dark Mode**: Toggle system dark mode, verify UI adapts
- [ ] **Onboarding**: Fresh install shows welcome message

### Cross-Browser Testing (Optional)
- [ ] Test in Chrome (primary target)
- [ ] Test in Microsoft Edge (Chromium-based)
- [ ] Test in Brave (Chromium-based)

## 🏪 Chrome Web Store Preparation

### Store Assets Ready
- [ ] 5 screenshots created (1280x800 resolution)
- [ ] Promotional tile created (440x280 resolution)  
- [ ] Privacy policy hosted online with public URL
- [ ] Store listing content prepared (from submission guide)
- [ ] Permissions justification written
- [ ] Test instructions documented

### Final Validation
- [ ] Extension name: "Site Timer Blocker"
- [ ] Version: "1.0.0" 
- [ ] Description matches manifest and store listing
- [ ] All permissions explained in justification
- [ ] Privacy policy URL accessible
- [ ] Screenshots show actual functionality

## ✅ Ready for Submission

Once all items above are checked:

1. **Upload Package**: Use `site-timer-blocker-v1.0.zip`
2. **Complete Store Listing**: Use content from `CHROME_WEB_STORE_SUBMISSION.md`
3. **Submit for Review**: Follow Chrome Web Store process
4. **Monitor Status**: Check email for review updates

## 🚨 Common Issues to Avoid

- ❌ Uploading wrong folder (upload the ZIP, not folder)
- ❌ Missing icon files or corrupted PNGs
- ❌ Broad permissions without proper justification
- ❌ Privacy policy link that's not accessible
- ❌ Screenshots that don't show actual functionality
- ❌ Manifest version mismatch between files

## 📞 Support

If any verification steps fail:
1. Check the error message carefully
2. Review the Chrome Web Store developer documentation
3. Verify all files are in correct locations
4. Test with a fresh Chrome profile
5. Consult the troubleshooting section in `CHROME_WEB_STORE_SUBMISSION.md`

---

**✅ Verification Complete**: Date: _________ Verified by: _________