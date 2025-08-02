# Version Strategy for Site Timer Blocker

## Current Version

**v1.0.0** - Initial Chrome Web Store release

## Versioning Scheme

This project follows [Semantic Versioning](https://semver.org/) (SemVer):

**MAJOR.MINOR.PATCH** (e.g., 1.2.3)

### Version Types

- **MAJOR** (1.x.x): Breaking changes or major feature overhauls
- **MINOR** (x.1.x): New features, backward compatible
- **PATCH** (x.x.1): Bug fixes, security updates, backward compatible

## Update Process

### 1. Update Manifest Version
```json
// src/manifest.json
{
  "version": "1.0.1"  // Update this field
}
```

### 2. Chrome Web Store Submission
- Package new version using `scripts/prepare-distribution.ps1`
- Upload to Chrome Web Store Developer Dashboard
- Update store listing if needed
- Submit for review

### 3. Documentation Updates
- Update relevant documentation with new version
- Note breaking changes in release notes
- Update feature lists if new functionality added

## Planned Version Roadmap

### v1.1.0 - Enhanced Features
- Subdomain support and intelligent grouping
- Weekly/monthly usage reports
- Goal setting and progress tracking

### v1.2.0 - Advanced Blocking
- Configurable warning messages before blocking
- Temporary bypass functionality
- Whitelist specific pages within blocked domains

### v2.0.0 - Major Architecture Update
- Cloud sync capabilities (optional)
- Multi-device coordination
- Advanced analytics dashboard

## Release Notes Template

```markdown
## Version X.Y.Z - [Release Date]

### New Features
- Feature description

### Improvements
- Enhancement description

### Bug Fixes
- Fix description

### Breaking Changes (Major versions only)
- Breaking change description
```

## Chrome Web Store Considerations

- Review time: 1-7 days typically
- Users auto-update within 24 hours of approval
- Can roll back to previous version if needed
- Maintain backward compatibility for user data
- Test thoroughly before submission

## Development Workflow

1. Implement features in `src/`
2. Update version in `manifest.json`
3. Test extension thoroughly
4. Run `scripts/prepare-distribution.ps1`
5. Upload to Chrome Web Store
6. Monitor for approval and user feedback