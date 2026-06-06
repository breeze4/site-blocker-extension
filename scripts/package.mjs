#!/usr/bin/env node
// Site Timer Blocker - Distribution packaging script (cross-platform)
// Builds a clean dist/ tree and a Chrome Web Store-ready zip.
// Run with: npm run package

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");

const srcDir = path.join(root, "src");
const docsDir = path.join(root, "docs");
const assetsDir = path.join(root, "assets");
const distDir = path.join(root, "dist");
const extDir = path.join(distDir, "extension");
const storeDir = path.join(distDir, "store-assets");
const designDir = path.join(storeDir, "design-assets");

// Files that make up the actual extension. Keep in sync with manifest.json.
const EXTENSION_FILES = [
  "manifest.json",
  "background.js",
  "content.js",
  "options.html",
  "options.js",
  "storage-utils.js",
  "timer-utils.js",
];

const log = (msg) => console.log(msg);

// Read version from the manifest so the zip name never drifts from the source.
const manifest = JSON.parse(
  fs.readFileSync(path.join(srcDir, "manifest.json"), "utf8"),
);
const version = manifest.version;
const zipName = `site-timer-blocker-v${version}.zip`;
const zipPath = path.join(distDir, zipName);

log(`\nSite Timer Blocker - packaging v${version}\n`);

// 1. Clean and recreate the dist tree.
fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(path.join(extDir, "icons"), { recursive: true });
fs.mkdirSync(designDir, { recursive: true });

// 2. Copy extension source files, failing loudly if one is missing.
log("Copying extension files...");
for (const file of EXTENSION_FILES) {
  const from = path.join(srcDir, file);
  if (!fs.existsSync(from)) {
    console.error(`  ERROR: missing source file: src/${file}`);
    process.exit(1);
  }
  fs.copyFileSync(from, path.join(extDir, file));
}
fs.cpSync(path.join(srcDir, "icons"), path.join(extDir, "icons"), {
  recursive: true,
});

// 3. Copy store submission materials and design assets.
log("Copying store assets...");
for (const file of ["CHROME_WEB_STORE_SUBMISSION.md", "RELEASE_CHECKLIST.md"]) {
  fs.copyFileSync(path.join(docsDir, file), path.join(storeDir, file));
}
fs.cpSync(assetsDir, designDir, { recursive: true });

// 4. Build the extension zip with files at the archive root (not nested under
//    extension/). Excludes macOS cruft. Uses the system `zip`, present on
//    macOS and Linux.
log(`Creating ${zipName}...`);
try {
  execFileSync("zip", ["-r", "-X", zipPath, ".", "-x", "*.DS_Store"], {
    cwd: extDir,
    stdio: "ignore",
  });
} catch {
  console.error(
    "  ERROR: `zip` command not found or failed. Install zip and retry.",
  );
  process.exit(1);
}

// 5. Write a package manifest listing exactly what shipped.
const packagedFiles = [...EXTENSION_FILES, "icons/"].map((f) => `- ${f}`);
fs.writeFileSync(
  path.join(distDir, "PACKAGE_MANIFEST.txt"),
  `EXTENSION PACKAGE CONTENTS\n=========================\n\nFiles in ${zipName}:\n${packagedFiles.join("\n")}\n`,
);

// 6. Write submission guidance (replaces the old PowerShell helper output).
const readme = `SITE TIMER BLOCKER - DISTRIBUTION PACKAGE
========================================

Built: ${new Date().toISOString()}
Version: ${version}

CONTENTS
  ${zipName}            Ready to upload to the Chrome Web Store
  store-assets/                       Submission guide + release checklist
  store-assets/design-assets/         Icon source files
  extension/                          Unpackaged extension (for reference)

SUBMISSION CHECKLIST
  [ ] Create 5 screenshots (1280x800) - see submission guide
  [ ] Create promotional tile (440x280) - use design assets
  [ ] Host privacy policy online (HTML in submission guide)
  [ ] Register Chrome Web Store developer account ($5 fee)
  [ ] Upload ${zipName}
  [ ] Fill out listing using the submission guide
  [ ] Submit for review

SCREENSHOTS TO CAPTURE (1280x800)
  1. Main options page
  2. Smart URL input with preview
  3. Usage analytics table
  4. Dark mode interface
  5. Onboarding welcome message

NEXT STEPS
  1. Review store-assets/CHROME_WEB_STORE_SUBMISSION.md
  2. Create the required screenshots and promotional images
  3. Host the privacy policy at a public URL
  4. Upload ${zipName} to the Chrome Web Store
`;
fs.writeFileSync(path.join(distDir, "DISTRIBUTION_README.txt"), readme);

const { size } = fs.statSync(zipPath);
log("\nDistribution package created.");
log(`  Zip:   dist/${zipName} (${(size / 1024).toFixed(1)} KB)`);
log("  Guide: dist/DISTRIBUTION_README.txt");
log("");
