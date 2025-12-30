# JDBB - Jewellery & Lock-Up Management System

A comprehensive management system for art/jewellery programs that handles:
- **Student Management** - QR-tagged student profiles and account tracking
- **Tool Lending** - Equipment loans, reservations, and damage tracking
- **Lock-Up Store** - Materials and supplies sales with precious metal pricing
- **Jewellery Store** - Student consignment sales with tiered fee structures
- **Financial Ledger** - Unified transaction tracking and account balances

## Features

### 👥 Multi-Role Access
- **Admin** - Full system access, pricing, reports, configurations
- **Studio Monitor** - Tool crib operations, lock-up sales, basic inventory
- **Student** - Submit jewellery, view sales, check balances, update profile

### 🔧 Tool Lending System
- QR code-based tool checkout/return
- Automatic 24-hour loan periods
- Damage reporting with photo upload
- Automated replacement fee posting
- Tool reservation queue with email notifications

### 🏪 Lock-Up Materials Store
- Dynamic precious metal pricing (spot price formulas)
- Mixed payment methods (Cash, OneCard, Account credit)
- Negative balance controls
- QR-labeled inventory

### 💎 Jewellery Consignment Store
- Tiered program fees (20% / 15% / 10% based on price)
- Automatic HST calculation
- Tax-exempt sales support
- Custom work & repair tracking (flat 15% fee)
- Student payout management (cheque or credit to account)

### 💰 Financial Management
- Unified transaction ledger
- Real-time student balance calculation
- Daily sales summaries by payment type (Visa/MC/Debit)
- Automated email reminders for outstanding balances
- Monthly student earnings reports

### 📧 Automated Communications
- Sale notifications to students
- Balance reminders (every 3 days)
- Tool return reminders
- Reservation availability alerts
- Monthly sales summaries

### 📊 Reporting & Analytics
- Daily deposit reconciliation reports
- Student account ledgers
- Sales dashboards and KPIs
- Tool utilization tracking
- Quarterly archiving for data management

## Tech Stack

- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **Frontend**: React + Material-UI
- **QR Codes**: qrcode library
- **Email**: Nodemailer
- **Authentication**: JWT with role-based access control

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd JDBB-_
```

2. Install dependencies:
```bash
npm install
cd client && npm install && cd ..
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database and email credentials
```

4. Initialize the database:
```bash
npm run migrate
npm run seed  # Optional: load sample data
```

5. Start the development server:
```bash
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

## Project Structure

```
JDBB-_/
├── server/              # Backend API
│   ├── config/         # Configuration files
│   ├── database/       # Database schema, migrations, seeds
│   ├── middleware/     # Auth, validation, error handling
│   ├── models/         # Data models
│   ├── routes/         # API endpoints
│   ├── services/       # Business logic
│   └── utils/          # Helper functions (QR, email, etc.)
├── client/             # Frontend React app
│   ├── src/
│   │   ├── components/ # Reusable UI components
│   │   ├── pages/      # Page components (Admin, Monitor, Student)
│   │   ├── services/   # API client
│   │   ├── hooks/      # Custom React hooks
│   │   └── utils/      # Frontend utilities
│   └── public/         # Static assets
├── uploads/            # File uploads (images, QR codes)
└── docs/              # Additional documentation
```

## Database Schema

### Core Tables
- **Students** - Student profiles, QR tags, contact info
- **Tools** - Tool inventory and status
- **ToolLoans** - Loan transactions and returns
- **StoreItems** - Jewellery consignment inventory
- **StoreSales** - Jewellery sales records
- **LockupItems** - Materials and supplies inventory
- **LockupSales** - Lock-up purchase records
- **LockupAccountTransactions** - Unified financial ledger

### Configuration Tables
- **Categories** - Dropdown options for all modules
- **EmailTemplates** - Automated message templates
- **MetalPricing** - Current spot prices and purities
- **FeeTiers** - Configurable fee rate thresholds
- **Users** - System users and roles
- **ToolReservations** - Tool waitlist queue
- **Payouts** - Student earnings payout tracking

## API Documentation

API documentation will be available at `/api/docs` when running the server.

Key endpoint groups:
- `/api/auth` - Authentication
- `/api/students` - Student management
- `/api/tools` - Tool inventory and loans
- `/api/store` - Jewellery store operations
- `/api/lockup` - Materials store operations
- `/api/transactions` - Financial ledger
- `/api/reports` - Analytics and exports
- `/api/qr` - QR code generation

## Deployment

### Web Deployment
Instructions for deploying to cloud platforms (Heroku, Railway, DigitalOcean, etc.)

### Desktop Application
To package as a desktop app using Electron:
```bash
npm run build:desktop
```

## License

MIT License - see LICENSE file for details

## Support

For issues and questions, please open a GitHub issue.

---

**Built to replace fragmented Excel workflows with a unified, automated system for art and jewellery program management.**