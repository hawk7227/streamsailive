# Supabase Email Templates for OTP Authentication

Copy these templates into your Supabase Dashboard under **Authentication > Email Templates**.

## 1. Confirm Signup Template

**Subject:** `Confirm Your Signup`

**Content:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm Your Signup</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to StreamsAI!</h1>
  </div>
  
  <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #1f2937; margin-top: 0; font-size: 24px;">Confirm Your Email Address</h2>
    
    <p style="color: #4b5563; font-size: 16px; margin-bottom: 30px;">
      Thank you for signing up! Please verify your email address by entering the verification code below:
    </p>
    
    <div style="background: #f3f4f6; border: 2px dashed #6366f1; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0;">
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">Your Verification Code</p>
      <div style="font-size: 36px; font-weight: bold; color: #6366f1; letter-spacing: 6px; font-family: 'Courier New', monospace;">
        {{ .Token }}
      </div>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
      This code will expire in 1 hour. If you didn't create an account, please ignore this email.
    </p>
    
    <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        If you have any questions, please contact our support team.
      </p>
    </div>
  </div>
</body>
</html>
```

## 2. Magic Link Template (for OTP Login)

**Subject:** `Your Login Verification Code`

**Content:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Login Verification Code</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">StreamsAI Login</h1>
  </div>
  
  <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #1f2937; margin-top: 0; font-size: 24px;">Your Verification Code</h2>
    
    <p style="color: #4b5563; font-size: 16px; margin-bottom: 30px;">
      You requested a login verification code. Use the code below to sign in to your account:
    </p>
    
    <div style="background: #f3f4f6; border: 2px dashed #6366f1; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0;">
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">Verification Code</p>
      <div style="font-size: 36px; font-weight: bold; color: #6366f1; letter-spacing: 6px; font-family: 'Courier New', monospace;">
        {{ .Token }}
      </div>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
      This code will expire in 1 hour. If you didn't request this code, please ignore this email or contact support if you have concerns.
    </p>
    
    <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        For security reasons, never share this code with anyone.
      </p>
    </div>
  </div>
</body>
</html>
```

## 3. Password Recovery Template

**Subject:** `Reset Your Password`

**Content:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Password Reset</h1>
  </div>
  
  <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #1f2937; margin-top: 0; font-size: 24px;">Reset Your Password</h2>
    
    <p style="color: #4b5563; font-size: 16px; margin-bottom: 30px;">
      You requested to reset your password. Use the verification code below to proceed:
    </p>
    
    <div style="background: #f3f4f6; border: 2px dashed #6366f1; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0;">
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">Verification Code</p>
      <div style="font-size: 36px; font-weight: bold; color: #6366f1; letter-spacing: 6px; font-family: 'Courier New', monospace;">
        {{ .Token }}
      </div>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
      This code will expire in 1 hour. If you didn't request a password reset, please ignore this email.
    </p>
    
    <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        For security reasons, never share this code with anyone.
      </p>
    </div>
  </div>
</body>
</html>
```

## 4. Email Change Template

**Subject:** `Confirm Email Change`

**Content:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm Email Change</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Confirm Email Change</h1>
  </div>
  
  <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #1f2937; margin-top: 0; font-size: 24px;">Verify Your New Email</h2>
    
    <p style="color: #4b5563; font-size: 16px; margin-bottom: 30px;">
      You requested to change your email address to <strong>{{ .NewEmail }}</strong>. Please verify this change by entering the code below:
    </p>
    
    <div style="background: #f3f4f6; border: 2px dashed #6366f1; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0;">
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">Verification Code</p>
      <div style="font-size: 36px; font-weight: bold; color: #6366f1; letter-spacing: 6px; font-family: 'Courier New', monospace;">
        {{ .Token }}
      </div>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
      This code will expire in 1 hour. If you didn't request this change, please contact support immediately.
    </p>
  </div>
</body>
</html>
```

## How to Apply These Templates

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** > **Email Templates**
3. For each template type:
   - **Confirm signup**: Update the "Confirm signup" template
   - **Magic Link**: Update the "Magic Link" template (this is used for OTP login)
   - **Recovery**: Update the "Recovery" template (for password reset)
   - **Email change**: Update the "Email change" template
4. Copy and paste the HTML content from above
5. Make sure to include `{{ .Token }}` in the template (this is the OTP code)
6. Save the template

## Important Notes

- The `{{ .Token }}` variable is the 8-digit OTP code
- The `{{ .Email }}` variable contains the user's email address
- The `{{ .NewEmail }}` variable (for email change) contains the new email address
- These templates use inline CSS for better email client compatibility
- The OTP code will be displayed prominently in a styled box

## Testing

After applying these templates:
1. Test signup flow - you should receive an email with an 8-digit OTP code
2. Test login with OTP - you should receive an email with an 8-digit OTP code
3. Verify the code works when entered in your application
