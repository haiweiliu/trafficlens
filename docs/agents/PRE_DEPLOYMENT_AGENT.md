# Pre-Deployment Validation Agent

## Overview
Runs before Railway deployment to catch build errors and ensure successful deployments. Prevents deployment failures by validating code before push.

## Purpose
Catch build errors (like TypeScript compilation, Next.js build, export issues, Map/Array usage) **before** pushing to GitHub, which triggers Railway deployment.

## What It Does

### Validation Tests

1. **Critical Files Exist**
   - Checks for required files (package.json, next.config.js, tsconfig.json, etc.)
   - Validates file structure

2. **Package.json Validation**
   - Checks for required fields (name, version, scripts)
   - Validates build script exists
   - Checks for required dependencies

3. **Export Validation**
   - Verifies `getDb` is exported from `lib/db.ts`
   - Checks for common export/import issues
   - Validates async/await usage with dynamic imports

4. **Map vs Array Usage Validation**
   - Detects incorrect usage of `.length` on Map results
   - Detects array indexing `[0]` on Map results
   - Ensures `.size`, `.has()`, `.get()` are used for Maps
   - Specifically checks `getLatestTrafficDataBatch` usage

5. **TypeScript Compilation**
   - Runs `tsc --noEmit` to check for type errors
   - Catches TypeScript compilation errors

6. **Next.js Build**
   - Runs `npm run build` to test production build
   - Catches build-time errors
   - Validates the build will succeed on Railway

## Usage

### Run Before Pushing to GitHub
```bash
npm run pre-deploy
```

### In Git Hooks (Recommended)
Add to `.git/hooks/pre-push`:
```bash
#!/bin/sh
npm run pre-deploy || exit 1
```

### In CI/CD Pipeline
```yaml
# Example GitHub Actions
- name: Pre-Deployment Validation
  run: npm run pre-deploy
```

### Exit Codes
- `0` - All tests passed, safe to deploy ✅
- `1` - Tests failed, deployment will fail ❌

## Output

### Validation Report
- Individual test results
- Passed/failed counts
- Can deploy status
- Detailed error messages

## Examples

### All Tests Passed
```
📊 Pre-Deployment Validation Report:
Total Tests: 6
Passed: 6
Failed: 0
Can Deploy: ✅ YES

✅ Critical Files Exist
✅ Package.json Validation
✅ Export Validation
✅ Map vs Array Usage Validation
✅ TypeScript Compilation
✅ Next.js Build

✅ All validation tests passed - safe to deploy!
```

### Deployment Blocked
```
📊 Pre-Deployment Validation Report:
Total Tests: 6
Passed: 4
Failed: 2
Can Deploy: ❌ NO

✅ Critical Files Exist
✅ Package.json Validation
❌ Export Validation
   Error: Export validation issues found
   • getDb is not exported from lib/db.ts
❌ TypeScript Compilation
   Error: TypeScript compilation errors found
   Property 'getDb' does not exist on type...

⚠️  Deployment blocked - fix errors before pushing to GitHub
   Railway deployment will fail if you push now
```

## Common Issues It Catches

### 1. Missing Exports
- `getDb` not exported from `lib/db.ts`
- Functions used but not exported
- Import/export mismatches

### 2. Map vs Array Usage
- Using `.length` on Map results (should use `.size`)
- Using `[0]` array indexing on Map results (should use `.get()`)
- Incorrect usage of `getLatestTrafficDataBatch` results

### 3. TypeScript Errors
- Type errors that cause build failures
- Missing type definitions
- Import/export type mismatches

### 4. Build Errors
- Next.js build failures
- Missing dependencies
- Configuration issues

## Integration with Railway Deployment

### Workflow
1. **Developer runs**: `npm run pre-deploy`
2. **If passes**: Push to GitHub → Railway auto-deploys → Success ✅
3. **If fails**: Fix errors → Re-run validation → Push → Deploy ✅

### Benefits
- **Prevents failed deployments** - Catch errors before Railway builds
- **Faster feedback** - Get errors locally, not after deployment
- **Saves Railway build time** - Don't waste builds on broken code
- **Better developer experience** - Fix errors before pushing

## Best Practices

1. **Run before every push** - Add to pre-push git hook
2. **Run in CI/CD** - Double-check before deployment
3. **Fix errors immediately** - Don't push broken code
4. **Update validation rules** - Add new checks as issues are discovered

## Comparison with Deployment Verification Agent

| Feature | Pre-Deployment Agent | Deployment Verification Agent |
|---------|---------------------|------------------------------|
| **When** | Before push (local) | After deployment (remote) |
| **What** | Code/build validation | Environment/connectivity tests |
| **Catches** | Build errors, type errors | Environment issues, runtime errors |
| **Purpose** | Prevent deployment failures | Verify deployment succeeded |

**Use both**: Pre-deployment to catch code issues, deployment verification to catch environment issues.

## Git Hook Setup

### Pre-Push Hook
Create `.git/hooks/pre-push`:
```bash
#!/bin/sh
echo "Running pre-deployment validation..."
npm run pre-deploy
```

Make executable:
```bash
chmod +x .git/hooks/pre-push
```

This will automatically run validation before every push.

---

*Prevents deployment failures by catching errors before Railway builds*

