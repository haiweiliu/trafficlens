# Resend Email Setup Guide

## Current Status

✅ Resend API integrated - No password needed!
✅ API Key: `re_FE3PUPVu_PeUXuBgaC3NMbAYsQf7MqUd2`

## Important: Resend Free Tier Limitation

**Resend's free tier only allows sending emails to your account email address** (`liamleeforemedia@gmail.com`).

To send to `mingcomco@gmail.com`, you have two options:

---

## Option 1: Verify Your Domain (Recommended) ⭐

This allows you to send to any email address.

### Steps:

1. **Go to Resend Dashboard**: [resend.com/domains](https://resend.com/domains)

2. **Add Domain**:
   - Click "Add Domain"
   - Enter your domain (e.g., `trafficlens.com` or any domain you own)
   - Follow DNS verification steps

3. **Update Environment Variable**:
   ```bash
   EMAIL_FROM=noreply@yourdomain.com
   ```

4. **Done!** Now you can send to any email address.

---

## Option 2: Use Account Email for Testing

For now, you can test with your Resend account email:

```bash
# Set environment variable
export EMAIL_TO=liamleeforemedia@gmail.com
```

Then emails will work immediately (no domain verification needed).

---

## Quick Setup for Railway

### If Using Account Email (Quick Test):

1. **Railway Dashboard** → Your Project → Variables
2. Add:
   - `RESEND_API_KEY` = `re_FE3PUPVu_PeUXuBgaC3NMbAYsQf7MqUd2`
   - `EMAIL_TO` = `liamleeforemedia@gmail.com` (for testing)

### If Using Verified Domain (Production):

1. **Verify domain** in Resend dashboard
2. **Railway Dashboard** → Your Project → Variables
3. Add:
   - `RESEND_API_KEY` = `re_FE3PUPVu_PeUXuBgaC3NMbAYsQf7MqUd2`
   - `EMAIL_FROM` = `noreply@yourdomain.com`
   - `EMAIL_TO` = `mingcomco@gmail.com`

---

## Test Email

```bash
# Test with account email (works immediately)
RESEND_API_KEY=re_FE3PUPVu_PeUXuBgaC3NMbAYsQf7MqUd2 EMAIL_TO=liamleeforemedia@gmail.com npm run test:email

# Or test with your API key as argument
npm run test:email -- re_FE3PUPVu_PeUXuBgaC3NMbAYsQf7MqUd2
```

---

## Alternative: Use SendGrid (No Domain Verification Needed)

If you don't want to verify a domain, SendGrid allows sending to any email with just API key:

1. Sign up at [sendgrid.com](https://sendgrid.com)
2. Get API key
3. I can update the code to use SendGrid instead

---

## Current Configuration

- **Service**: Resend
- **API Key**: `re_FE3PUPVu_PeUXuBgaC3NMbAYsQf7MqUd2`
- **From**: `onboarding@resend.dev` (default)
- **To**: `mingcomco@gmail.com` (requires domain verification)

**Next Step**: Verify a domain in Resend to send to `mingcomco@gmail.com`, or use `liamleeforemedia@gmail.com` for testing.

