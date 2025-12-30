# Hosting Requirements & Recommendations

## ⚠️ Important: GitHub Pages Won't Work

GitHub Pages only serves **static files**. This app requires:
- Server-side API routes (Next.js API routes)
- Playwright (headless browser automation)
- Node.js runtime

You'll need a **serverless/hosting platform** instead.

---

## Recommended Hosting Platforms

### 1. **Vercel** (Best for Next.js) ⭐ Recommended
- **Free Tier**: 
  - 100GB bandwidth/month
  - Serverless functions with 10s timeout (Hobby plan)
  - **10s timeout won't work** for scraping (need Pro plan)
- **Pro Plan** ($20/month):
  - 5-minute function timeout ✅
  - 1,000 serverless function executions/day
  - Better for production use
- **CPU**: Shared (adequate for moderate usage)
- **Memory**: 1024 MB default (enough for 3 parallel browsers)

**Deploy**: Just connect your GitHub repo to Vercel

---

### 2. **Railway** 
- **Free Tier**: $5 credit/month
- **Pay-as-you-go**: ~$0.01/hour for basic instance
- **CPU**: 1-2 vCPU available
- **Memory**: 512MB - 8GB (adjustable)
- **Timeout**: No strict timeout limit ✅
- Good for continuous running

**Cost**: ~$7-15/month for moderate usage

---

### 3. **Render**
- **Free Tier**: Available but with limitations
- **Starter Plan** ($7/month):
  - 512 MB RAM
  - No timeout limits ✅
- **CPU**: Shared (1 core)
- **Memory**: Upgradeable

---

### 4. **Fly.io**
- **Free Tier**: 3 shared VMs
- **CPU**: Shared (0.25 vCPU)
- **Memory**: 256MB free
- **Timeout**: No limits ✅
- Pay for what you use

---

## Resource Requirements for Current Speed

### Current Configuration
- **Parallel Batches**: 3 batches simultaneously
- **Browser Instances**: 3 Chromium instances at once
- **Memory per Browser**: ~150-300 MB
- **CPU**: Moderate (single-threaded JS, but parallel processes)

### Minimum Requirements

**For 3 parallel batches (current speed):**
- **CPU**: 2 vCPU cores (or shared equivalent)
- **Memory**: 1-2 GB RAM
- **Network**: Good bandwidth (for multiple browser instances)

**Why these requirements?**
- Each Playwright browser instance uses ~150-300 MB RAM
- 3 parallel = ~450-900 MB RAM just for browsers
- Plus Node.js runtime (~100-200 MB)
- Plus OS overhead

---

## Optimization Options for Hosting

### Option 1: Reduce Parallel Batches
```typescript
// In app/api/traffic/route.ts
const PARALLEL_BATCHES = 2; // Instead of 3
```
- **Memory**: ~600-700 MB (instead of 1 GB)
- **Speed**: ~33% slower but more resource-friendly
- **Good for**: Free/smaller hosting tiers

### Option 2: Sequential Processing
```typescript
const PARALLEL_BATCHES = 1; // Back to sequential
```
- **Memory**: ~300-400 MB
- **Speed**: 3x slower (but still acceptable)
- **Good for**: Very limited resources

### Option 3: Use Playwright's Browser Pooling
- Reuse browser instances instead of creating new ones
- More complex but uses less memory
- Requires code refactoring

---

## Estimated Monthly Costs

### Scenario: Processing 1,000 domains/day

**Vercel Pro**:
- $20/month base
- Function executions: ~100 batches/day = 3,000/month (within limit)

**Railway**:
- ~$0.01/hour × 24 hours = $0.24/day
- ~$7/month for continuous service
- Pay only when running (could be cheaper)

**Render**:
- $7/month (Starter plan)
- Fixed cost, predictable

**Fly.io**:
- Free tier might be enough for light usage
- Pay-as-you-go if you exceed

---

## Performance vs Cost Trade-offs

| Configuration | Speed | Memory | CPU | Best For |
|--------------|-------|--------|-----|----------|
| 3 parallel (current) | Fastest | 1-2 GB | 2 vCPU | Vercel Pro, Railway |
| 2 parallel | Fast | 600-800 MB | 1-2 vCPU | Railway, Render |
| 1 sequential | Slow | 300-400 MB | 1 vCPU | Free tiers, light usage |

---

## Deployment Recommendations

### For Personal/Portfolio Use
1. **Vercel Pro** ($20/month) - Easiest, best Next.js integration
2. **Railway** ($7-15/month) - Good balance of cost/features

### For Production/Commercial Use
1. **Vercel Pro** - If budget allows
2. **Railway** - More flexible, better for scaling
3. **Self-hosted VPS** - Most control, requires maintenance

### For Testing/Development
1. **Vercel Hobby** (free) - For testing (but timeout limits)
2. **Railway** (free tier) - For continuous testing
3. **Fly.io** (free tier) - For experimentation

---

## Quick Start: Deploy to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your GitHub repository
4. Vercel auto-detects Next.js
5. Deploy!

**Note**: You'll need Pro plan ($20/month) for 5-minute timeout needed for scraping.

---

## Environment Variables Needed

Create `.env` or set in hosting platform:
```bash
# No secrets needed for basic usage
# Playwright browsers are bundled automatically
```

---

## Monitoring & Limits

Watch out for:
- **Function timeout** (10s on Vercel Hobby, 5min on Pro)
- **Memory limits** (1GB default on Vercel)
- **CPU throttling** on shared plans
- **Rate limiting** from Traffic.cv (already handled in code)

---

## Alternative: Client-Side Only (No Server)

If you want to avoid hosting costs entirely:
- Use GitHub Pages for static hosting
- Run scraping from user's browser (using Playwright CDP)
- **Limitation**: Requires user to have browser extension or local install
- **Not recommended** for production use

