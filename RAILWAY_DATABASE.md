# 🗄️ Database Setup for Railway

## Database Storage Options

### Option 1: Railway Volume (Recommended for Persistence)
Railway provides persistent volumes for database storage.

**Setup:**
1. In Railway dashboard → Your service
2. Click **"Settings"** → **"Volumes"**
3. Click **"+ New Volume"**
4. Name: `data`
5. Mount path: `/data`
6. Set environment variable: `DATABASE_PATH=/data/traffic.db`

**Benefits:**
- ✅ Data persists across deployments
- ✅ Survives service restarts
- ✅ Can backup easily

### Option 2: Railway PostgreSQL (For Production Scale)
If you need more robust database:

1. In Railway → **"+ New"** → **"Database"** → **"Add PostgreSQL"**
2. Connect to your service
3. Update code to use PostgreSQL instead of SQLite

### Option 3: Ephemeral Storage (Current - Works but data lost on restart)
- Database stored in service filesystem
- Works for testing
- Data lost on service restart/redeploy
- **Fine for MVP/testing**

## Current Setup (Ephemeral)

The code currently uses SQLite with:
- Default path: `./data/traffic.db`
- Auto-creates on first use
- Works immediately (no setup needed)

**For production**, add a Railway Volume (Option 1) for persistence.

## Database Location

- **Local dev**: `./data/traffic.db`
- **Railway (ephemeral)**: `./data/traffic.db` (in service filesystem)
- **Railway (with volume)**: `/data/traffic.db` (persistent)

## Migration to PostgreSQL (Future)

If you want PostgreSQL later:
1. Add Railway PostgreSQL database
2. Update `lib/db.ts` to use `pg` instead of `better-sqlite3`
3. Schema is SQL-compatible (works with both)

---

**Current setup works immediately. Add volume later for persistence!**

