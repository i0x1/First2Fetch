# Branch Strategy

This document outlines the branch structure and management strategy for First2Fetch.

## Branch Overview

### `main` (Primary Development Branch)
- **Purpose**: The main stable branch for First2Fetch with all improvements and customizations
- **Contains**: All performance optimizations, database improvements, and personalized features
- **Status**: Production-ready, actively maintained
- **Workflow**: 
  - Feature branches are merged into `main` after review
  - This is the default branch for development

### `upstream-sync` (Upstream Tracking Branch)
- **Purpose**: Automated replica of the original [First 2 Apply](https://github.com/beastx-ro/first2apply) repository's `master` branch
- **Contains**: Unmodified code from the upstream repository
- **Status**: Automatically synced daily via GitHub Actions
- **Workflow**:
  - Updated automatically by the `sync-upstream.yml` workflow
  - Runs daily at 2 AM UTC
  - Can be manually triggered via GitHub Actions UI
  - Used as a reference to compare changes and cherry-pick updates if needed

### `feat-1-ai-tools` (Feature Branch)
- **Purpose**: Feature branch containing AI tools and improvements
- **Status**: Can be merged into `main` or kept as a feature branch
- **Note**: Consider merging into `main` if the features are stable

### Other Branches
- `master`: Legacy branch (can be deprecated in favor of `main`)
- `stable`: Previous stable version (can be archived)

## Branch Management Workflow

### Daily Operations

1. **Work on Features**: Create feature branches from `main`
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feat/your-feature-name
   ```

2. **Merge Features**: Merge feature branches into `main` after review
   ```bash
   git checkout main
   git merge feat/your-feature-name
   git push origin main
   ```

3. **Check Upstream Changes**: Review what's new in the original repository
   ```bash
   git fetch upstream
   git checkout upstream-sync
   git pull origin upstream-sync
   git log HEAD..upstream/master --oneline
   ```

4. **Cherry-pick from Upstream** (if needed):
   ```bash
   git checkout main
   git cherry-pick <commit-hash>
   ```

### Automated Sync

The `upstream-sync` branch is automatically updated daily via GitHub Actions:
- **Workflow**: `.github/workflows/sync-upstream.yml`
- **Schedule**: Daily at 2 AM UTC
- **Manual Trigger**: Available in GitHub Actions tab

## Best Practices

1. **Always branch from `main`** for new features
2. **Keep `upstream-sync` clean** - don't commit directly to it
3. **Review upstream changes** periodically to see if any improvements should be integrated
4. **Use descriptive branch names**: `feat/`, `fix/`, `docs/`, `refactor/`
5. **Delete merged branches** to keep the repository clean

## Branch Protection (Recommended)

Consider setting up branch protection rules in GitHub:
- Require pull request reviews before merging to `main`
- Require status checks to pass
- Require branches to be up to date before merging

## Summary

- **`main`**: Your primary development branch with all First2Fetch improvements
- **`upstream-sync`**: Automated mirror of original repository (read-only reference)
- **Feature branches**: Created from `main` for new work
