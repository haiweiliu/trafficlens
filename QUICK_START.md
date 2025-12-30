# ⚡ Quick Start: Deploy to GitHub → Vercel

## Step 1: Push to GitHub (Choose One Method)

### Method A: Run the Script (Easiest)
```bash
cd /Users/harryliu/Documents/TrafficLens
./push-to-github.sh
```

### Method B: Manual Commands
```bash
cd /Users/harryliu/Documents/TrafficLens

# Initialize git
git init
git branch -M main

# Add GitHub remote
git remote add origin https://github.com/haiweiliu/trafficlens.git

# Add and commit files
git add .
git commit -m "Initial commit: Traffic Bulk Extractor"

# Push to GitHub
git push -u origin main
```

**Note**: You'll be prompted for GitHub username/password or can use a Personal Access Token.

---

## Step 2: Deploy to Vercel

1. **Go to**: https://vercel.com/new
2. **Click**: "Continue with GitHub" button
3. **Authorize** Vercel to access your GitHub
4. **Select**: `haiweiliu/trafficlens` repository
5. **Click**: "Deploy" (settings are auto-detected)
6. **Wait**: ~2-3 minutes for build to complete

---

## Step 3: ⚠️ Upgrade to Vercel Pro (Required!)

**Why?** Free tier has 10-second timeout. Your scraping needs 5 minutes.

1. In Vercel dashboard → Your project
2. **Settings** → **Billing**
3. Click **"Upgrade to Pro"** ($20/month)

**Alternative**: Test with "Dry Run" mode first (works on free tier)

---

## Step 4: Test Your Live Site

1. Visit: `https://trafficlens.vercel.app` (or your custom URL)
2. Test with **Dry Run** (works on free tier):
   - ✅ Check "Dry Run (Mock Data)"
   - ✅ Paste domains
   - ✅ Click "Run"
3. Test **Real Scraping** (needs Pro):
   - ✅ Uncheck "Dry Run"
   - ✅ Paste 1-2 domains
   - ✅ Click "Run"

---

## 🎉 Done!

Your app is now live! Every time you push to GitHub, Vercel auto-deploys.

---

## Need Help?

- **Detailed steps**: See `DEPLOY_STEPS.md`
- **Hosting options**: See `HOSTING.md`
- **Troubleshooting**: Check Vercel deployment logs

