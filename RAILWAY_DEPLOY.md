# 🚂 Deploy to Railway (5 Minutes - Works Immediately)

## Why Railway?

- ✅ **Playwright works perfectly** (full filesystem access)
- ✅ **Cheaper** than Vercel Pro ($7-15/month vs $20/month)
- ✅ **No code changes** needed
- ✅ **Same deployment ease** (GitHub integration)

## Step-by-Step

### 1. Go to Railway
Visit: https://railway.app

### 2. Sign in with GitHub
- Click "Login"
- Authorize Railway to access GitHub

### 3. Create New Project
- Click "New Project"
- Select "Deploy from GitHub repo"
- Choose `haiweiliu/trafficlens`

### 4. Railway Auto-Detects
- Framework: Next.js ✅
- Build command: `npm run build` ✅
- Start command: `npm start` ✅

### 5. Add Environment Variable (Optional)
- Go to "Variables" tab
- Add: `NODE_ENV=production` (usually auto-set)

### 6. Deploy!
- Railway automatically:
  - Installs dependencies
  - Runs `npm run build`
  - Installs Playwright browsers
  - Starts the app

### 7. Get Your URL
- Railway provides: `trafficlens.up.railway.app`
- Or add custom domain in settings

## That's It!

Your app will work immediately because Railway:
- Has full filesystem access
- Can install Playwright browsers at runtime
- Supports long-running processes

## Cost

- **Free tier**: $5 credit/month (good for testing)
- **Pay-as-you-go**: ~$0.01/hour = ~$7-15/month
- **Much cheaper** than Vercel Pro!

## Migration from Vercel

1. Deploy to Railway (above steps)
2. Test it works
3. Cancel Vercel Pro (if you want)
4. Update any bookmarks/links

---

**Total time: 5 minutes**
**Result: Working Playwright scraping! ✅**

