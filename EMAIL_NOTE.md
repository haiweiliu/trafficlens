# Email Setup Note

## Important: Railway Doesn't Provide Headless Email

Railway (and most hosting platforms) **do not provide built-in email services**. You still need SMTP credentials to send emails.

## Options:

### 1. Gmail (Easiest - Free)
- Use your Gmail account
- Generate App Password (16 characters)
- Set `EMAIL_USER` and `EMAIL_PASSWORD` in Railway

### 2. SendGrid (Recommended for Production - Free Tier: 100 emails/day)
- Sign up at sendgrid.com
- Create API Key
- Update `lib/email.ts` to use SendGrid SMTP

### 3. Test Without Email
- Run `npm run test:email` locally (will show if email is configured)
- Emails will only send if credentials are set
- If not configured, it will log a warning but won't fail

## To Test Email:

```bash
npm run test:email
```

This will attempt to send test emails. If credentials aren't set, it will show a warning but won't crash.

