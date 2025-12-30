# ✅ Vercel Deployment Settings Guide

## Current Settings Review

### ✅ Good Settings:
- **Project Name**: `trafficlens` ✅
- **Root Directory**: `./` ✅
- **Repository**: `haiweiliu/trafficlens` ✅
- **Branch**: `main` ✅

### ⚠️ Needs Adjustment:

1. **Framework Preset**: Currently "Other"
   - **Should be**: `Next.js`
   - **Why**: Auto-detects build settings correctly
   - **Action**: Change dropdown to "Next.js"

2. **Team Plan**: Shows "Hobby" (Free tier)
   - **Note**: This is fine for initial deployment
   - **Action**: Upgrade to Pro AFTER deployment (for 5-minute timeout)

---

## Recommended Settings:

### Framework Preset:
```
Next.js
```

### Build and Output Settings (click "Edit" to expand):
- **Build Command**: `npm run build` (auto-detected)
- **Output Directory**: `.next` (auto-detected)
- **Install Command**: `npm install` (auto-detected)
- **Node.js Version**: `18.x` or `20.x` (auto-detected)

### Root Directory:
```
./
```

### Environment Variables:
- **None needed** for basic deployment
- (Add later if you add features requiring secrets)

---

## Step-by-Step Fix:

1. **Change Framework Preset**:
   - Click the "Framework Preset" dropdown
   - Select "Next.js" (not "Other")
   - This will auto-fill correct build settings

2. **Verify Build Settings** (optional):
   - Click "Build and Output Settings" to expand
   - Should show:
     - Build Command: `npm run build`
     - Output Directory: `.next`
   - If correct, leave as is

3. **Click "Deploy"**

---

## After Deployment:

1. **Test the deployment** (works on free tier):
   - Visit your site URL
   - Test with "Dry Run" mode ✅

2. **Upgrade to Pro** (required for real scraping):
   - Go to Project Settings → Billing
   - Click "Upgrade to Pro" ($20/month)
   - This enables 5-minute function timeout

3. **Test real scraping** (after Pro upgrade):
   - Uncheck "Dry Run"
   - Test with 1-2 domains

---

## Why Framework Preset Matters:

- **"Other"**: You have to manually configure everything
- **"Next.js"**: Auto-detects:
  - Build command
  - Output directory
  - Node.js version
  - Optimizations

**Always use "Next.js" for Next.js projects!**

