const express = require('express');
const { body, query } = require('express-validator');
const pool = require('../config/database');
const { authenticateToken, requireRole, requireOwnershipOrRole } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all students (Admin/Monitor only)
router.get('/',
  requireRole('Admin', 'Monitor'),
  async (req, res) => {
    try {
      const { status, search } = req.query;

      let query = `
        SELECT s.*, sb.lockup_balance, sb.last_transaction_date
        FROM students s
        LEFT JOIN student_balances sb ON s.student_id = sb.student_id
        WHERE 1=1
      `;
      const params = [];

      if (status) {
        params.push(status);
        query += ` AND s.status = $${params.length}`;
      }

      if (search) {
        params.push(`%${search}%`);
        query += ` AND (
          s.legal_name ILIKE $${params.length} OR
          s.preferred_name ILIKE $${params.length} OR
          s.student_code ILIKE $${params.length} OR
          s.tag_number ILIKE $${params.length}
        )`;
      }

      query += ' ORDER BY s.legal_name';

      const result = await pool.query(query, params);

      res.json({
        students: result.rows,
        count: result.rows.length
      });
    } catch (error) {
      console.error('Get students error:', error);
      res.status(500).json({ error: 'Failed to fetch students' });
    }
  }
);

// Get student by ID
router.get('/:studentId',
  requireOwnershipOrRole('Admin', 'Monitor'),
  async (req, res) => {
    try {
      const { studentId } = req.params;

      const result = await pool.query(
        `SELECT s.*, sb.lockup_balance, sb.last_transaction_date,
                u.email as user_email, u.role
         FROM students s
         LEFT JOIN student_balances sb ON s.student_id = sb.student_id
         LEFT JOIN users u ON s.user_id = u.user_id
         WHERE s.student_id = $1`,
        [studentId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Student not found' });
      }

      res.json({ student: result.rows[0] });
    } catch (error) {
      console.error('Get student error:', error);
      res.status(500).json({ error: 'Failed to fetch student' });
    }
  }
);

// Get student by tag number (for QR scanning)
router.get('/tag/:tagNumber',
  requireRole('Admin', 'Monitor'),
  async (req, res) => {
    try {
      const { tagNumber } = req.params;

      const result = await pool.query(
        `SELECT s.*, sb.lockup_balance
         FROM students s
         LEFT JOIN student_balances sb ON s.student_id = sb.student_id
         WHERE s.tag_number = $1`,
        [tagNumber]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Student not found with this tag' });
      }

      const student = result.rows[0];

      // Return warning if negative balance
      res.json({
        student,
        warning: student.lockup_balance < 0 ? `Outstanding balance: $${Math.abs(student.lockup_balance).toFixed(2)}` : null
      });
    } catch (error) {
      console.error('Get student by tag error:', error);
      res.status(500).json({ error: 'Failed to fetch student' });
    }
  }
);

// Create new student
router.post('/',
  requireRole('Admin'),
  body('studentId').trim().notEmpty(),
  body('studentCode').trim().isLength({ min: 3, max: 10 }),
  body('tagNumber').trim().notEmpty(),
  body('legalName').trim().notEmpty(),
  body('preferredName').optional().trim(),
  body('status').isIn(['Full-time', 'Part-time']),
  validate,
  async (req, res) => {
    try {
      const {
        studentId, studentCode, tagNumber, legalName, preferredName,
        pronouns, collegeEmail, personalEmail, status, courses, notes
      } = req.body;

      // Check for duplicates
      const existing = await pool.query(
        `SELECT student_id FROM students
         WHERE student_id = $1 OR student_code = $2 OR tag_number = $3`,
        [studentId, studentCode, tagNumber]
      );

      if (existing.rows.length > 0) {
        return res.status(400).json({
          error: 'Student ID, code, or tag number already exists'
        });
      }

      const result = await pool.query(
        `INSERT INTO students (
          student_id, student_code, tag_number, legal_name, preferred_name,
          pronouns, college_email, personal_email, status, courses, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [studentId, studentCode, tagNumber, legalName, preferredName,
         pronouns, collegeEmail, personalEmail, status, courses, notes]
      );

      res.status(201).json({
        message: 'Student created successfully',
        student: result.rows[0]
      });
    } catch (error) {
      console.error('Create student error:', error);
      res.status(500).json({ error: 'Failed to create student' });
    }
  }
);

// Update student
router.put('/:studentId',
  requireOwnershipOrRole('Admin'),
  async (req, res) => {
    try {
      const { studentId } = req.params;
      const {
        preferredName, pronouns, personalEmail, courses, notes
      } = req.body;

      // Students can only update certain fields
      let allowedFields = ['preferred_name', 'pronouns', 'personal_email'];
      let values = [preferredName, pronouns, personalEmail];

      // Admins can update more fields
      if (req.user.role === 'Admin') {
        allowedFields = allowedFields.concat(['courses', 'notes']);
        values = values.concat([courses, notes]);
      }

      // Build dynamic update query
      const updates = allowedFields.map((field, i) => `${field} = $${i + 1}`).join(', ');

      const result = await pool.query(
        `UPDATE students SET ${updates}, date_updated = CURRENT_TIMESTAMP
         WHERE student_id = $${allowedFields.length + 1}
         RETURNING *`,
        [...values, studentId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Student not found' });
      }

      res.json({
        message: 'Student updated successfully',
        student: result.rows[0]
      });
    } catch (error) {
      console.error('Update student error:', error);
      res.status(500).json({ error: 'Failed to update student' });
    }
  }
);

// Get student's transaction history
router.get('/:studentId/transactions',
  requireOwnershipOrRole('Admin', 'Monitor'),
  async (req, res) => {
    try {
      const { studentId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const result = await pool.query(
        `SELECT *
         FROM lockup_account_transactions
         WHERE student_id = $1
         ORDER BY date DESC, created_at DESC
         LIMIT $2 OFFSET $3`,
        [studentId, limit, offset]
      );

      const countResult = await pool.query(
        'SELECT COUNT(*) FROM lockup_account_transactions WHERE student_id = $1',
        [studentId]
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

module.exports = router;
