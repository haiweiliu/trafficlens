# Quick Deployment Guide

## ⚡ Fastest: Vercel (Recommended for Next.js)

1. Push code to GitHub
2. Go to https://vercel.com
3. Click "Import Project"
4. Connect your GitHub repo
5. Deploy!

**⚠️ Important**: You need **Vercel Pro** ($20/month) because:
- Free tier has 10-second function timeout
- Scraping needs up to 5 minutes
- Pro plan allows 5-minute timeout ✅

---

## 🚂 Railway (Good Alternative)

1. Push code to GitHub
2. Go to https://railway.app
3. "New Project" → "Deploy from GitHub repo"
4. Select your repo
5. Railway auto-detects Next.js

**Cost**: ~$7-15/month (pay-as-you-go)

---

## 📦 Resource Requirements

### Current Speed (3 parallel batches):
- **CPU**: 2 vCPU cores
- **Memory**: 1-2 GB RAM
- **Timeout**: 5 minutes minimum

### Slower but cheaper (2 parallel):
- Edit `app/api/traffic/route.ts`:
  ```typescript
  const PARALLEL_BATCHES = 2; // Change from 3 to 2
  ```
- **Memory**: 600-800 MB
- Works on smaller hosting plans

### Sequential (slowest, but cheapest):
  ```typescript
  const PARALLEL_BATCHES = 1; // Change to 1
  ```
- **Memory**: 300-400 MB
- Works on free tiers (but slower)

---

## 🔧 Before Deploying

1. Test locally: `npm run build`
2. Check `.env` files aren't committed (they're in .gitignore)
3. Playwright browsers bundle automatically - no extra setup needed!

---

## 💰 Cost Comparison

| Platform | Cost/Month | Best For |
|----------|------------|----------|
| Vercel Pro | $20 | Production, easiest setup |
| Railway | $7-15 | Flexible, pay-as-you-go |
| Render | $7 | Fixed cost, predictable |
| Fly.io | Free-10 | Light usage, experimentation |

