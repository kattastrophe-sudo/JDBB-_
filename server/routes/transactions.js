const express = require('express');
const { body } = require('express-validator');
const pool = require('../config/database');
const { authenticateToken, requireRole, requireOwnershipOrRole } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();
router.use(authenticateToken);

// Get all transactions (Admin/Monitor)
router.get('/',
  requireRole('Admin', 'Monitor'),
  async (req, res) => {
    try {
      const { studentId, type, startDate, endDate, limit = 100, offset = 0 } = req.query;

      let query = `
        SELECT t.*, s.preferred_name as student_name, s.tag_number,
               u.display_name as created_by_name
        FROM lockup_account_transactions t
        JOIN students s ON t.student_id = s.student_id
        LEFT JOIN users u ON t.created_by = u.user_id
        WHERE 1=1
      `;
      const params = [];

      if (studentId) {
        params.push(studentId);
        query += ` AND t.student_id = $${params.length}`;
      }

      if (type) {
        params.push(type);
        query += ` AND t.type = $${params.length}`;
      }

      if (startDate) {
        params.push(startDate);
        query += ` AND t.date >= $${params.length}`;
      }

      if (endDate) {
        params.push(endDate);
        query += ` AND t.date <= $${params.length}`;
      }

      query += ' ORDER BY t.date DESC, t.created_at DESC';

      params.push(limit, offset);
      query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

      const result = await pool.query(query, params);

      const countResult = await pool.query(
        'SELECT COUNT(*) FROM lockup_account_transactions WHERE 1=1',
        []
      );

      res.json({
        transactions: result.rows,
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    } catch (error) {
      console.error('Get transactions error:', error);
      res.status(500).json({ error: 'Failed to fetch transactions' });
    }
  }
);

// Get transactions for specific student
router.get('/student/:studentId',
  requireOwnershipOrRole('Admin', 'Monitor'),
  async (req, res) => {
    try {
      const { studentId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const result = await pool.query(
        `SELECT t.*, u.display_name as created_by_name
         FROM lockup_account_transactions t
         LEFT JOIN users u ON t.created_by = u.user_id
         WHERE t.student_id = $1
         ORDER BY t.date DESC, t.created_at DESC
         LIMIT $2 OFFSET $3`,
        [studentId, limit, offset]
      );

      const balanceResult = await pool.query(
        'SELECT lockup_balance FROM student_balances WHERE student_id = $1',
        [studentId]
      );

      res.json({
        transactions: result.rows,
        currentBalance: balanceResult.rows[0]?.lockup_balance || 0,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    } catch (error) {
      console.error('Get student transactions error:', error);
      res.status(500).json({ error: 'Failed to fetch transactions' });
    }
  }
);

// Create manual transaction (Admin only)
router.post('/',
  requireRole('Admin'),
  body('studentId').trim().notEmpty(),
  body('type').isIn(['Sale', 'Fee', 'Payment', 'Credit', 'Adjustment']),
  body('description').trim().notEmpty(),
  body('amount').isFloat(),
  validate,
  async (req, res) => {
    try {
      const { studentId, type, description, amount, notes } = req.body;

      // Validate student exists
      const studentCheck = await pool.query(
        'SELECT student_id FROM students WHERE student_id = $1',
        [studentId]
      );

      if (studentCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Student not found' });
      }

      const result = await pool.query(
        `INSERT INTO lockup_account_transactions (
          student_id, type, description, amount, created_by
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,
        [studentId, type, description, amount, req.user.user_id]
      );

      // Get updated balance
      const balanceResult = await pool.query(
        'SELECT lockup_balance FROM student_balances WHERE student_id = $1',
        [studentId]
      );

      res.status(201).json({
        message: 'Transaction created successfully',
        transaction: result.rows[0],
        newBalance: balanceResult.rows[0]?.lockup_balance || 0
      });
    } catch (error) {
      console.error('Create transaction error:', error);
      res.status(500).json({ error: 'Failed to create transaction' });
    }
  }
);

// Get students with negative balances
router.get('/balances/negative',
  requireRole('Admin', 'Monitor'),
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT sb.*, s.preferred_name, s.legal_name, s.college_email, s.personal_email
         FROM student_balances sb
         JOIN students s ON sb.student_id = s.student_id
         WHERE sb.lockup_balance < 0
         ORDER BY sb.lockup_balance ASC`
      );

      res.json({
        students: result.rows,
        count: result.rows.length,
        totalOwing: result.rows.reduce((sum, s) => sum + parseFloat(s.lockup_balance), 0)
      });
    } catch (error) {
      console.error('Get negative balances error:', error);
      res.status(500).json({ error: 'Failed to fetch balances' });
    }
  }
);

// Get all student balances
router.get('/balances/all',
  requireRole('Admin', 'Monitor'),
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT sb.*, s.preferred_name, s.legal_name, s.status
         FROM student_balances sb
         JOIN students s ON sb.student_id = s.student_id
         ORDER BY s.preferred_name`
      );

      const summary = {
        totalStudents: result.rows.length,
        positiveBalances: result.rows.filter(s => parseFloat(s.lockup_balance) > 0).length,
        negativeBalances: result.rows.filter(s => parseFloat(s.lockup_balance) < 0).length,
        zeroBalances: result.rows.filter(s => parseFloat(s.lockup_balance) === 0).length,
        totalCredit: result.rows.reduce((sum, s) => {
          const bal = parseFloat(s.lockup_balance);
          return bal > 0 ? sum + bal : sum;
        }, 0),
        totalOwing: result.rows.reduce((sum, s) => {
          const bal = parseFloat(s.lockup_balance);
          return bal < 0 ? sum + bal : sum;
        }, 0)
      };

      res.json({
        balances: result.rows,
        summary
      });
    } catch (error) {
      console.error('Get all balances error:', error);
      res.status(500).json({ error: 'Failed to fetch balances' });
    }
  }
);

module.exports = router;
