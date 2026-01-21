# 🚨 CREDENTIALS ROTATION GUIDE - URGENT

## ⚠️ SECURITY BREACH DETECTED

Your credentials were exposed in the codebase and **MUST BE ROTATED IMMEDIATELY**.

---

## ✅ COMPLETED

1. **JWT_SECRET** - ✅ Rotated to new secure 64-character hex string
2. **.env in .gitignore** - ✅ Already present

---

## 🔴 IMMEDIATE ACTIONS REQUIRED

### 1. Rotate AWS Credentials (HIGH PRIORITY)

**Steps:**

1. **Login to AWS Console**: https://console.aws.amazon.com/
2. **Go to IAM** → Users → Find the user for these keys
3. **Deactivate old keys**:
   - Old Access Key: `AKIA2CUNLWPTMNWHYCQ6`
   - Mark as "Inactive" (don't delete yet, in case in use)
4. **Create new access key**:
   - Click "Create access key"
   - Choose "Application running outside AWS"
   - Download credentials CSV
5. **Update .env file**:
   ```env
   AWS_ACCESS_KEY_ID=<your-new-key>
   AWS_SECRET_ACCESS_KEY=<your-new-secret>
   ```
6. **Test the new credentials**:
   - Restart your server
   - Try uploading a document
   - Verify S3 operations work
7. **Delete old credentials** (after confirming new ones work)

**Why this is critical:**
- Anyone with these keys can access your S3 bucket
- Could upload malicious files
- Could delete all documents
- Could incur massive AWS charges

---

### 2. Rotate Database Password (MEDIUM PRIORITY)

**Current exposed connection string:**
```
postgresql://neondb_owner:npg_l6fTGvO1FkNL@ep-tiny-math-a1pidmbs...
```

**Steps:**

1. **Login to Neon Console**: https://neon.tech/
2. **Go to your database settings**
3. **Reset password** for `neondb_owner` user
4. **Copy new connection string**
5. **Update .env**:
   ```env
   DATABASE_URL="<new-connection-string>"
   ```
6. **Restart server and test**

**Why this is important:**
- Anyone can connect to your database
- Could read all user data
- Could modify or delete data
- GDPR/privacy violation

---

### 3. Check Git History (CRITICAL if pushed to GitHub)

**If you pushed .env to a public repository:**

```bash
# Check if .env was ever committed
git log --all --full-history -- .env

# If found, you must assume credentials are compromised
# Consider the repository itself compromised
```

**If .env was pushed to GitHub:**
1. Rotate credentials IMMEDIATELY (steps above)
2. Consider creating a new repository
3. Review GitHub security alerts
4. Check AWS CloudTrail for unauthorized access

---

## 🔒 SECURITY CHECKLIST

After rotating credentials, verify:

- [ ] New JWT_SECRET in .env (64+ characters)
- [ ] New AWS credentials created and tested
- [ ] Old AWS credentials deactivated
- [ ] New database password set
- [ ] Server restarted with new credentials
- [ ] .env file in .gitignore
- [ ] .env file NOT in git history
- [ ] All existing JWT tokens invalidated (users must re-login)
- [ ] Monitor AWS CloudTrail for suspicious activity
- [ ] Monitor database logs for unauthorized access

---

## 📝 CURRENT STATUS

| Credential | Status | Action Needed |
|------------|--------|---------------|
| JWT_SECRET | ✅ ROTATED | None - already done |
| AWS Access Key | 🔴 EXPOSED | Rotate in AWS Console |
| AWS Secret Key | 🔴 EXPOSED | Rotate in AWS Console |
| Database Password | 🔴 EXPOSED | Rotate in Neon Console |
| MSG91 API Key | ⚠️ PARTIAL | Visible in code, rotate if concerned |

---

## 🛡️ PREVENTING FUTURE ISSUES

### Use Environment Variable Templates

Create `.env.example` (safe to commit):
```env
# Database
DATABASE_URL="postgresql://user:password@host/db"

# JWT
JWT_SECRET="generate-with-crypto-randomBytes"

# AWS S3
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET_NAME=your-bucket-name

# Redis
REDIS_URL="redis://localhost:6379"

# SMS
MSG91_API_KEY=your_msg91_key
```

### Add Pre-commit Hook

Create `.git/hooks/pre-commit`:
```bash
#!/bin/bash
if git diff --cached --name-only | grep -q "^.env$"; then
  echo "❌ ERROR: Attempting to commit .env file!"
  echo "This file contains secrets and should never be committed."
  exit 1
fi
```

Make it executable:
```bash
chmod +x .git/hooks/pre-commit
```

---

## 🚀 AFTER ROTATION

### Important Notes:

1. **All users must re-login** - Old JWT tokens are now invalid
2. **Test all features** - Ensure nothing breaks with new credentials
3. **Monitor logs** - Watch for authentication errors
4. **Update deployment** - If deployed, update production .env
5. **Notify team** - If working with others, inform them of the change

---

## 📞 IF YOU SUSPECT UNAUTHORIZED ACCESS

1. **Immediately deactivate all credentials**
2. **Review AWS CloudTrail logs**: Check for unauthorized S3/API calls
3. **Review database audit logs**: Check for unauthorized queries
4. **Check S3 bucket**: Look for unknown files
5. **Review user accounts**: Look for suspicious registrations
6. **Consider data breach protocol**: Notify users if personal data accessed

---

**Last Updated:** January 2026
**Severity:** 🔴 CRITICAL
**Status:** Partially resolved, manual steps required
