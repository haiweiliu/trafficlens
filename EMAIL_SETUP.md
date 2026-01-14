# Email Setup Guide

This guide explains how to configure email notifications for QA errors, daily usage reports, and comprehensive daily summaries.

## Overview

TrafficLens uses **Resend** for email notifications and can send:
- **QA Error Notifications**: Sent when QA tests fail
- **Daily Usage Reports**: Sent with usage statistics
- **Comprehensive Daily Reports**: Combined QA, usage, and system health in one email

**Default Recipient**: `mingcomco@gmail.com`

## Quick Setup (5 minutes)

### Step 1: Get a Resend API Key

1. Sign up at [resend.com](https://resend.com) (free tier: 3,000 emails/month)
2. Go to API Keys → Create API Key
3. Copy the key (starts with `re_`)

### Step 2: Configure Environment Variables

**Local Development:**
```bash
export RESEND_API_KEY="re_xxxxxx"
export EMAIL_TO="mingcomco@gmail.com"
export EMAIL_FROM="onboarding@resend.dev"  # Default sender

# Then test:
npm run test:email
```

**Railway:**
1. Go to Railway project → Variables
2. Add: `RESEND_API_KEY` = `re_xxxxxx`

**GitHub Actions (for daily reports):**
1. Go to Repository → Settings → Secrets and variables → Actions
2. Add secret: `RESEND_API_KEY` = `re_xxxxxx`
3. Optionally add: `EMAIL_TO` = `mingcomco@gmail.com`

## Testing Email

```bash
# Test all email types
npm run test:email

# Or pass API key directly
npm run test:email -- re_xxxxxx

# Generate and send daily report
npm run report:daily
```

## Email Schedule

| Email | Schedule | Trigger |
|-------|----------|---------|
| QA Error Email | On failure | Automatic via QA agent |
| Daily Report | 9 AM UTC | GitHub Actions (cron) |

## Custom Domain (Optional)

The free tier only allows sending from `onboarding@resend.dev`. To send from your own domain:

1. Go to [resend.com/domains](https://resend.com/domains)
2. Add your domain
3. Add DNS records (MX, SPF, DKIM)
4. Update `EMAIL_FROM` environment variable

## Email Types

### 1. QA Error Email (`sendQAErrorEmail`)
- Sent when QA tests fail
- Includes failed test details
- Shows auto-fixed vs manual-fix-needed

### 2. Usage Report Email (`sendUsageReportEmail`)
- Daily usage statistics
- Domain counts, cache hits/misses
- Total visits tracked

### 3. Comprehensive Daily Report (`generateDailyReport`)
- Combined QA + Usage + System Health
- Beautiful HTML format
- Sent via `npm run report:daily`

## Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `RESEND_API_KEY` | Resend API key (required) | - |
| `EMAIL_TO` | Recipient email | `mingcomco@gmail.com` |
| `EMAIL_FROM` | Sender email | `onboarding@resend.dev` |

## Troubleshooting

### "RESEND_API_KEY not configured"
- Ensure the environment variable is set
- Restart the application after setting

### "Can only send testing emails to your own email"
- Free tier limitation
- Add and verify a domain at resend.com/domains
- Or use the email associated with your Resend account

### Emails not arriving
- Check spam/junk folder
- Verify API key is correct
- Check GitHub Actions logs
- Test locally with `npm run test:email`

### Daily report not sending
- Ensure `RESEND_API_KEY` secret is set in GitHub
- Check GitHub Actions → Daily Report workflow
- Manually trigger: Actions → Daily Report → Run workflow

## Manual Email Triggers

```bash
# Send test QA error email
npm run test:email

# Generate and send daily report manually
npm run report:daily

# Run QA tests (will email on failure if configured)
npm run qa
```

## Security Notes

- ✅ Never commit API keys to git
- ✅ Use GitHub Secrets for CI/CD
- ✅ Use Railway Variables for production
- ✅ Rotate API keys periodically
