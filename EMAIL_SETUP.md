# Email Setup Guide

This guide explains how to configure email notifications for QA errors and daily usage reports.

## Overview

TrafficLens can send emails for:
- **QA Error Notifications**: Sent when QA tests fail
- **Daily Usage Reports**: Sent daily with usage statistics

## Setup Instructions

### Option 1: Gmail (Recommended for Development)

1. **Enable 2-Factor Authentication** on your Gmail account

2. **Generate App Password**:
   - Go to [Google Account Settings](https://myaccount.google.com/)
   - Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
   - Copy the 16-character password

3. **Set Environment Variables**:

   **Local Development:**
   ```bash
   export EMAIL_USER="your-email@gmail.com"
   export EMAIL_PASSWORD="your-16-char-app-password"
   export EMAIL_FROM="your-email@gmail.com"
   ```

   **Railway:**
   - Go to Railway project → Variables
   - Add:
     - `EMAIL_USER` = `your-email@gmail.com`
     - `EMAIL_PASSWORD` = `your-16-char-app-password`
     - `EMAIL_FROM` = `your-email@gmail.com`

   **GitHub Actions:**
   - Go to Repository → Settings → Secrets and variables → Actions
   - Add secrets:
     - `EMAIL_USER` = `your-email@gmail.com`
     - `EMAIL_PASSWORD` = `your-16-char-app-password`

### Option 2: SendGrid (Recommended for Production)

1. **Sign up for SendGrid** (free tier: 100 emails/day)

2. **Create API Key**:
   - Dashboard → Settings → API Keys
   - Create API Key with "Mail Send" permissions

3. **Update `lib/email.ts`**:
   ```typescript
   // Replace getTransporter() function
   function getTransporter() {
     return nodemailer.createTransport({
       host: 'smtp.sendgrid.net',
       port: 587,
       auth: {
         user: 'apikey',
         pass: process.env.SENDGRID_API_KEY,
       },
     });
   }
   ```

4. **Set Environment Variable**:
   - `SENDGRID_API_KEY` = your SendGrid API key

### Option 3: Other SMTP Services

You can use any SMTP service by updating the `getTransporter()` function in `lib/email.ts`:

```typescript
function getTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.your-provider.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
}
```

## Testing

Test email configuration:

```bash
# Test QA error email (simulate failure)
npm run qa

# Test usage report email
npm run usage:report
```

## Email Recipients

- **QA Error Emails**: Sent to `mingcomco@gmail.com`
- **Usage Reports**: Sent to `mingcomco@gmail.com`

To change the recipient, update `EMAIL_TO` in `lib/email.ts`.

## Troubleshooting

### "Email credentials not configured"

- Ensure environment variables are set
- Check variable names match exactly
- Restart the application after setting variables

### "Authentication failed"

- For Gmail: Use App Password, not regular password
- Check that 2FA is enabled
- Verify password is correct (no spaces)

### "Connection timeout"

- Check firewall settings
- Verify SMTP host and port
- Try different SMTP service

### Emails not sending

- Check application logs for errors
- Verify email credentials
- Test with manual email sending
- Check spam folder

## Security Notes

- **Never commit** email passwords to git
- Use environment variables or secrets
- Use App Passwords (Gmail) or API Keys (SendGrid)
- Rotate passwords regularly
- Use production email service (SendGrid) for production

