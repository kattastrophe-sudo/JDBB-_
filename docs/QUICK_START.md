# Quick Start Guide

Get your JDBB system running in minutes!

## Option 1: Quick Test (No Installation)

The fastest way to see the system is to deploy it directly to free hosting:

1. **Deploy Backend** → Follow the [Deployment Guide](DEPLOYMENT_GUIDE.md) Part 1
2. **Deploy Frontend** → Follow the [Deployment Guide](DEPLOYMENT_GUIDE.md) Part 2
3. **Login** with demo accounts (see below)

## Option 2: Run Locally

### Prerequisites

Install these first:
- [Node.js 18+](https://nodejs.org/)
- [PostgreSQL 14+](https://www.postgresql.org/download/)

### Steps

1. **Install dependencies**:
   ```bash
   npm install
   cd client && npm install && cd ..
   ```

2. **Set up environment**:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and update the database settings:
   ```env
   DB_NAME=jdbb_system
   DB_USER=your_postgres_user
   DB_PASSWORD=your_postgres_password
   ```

3. **Create database**:
   ```bash
   createdb jdbb_system
   ```

4. **Run migrations**:
   ```bash
   npm run migrate
   npm run seed
   ```

5. **Start the app**:
   ```bash
   npm run dev
   ```

6. **Open browser**:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000

### Demo Login Credentials

- **Admin**: `admin@jdbb.edu` / `admin123`
- **Monitor**: `monitor@jdbb.edu` / `monitor123`
- **Student**: `student@jdbb.edu` / `student123`

## What's Next?

After logging in:

### As Admin:
- View the dashboard with KPIs
- Manage students, tools, and inventory
- Process jewellery sales
- Generate reports
- Configure system settings

### As Monitor:
- Check out tools to students
- Process lock-up materials sales
- View basic inventory

### As Student:
- Submit jewellery items for sale
- View your transaction history
- Check your account balance

## File Structure

```
JDBB-_/
├── server/             # Backend API (Node.js + Express)
│   ├── routes/         # API endpoints
│   ├── database/       # Schema and migrations
│   ├── middleware/     # Auth and validation
│   └── utils/          # Email service, helpers
│
├── client/             # Frontend (React)
│   ├── src/
│   │   ├── pages/      # Page components
│   │   ├── components/ # Reusable components
│   │   ├── services/   # API client
│   │   └── contexts/   # Auth context
│   └── package.json
│
├── docs/               # Documentation
│   ├── DEPLOYMENT_GUIDE.md
│   └── QUICK_START.md
│
├── package.json        # Backend dependencies
└── .env.example        # Environment template
```

## Key Features to Explore

1. **Student Management**
   - Create students with QR tags
   - Track account balances

2. **Tool Lending**
   - Scan QR codes for checkout
   - Automatic 24-hour loans
   - Tool reservations

3. **Jewellery Store**
   - Submit items with photos
   - Automatic fee calculation (20/15/10%)
   - HST handling
   - Student earnings tracking

4. **Lock-Up Store**
   - Precious metal pricing
   - Mixed payment methods
   - Negative balance protection

5. **Reports**
   - Daily sales summaries
   - Monthly student earnings
   - Tool utilization
   - Account balances

## Troubleshooting

### Database connection error?
- Make sure PostgreSQL is running
- Check your `.env` file has correct credentials
- Verify database `jdbb_system` exists

### Port already in use?
- Backend (3000): Change `PORT` in `.env`
- Frontend (5173): It will auto-select another port

### Can't login?
- Make sure you ran `npm run seed` to create demo accounts
- Check browser console (F12) for errors

## Need Help?

1. Check the full [Deployment Guide](DEPLOYMENT_GUIDE.md)
2. Review the error in browser console or terminal
3. Make sure all dependencies are installed
4. Verify PostgreSQL is running and accessible

## Production Deployment

When you're ready to go live:
→ See the complete [Deployment Guide](DEPLOYMENT_GUIDE.md)

It covers:
- Free hosting on Railway + Vercel
- Gmail setup for notifications
- Custom domain configuration
- Production best practices
