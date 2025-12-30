# JDBB System - Deployment Guide

Complete guide to deploying your Jewellery & Lock-Up Management System.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Production Deployment (FREE Hosting)](#production-deployment-free-hosting)
4. [Gmail Setup for Email Notifications](#gmail-setup-for-email-notifications)
5. [Connecting Your Domain](#connecting-your-domain)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Node.js 18 or higher ([Download here](https://nodejs.org/))
- PostgreSQL 14 or higher (for local development)
- A Gmail account (for email notifications)
- Your custom domain (you mentioned you have one)

---

## Local Development Setup

### 1. Install Dependencies

```bash
# Install backend dependencies
cd JDBB-_
npm install

# Install frontend dependencies
cd client
npm install
cd ..
```

### 2. Set Up PostgreSQL Database

**Option A: Install PostgreSQL locally**
- Download from https://www.postgresql.org/download/
- Create a database: `createdb jdbb_system`

**Option B: Use a free online PostgreSQL** (easier for testing)
- Sign up at https://railway.app or https://render.com
- Create a free PostgreSQL database
- Copy the connection string

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=jdbb_system
DB_USER=your_postgres_username
DB_PASSWORD=your_postgres_password

# JWT Secret (generate a random string)
JWT_SECRET=your-super-secret-key-change-this

# Email (configure later)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM="JDBB System <noreply@jdbb.com>"

# URLs
CLIENT_URL=http://localhost:5173
API_URL=http://localhost:3000
```

### 4. Initialize the Database

```bash
# Run migrations to create tables
npm run migrate

# Load sample data (optional)
npm run seed
```

### 5. Start Development Servers

```bash
# Start both frontend and backend
npm run dev
```

The app will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000

### 6. Test Login

Use the sample accounts:
- **Admin**: admin@jdbb.edu / admin123
- **Monitor**: monitor@jdbb.edu / monitor123
- **Student**: student@jdbb.edu / student123

---

## Production Deployment (FREE Hosting)

We'll use **Railway** for the backend/database and **Vercel** for the frontend.

### Part 1: Deploy Backend + Database (Railway)

#### Step 1: Create Railway Account

1. Go to https://railway.app
2. Sign up with GitHub (free)
3. Click "New Project"

#### Step 2: Add PostgreSQL Database

1. Click "+ New" → "Database" → "Add PostgreSQL"
2. Railway will provision a free PostgreSQL database
3. Click on the PostgreSQL service
4. Go to "Variables" tab
5. Copy these values (you'll need them):
   - `PGHOST`
   - `PGPORT`
   - `PGDATABASE`
   - `PGUSER`
   - `PGPASSWORD`

#### Step 3: Deploy Backend

1. In Railway project, click "+ New" → "GitHub Repo"
2. Connect your GitHub account
3. Select your `JDBB-_` repository
4. Railway will auto-detect Node.js
5. Go to "Variables" tab and add these:

```
NODE_ENV=production
PORT=3000
DB_HOST=(value from PGHOST)
DB_PORT=(value from PGPORT)
DB_NAME=(value from PGDATABASE)
DB_USER=(value from PGUSER)
DB_PASSWORD=(value from PGPASSWORD)
JWT_SECRET=your-super-secret-production-key
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-gmail-app-password
EMAIL_FROM="JDBB System <noreply@jdbb.com>"
CLIENT_URL=https://your-app.vercel.app
```

6. Go to "Settings" tab:
   - Set "Root Directory" to `/` (leave empty or enter `/`)
   - Set "Build Command" to `npm install`
   - Set "Start Command" to `npm start`

7. Click "Deploy"

#### Step 4: Run Database Migrations

After deployment:

1. In Railway, click on your backend service
2. Go to "Settings" → "Service"
3. Copy the deployment URL (e.g., `yourapp.railway.app`)
4. In your local terminal, update `.env` to point to Railway database
5. Run: `npm run migrate`

Alternatively, use Railway's built-in terminal:
1. Click on backend service → "Terminal" tab
2. Run: `node server/database/migrate.js`
3. Run: `node server/database/seed.js` (for sample data)

#### Step 5: Get Your Backend URL

1. Go to "Settings" → "Networking"
2. Click "Generate Domain"
3. Copy the URL (e.g., `https://jdbb-production.up.railway.app`)
4. Save this – you'll need it for the frontend!

---

### Part 2: Deploy Frontend (Vercel)

#### Step 1: Build Configuration

In your `client/` directory, create a file `.env.production`:

```env
VITE_API_URL=https://your-railway-backend.railway.app/api
```

Replace `your-railway-backend.railway.app` with your actual Railway URL.

#### Step 2: Deploy to Vercel

1. Go to https://vercel.com
2. Sign up with GitHub (free)
3. Click "Add New Project"
4. Import your `JDBB-_` repository
5. Configure:
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

6. Add Environment Variable:
   - Name: `VITE_API_URL`
   - Value: `https://your-railway-backend.railway.app/api`

7. Click "Deploy"

#### Step 3: Get Your Frontend URL

After deployment completes, Vercel will give you a URL like:
- `https://jdbb.vercel.app`

---

### Part 3: Update Backend with Frontend URL

1. Go back to Railway
2. Click on your backend service → "Variables"
3. Update `CLIENT_URL` to your Vercel URL:
   ```
   CLIENT_URL=https://jdbb.vercel.app
   ```
4. Railway will automatically redeploy

---

## Gmail Setup for Email Notifications

### Step 1: Create Gmail App Password

1. Go to https://myaccount.google.com
2. Click "Security" (left sidebar)
3. Scroll to "2-Step Verification" – **enable it if not already on**
4. Scroll to "App passwords" (below 2-Step Verification)
5. Click "App passwords"
6. Select:
   - App: "Mail"
   - Device: "Other" → Enter "JDBB System"
7. Click "Generate"
8. **COPY THE 16-CHARACTER PASSWORD** (you won't see it again!)

### Step 2: Add to Railway Environment Variables

1. In Railway, go to your backend service → "Variables"
2. Update:
   ```
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=the-16-character-app-password
   ```

### Step 3: Test Email

Once deployed, test by:
1. Login as Admin
2. Create a jewellery sale
3. Student should receive an email notification

**Note**: Free Gmail accounts have a sending limit (~500 emails/day). For production use with many students, consider upgrading to Google Workspace or using SendGrid.

---

## Connecting Your Domain

### Option 1: Connect Domain to Vercel (Frontend)

1. In Vercel, go to your project → "Settings" → "Domains"
2. Click "Add Domain"
3. Enter your domain (e.g., `jdbb.yourschool.edu`)
4. Vercel will show DNS records to add
5. Go to your domain registrar (GoDaddy, Namecheap, etc.)
6. Add the DNS records Vercel provides
7. Wait 24-48 hours for DNS propagation

### Option 2: Use Custom Subdomain

If you have a school domain, create a subdomain:
- Frontend: `jdbb.yourschool.edu`
- Backend: `jdbb-api.yourschool.edu`

Follow the same process for both Vercel and Railway.

---

## Troubleshooting

### Database Connection Errors

**Error**: `connection refused` or `database does not exist`

**Solution**:
1. Check Railway database is running
2. Verify environment variables are correct
3. Run migrations: `npm run migrate`

### CORS Errors in Browser

**Error**: `Access to fetch at ... has been blocked by CORS policy`

**Solution**:
1. Verify `CLIENT_URL` in Railway matches your Vercel URL exactly
2. Make sure both URLs use HTTPS (not HTTP)
3. Redeploy backend after changing `CLIENT_URL`

### Email Notifications Not Sending

**Error**: `Invalid login` or `authentication failed`

**Solution**:
1. Make sure 2-Step Verification is enabled in Gmail
2. Use App Password (not your regular Gmail password)
3. Check `EMAIL_USER` and `EMAIL_PASSWORD` in Railway variables
4. Verify you're using the 16-character app password

### Frontend Build Fails

**Error**: Build fails on Vercel

**Solution**:
1. Check `client/package.json` has all dependencies
2. Run `npm install && npm run build` locally to test
3. Check Vercel build logs for specific errors
4. Ensure `VITE_API_URL` environment variable is set

### Can't Login / JWT Errors

**Error**: `Invalid token` or `Authentication failed`

**Solution**:
1. Make sure `JWT_SECRET` is set in Railway
2. Clear browser localStorage (DevTools → Application → Local Storage)
3. Try login again

---

## Next Steps

After successful deployment:

1. **Change Default Passwords**
   - Login as admin
   - Change the default admin password
   - Delete or update the sample accounts

2. **Add Real Students**
   - Go to Admin → Students
   - Create real student records
   - Generate their QR tags

3. **Configure Email Templates**
   - Go to Admin → Settings → Email Templates
   - Customize notification messages

4. **Set Metal Prices**
   - Go to Admin → Settings → Metal Pricing
   - Update spot prices for silver/gold

5. **Monitor Usage**
   - Check Railway dashboard for database usage
   - Monitor Vercel for bandwidth
   - Both have generous free tiers!

---

## Support & Questions

If you run into issues:

1. Check the browser console (F12) for frontend errors
2. Check Railway logs for backend errors
3. Review this guide carefully
4. Open a GitHub issue in your repository

---

**Congratulations!** Your JDBB system is now live and accessible worldwide!

Your students can access it at your custom domain, and you can manage everything from the admin panel.
