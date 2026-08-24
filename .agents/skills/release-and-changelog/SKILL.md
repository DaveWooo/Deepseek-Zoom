---
name: release-and-changelog
description: Use this skill when preparing releases, bumping versions, updating CHANGELOG.md, packaging browser extensions, or publishing updates.
---

# Release and Changelog Skill

This skill provides step-by-step guidance for semantic versioning, generating changelogs, packaging the extension, and preparing production releases.

---

## 1. Release Command Reference

| Task                   | Command                           | Description                                                       |
| :--------------------- | :-------------------------------- | :---------------------------------------------------------------- |
| **Pre-release Check**  | `npm run check`                   | Validates formatting, types, linting, and tests.                  |
| **Bump Patch Version** | `npm run version:patch`           | Increments version `x.y.Z` (bug fixes, small tweaks).             |
| **Bump Minor Version** | `npm run version:minor`           | Increments version `x.Y.0` (new features, non-breaking).          |
| **Bump Major Version** | `npm run version:major`           | Increments version `X.0.0` (breaking changes).                    |
| **Package Extension**  | `npm run package:extension`       | Builds Vite project and generates extension distribution archive. |
| **Package Local**      | `npm run package:local`           | Packages and synchronizes to local unpacked test folder.          |
| **Publish Webstore**   | `npm run publish:chrome-webstore` | Uploads package to Chrome Web Store via API script.               |

---

## 2. Standard Release Workflow

### Step 1: Pre-Release Quality Gate

Run the complete QA check to ensure zero build or test regressions:

```bash
npm run check
```

### Step 2: Version Bumping

Choose the appropriate semantic version increment:

```bash
# For bug fixes / minor patches:
npm run version:patch

# For new features:
npm run version:minor
```

_Note: This script automatically updates version fields across `package.json`, `manifest.json`, and related manifests._

### Step 3: Updating `CHANGELOG.md`

Add a new release section following the standard format:

```markdown
## [x.y.z] - YYYY-MM-DD

### Added

- Feature description 1
- Feature description 2

### Changed

- Refactored component X for better responsiveness

### Fixed

- Fixed issue where Y failed under condition Z
```

### Step 4: Packaging and Verification

Build and produce the production zip package:

```bash
npm run package:extension
```

Verify that the output zip artifact is generated in the build/release directory and contains all required assets (`dist/`, `manifest.json`, `assets/`, `icons/`).

---

## 3. Git Commit and Tagging Conventions

After successful packaging:

1. Commit changes: `git commit -m "chore(release): bump version to x.y.z"`
2. Tag release: `git tag vx.y.z`
3. Push to remote: `git push origin main --tags`
