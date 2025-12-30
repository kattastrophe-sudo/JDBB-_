const express = require('express');
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);
router.use(requireRole('Admin', 'Monitor'));

// Daily store sales summary (for deposit reconciliation)
router.get('/daily-store-sales', async (req, res) => {
  try {
    const { date = new Date().toISOString().split('T')[0] } = req.query;

    const result = await pool.query(
      `SELECT
         payment_type,
         COUNT(*) as transaction_count,
         SUM(price_final) as total_amount,
         SUM(CASE WHEN tax_exempt THEN 0 ELSE price_final - (price_final / 1.13) END) as total_tax
       FROM store_sales
       WHERE DATE(date_sold) = $1
       GROUP BY payment_type
       ORDER BY payment_type`,
      [date]
    );

    const summary = {
      date,
      byPaymentType: result.rows,
      grandTotal: result.rows.reduce((sum, row) => sum + parseFloat(row.total_amount), 0),
      totalTransactions: result.rows.reduce((sum, row) => sum + parseInt(row.transaction_count), 0)
    };

    res.json(summary);
  } catch (error) {
    console.error('Daily store sales error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Monthly jewellery sales summary
router.get('/monthly-jewellery-sales', async (req, res) => {
  try {
    const { year, month } = req.query;
    const currentDate = new Date();
    const targetYear = year || currentDate.getFullYear();
    const targetMonth = month || (currentDate.getMonth() + 1);

    const result = await pool.query(
      `SELECT
         s.student_id,
         s.preferred_name,
         s.legal_name,
         COUNT(ss.sale_id) as items_sold,
         SUM(ss.price_final) as total_sales,
         SUM(ss.student_share_amount) as total_earnings
       FROM students s
       JOIN store_sales ss ON s.student_id = ss.student_id
       WHERE EXTRACT(YEAR FROM ss.date_sold) = $1
         AND EXTRACT(MONTH FROM ss.date_sold) = $2
       GROUP BY s.student_id, s.preferred_name, s.legal_name
       ORDER BY total_sales DESC`,
      [targetYear, targetMonth]
    );

    res.json({
      year: targetYear,
      month: targetMonth,
      students: result.rows,
      summary: {
        totalStudents: result.rows.length,
        totalItemsSold: result.rows.reduce((sum, row) => sum + parseInt(row.items_sold), 0),
        totalSales: result.rows.reduce((sum, row) => sum + parseFloat(row.total_sales), 0),
        totalEarnings: result.rows.reduce((sum, row) => sum + parseFloat(row.total_earnings), 0)
      }
    });
  } catch (error) {
    console.error('Monthly jewellery sales error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Tool utilization report
router.get('/tool-utilization', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let query = `
      SELECT
        t.tool_id,
        t.tool_name,
        t.category,
        t.status as current_status,
        COUNT(tl.loan_id) as total_loans,
        COUNT(CASE WHEN tl.status = 'Returned' THEN 1 END) as returned,
        COUNT(CASE WHEN tl.status = 'On Loan' THEN 1 END) as currently_on_loan,
        COUNT(CASE WHEN tl.status = 'Overdue' THEN 1 END) as overdue
      FROM tools t
      LEFT JOIN tool_loans tl ON t.tool_id = tl.tool_id
      WHERE 1=1
    `;
    const params = [];

    if (startDate) {
      params.push(startDate);
      query += ` AND (tl.loan_date IS NULL OR tl.loan_date >= $${params.length})`;
    }

    if (endDate) {
      params.push(endDate);
      query += ` AND (tl.loan_date IS NULL OR tl.loan_date <= $${params.length})`;
    }

    query += `
      GROUP BY t.tool_id, t.tool_name, t.category, t.status
      ORDER BY total_loans DESC
    `;

    const result = await pool.query(query, params);

    res.json({
      tools: result.rows,
      summary: {
        totalTools: result.rows.length,
        currentlyOnLoan: result.rows.reduce((sum, row) => sum + parseInt(row.currently_on_loan), 0),
        overdue: result.rows.reduce((sum, row) => sum + parseInt(row.overdue), 0)
      }
    });
  } catch (error) {
    console.error('Tool utilization error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Student account summary
router.get('/student-account-summary/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;

    // Get student info and balance
    const studentResult = await pool.query(
      `SELECT s.*, sb.lockup_balance
       FROM students s
       LEFT JOIN student_balances sb ON s.student_id = sb.student_id
       WHERE s.student_id = $1`,
      [studentId]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const student = studentResult.rows[0];

    // Get jewellery sales
    const salesResult = await pool.query(
      `SELECT COUNT(*) as count, SUM(student_share_amount) as total_earnings
       FROM store_sales
       WHERE student_id = $1`,
      [studentId]
    );

    // Get lockup purchases
    const lockupResult = await pool.query(
      `SELECT COUNT(*) as count, SUM(total_price) as total_spent
       FROM lockup_sales
       WHERE student_id = $1`,
      [studentId]
    );

    // Get tool loans
    const loansResult = await pool.query(
      `SELECT COUNT(*) as total,
              COUNT(CASE WHEN status = 'On Loan' THEN 1 END) as active,
              COUNT(CASE WHEN status = 'Overdue' THEN 1 END) as overdue
       FROM tool_loans
       WHERE student_id = $1`,
      [studentId]
    );

    // Recent transactions
    const transactionsResult = await pool.query(
      `SELECT * FROM lockup_account_transactions
       WHERE student_id = $1
       ORDER BY date DESC, created_at DESC
       LIMIT 10`,
      [studentId]
    );

    res.json({
      student,
      jewellery: {
        itemsSold: parseInt(salesResult.rows[0].count) || 0,
        totalEarnings: parseFloat(salesResult.rows[0].total_earnings) || 0
      },
      lockup: {
        purchases: parseInt(lockupResult.rows[0].count) || 0,
        totalSpent: parseFloat(lockupResult.rows[0].total_spent) || 0
      },
      tools: {
        totalLoans: parseInt(loansResult.rows[0].total) || 0,
        activeLoans: parseInt(loansResult.rows[0].active) || 0,
        overdue: parseInt(loansResult.rows[0].overdue) || 0
      },
      recentTransactions: transactionsResult.rows
    });
  } catch (error) {
    console.error('Student account summary error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Dashboard KPIs
router.get('/dashboard', async (req, res) => {
  try {
    // Today's store sales
    const todaySales = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(price_final), 0) as total
       FROM store_sales
       WHERE DATE(date_sold) = CURRENT_DATE`
    );

    // Students with negative balances
    const negativeBalances = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(lockup_balance), 0) as total
       FROM student_balances
       WHERE lockup_balance < 0`
    );

    // Tools on loan
    const toolsOnLoan = await pool.query(
      `SELECT COUNT(*) as count
       FROM tools
       WHERE status = 'On Loan'`
    );

    // Overdue tools
    const overdueTools = await pool.query(
      `SELECT COUNT(*) as count
       FROM tool_loans
       WHERE status = 'On Loan' AND due_date < NOW()`
    );

    // Available store items
    const storeItems = await pool.query(
      `SELECT COUNT(*) as count
       FROM store_items
       WHERE status = 'Available'`
    );

    // Pending approvals
    const pendingApprovals = await pool.query(
      `SELECT COUNT(*) as count
       FROM store_items
       WHERE status = 'PendingApproval'`
    );

    // Last 30 days lockup revenue
    const lockupRevenue = await pool.query(
      `SELECT COALESCE(SUM(total_price), 0) as total
       FROM lockup_sales
       WHERE date >= CURRENT_DATE - INTERVAL '30 days'`
    );

    res.json({
      todaySales: {
        count: parseInt(todaySales.rows[0].count),
        total: parseFloat(todaySales.rows[0].total)
      },
      negativeBalances: {
        count: parseInt(negativeBalances.rows[0].count),
        totalOwing: parseFloat(negativeBalances.rows[0].total)
      },
      tools: {
        onLoan: parseInt(toolsOnLoan.rows[0].count),
        overdue: parseInt(overdueTools.rows[0].count)
      },
      store: {
        available: parseInt(storeItems.rows[0].count),
        pendingApproval: parseInt(pendingApprovals.rows[0].count)
      },
      lockupRevenue30Days: parseFloat(lockupRevenue.rows[0].total)
    });
  } catch (error) {
    console.error('Dashboard KPIs error:', error);
    res.status(500).json({ error: 'Failed to generate dashboard' });
  }
});

module.exports = router;
