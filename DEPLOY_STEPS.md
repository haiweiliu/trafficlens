# 🚀 Deployment Steps: GitHub → Vercel

## Step 1: Push Code to GitHub

### If you haven't initialized git yet:

```bash
cd /Users/harryliu/Documents/TrafficLens

# Initialize git repository
git init

# Add all files
git add .

# Create first commit
git commit -m "Initial commit: Traffic Bulk Extractor"

# Add GitHub remote (replace with your actual username if different)
git remote add origin https://github.com/haiweiliu/trafficlens.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### If git is already initialized:

```bash
cd /Users/harryliu/Documents/TrafficLens

# Check current status
git status

# Add all files
git add .

# Commit changes
git commit -m "Ready for deployment"

# Push to GitHub
git push origin main
```

---

## Step 2: Deploy to Vercel

### Option A: Via Vercel Website (Recommended)

1. **Go to Vercel**: https://vercel.com/new
2. **Sign in** with GitHub (if not already)
3. **Click "Continue with GitHub"** button
4. **Authorize Vercel** to access your GitHub repositories
5. **Select your repository**: `haiweiliu/trafficlens`
6. **Configure Project**:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `.next` (auto-detected)
   - **Install Command**: `npm install` (auto-detected)
7. **Click "Deploy"**

### Option B: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? (select your account)
# - Link to existing project? No
# - Project name? trafficlens
# - Directory? ./
# - Override settings? No
```

---

## Step 3: ⚠️ IMPORTANT - Upgrade to Vercel Pro

**The free tier won't work!** You need Vercel Pro because:

- **Free tier**: 10-second function timeout ❌
- **Your scraping**: Needs up to 5 minutes ✅
- **Pro plan**: 5-minute timeout ✅

### How to Upgrade:

1. Go to your Vercel dashboard
2. Click on your project
3. Go to **Settings** → **Billing**
4. Click **"Upgrade to Pro"**
5. Cost: **$20/month**

**Alternative**: If you want to test first, you can:
- Deploy on free tier (will timeout on scraping)
- Test the UI with "Dry Run" mode (works fine)
- Upgrade when ready for real scraping

---

## Step 4: Configure Environment Variables (if needed)

Currently, your app doesn't need any environment variables, but if you add features later:

1. Go to Vercel dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add any variables needed

---

## Step 5: Test Your Deployment

1. **Visit your deployed URL**: `https://trafficlens.vercel.app` (or your custom domain)
2. **Test with Dry Run**:
   - Check "Dry Run (Mock Data)" checkbox
   - Paste some domains
   - Click "Run"
   - Should work immediately ✅
3. **Test Real Scraping** (requires Pro plan):
   - Uncheck "Dry Run"
   - Paste 1-2 domains
   - Click "Run"
   - Should complete in ~10-20 seconds ✅

---

## Step 6: Monitor & Optimize

### Check Logs:
1. Go to Vercel dashboard
2. Select your project
3. Click **"Deployments"** tab
4. Click on a deployment
5. Click **"Functions"** tab to see API logs

### Adjust Parallel Batches (if needed):

If you want to reduce resource usage:

1. Edit `app/api/traffic/route.ts`
2. Change line 39:
   ```typescript
   const PARALLEL_BATCHES = 2; // Instead of 3
   ```
3. Commit and push:
   ```bash
   git add app/api/traffic/route.ts
   git commit -m "Reduce parallel batches to 2"
   git push
   ```
4. Vercel will auto-deploy the changes

---

## Troubleshooting

### Build Fails:
- Check Vercel logs for errors
- Make sure `package.json` has all dependencies
- Verify Node.js version (should be 18+)

### Timeout Errors:
- Make sure you're on **Vercel Pro** plan
- Check `maxDuration = 300` in `app/api/traffic/route.ts`

### Playwright Issues:
- Playwright browsers should bundle automatically
- If not, Vercel will install them during build

### Memory Issues:
- Reduce `PARALLEL_BATCHES` from 3 to 2 or 1
- Check Vercel function logs for memory errors

---

## Next Steps After Deployment

1. **Add a custom domain** (optional):
   - Settings → Domains
   - Add your domain

2. **Set up monitoring**:
   - Vercel Analytics (optional)
   - Check function logs regularly

3. **Share your project**:
   - Update README with live demo link
   - Add to your portfolio

---

## Quick Commands Reference

```bash
# Push updates to GitHub
git add .
git commit -m "Your message"
git push

# Vercel auto-deploys on every push to main branch
# Or deploy manually:
vercel --prod
```

---

## Cost Summary

- **Vercel Pro**: $20/month
- **GitHub**: Free (public repos)
- **Total**: ~$20/month

**Alternative cheaper options** (see HOSTING.md):
- Railway: $7-15/month
- Render: $7/month
- Fly.io: Free tier available

---

## Success Checklist

- [ ] Code pushed to GitHub
- [ ] Vercel project created
- [ ] Vercel Pro plan activated
- [ ] First deployment successful
- [ ] Dry run mode tested
- [ ] Real scraping tested (with Pro plan)
- [ ] Custom domain added (optional)

🎉 **You're live!**

