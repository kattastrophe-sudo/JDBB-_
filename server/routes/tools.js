const express = require('express');
const { body } = require('express-validator');
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();
router.use(authenticateToken);

// Get all tools
router.get('/', async (req, res) => {
  try {
    const { status, search } = req.query;

    let query = 'SELECT * FROM tools WHERE 1=1';
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (tool_name ILIKE $${params.length} OR tool_id ILIKE $${params.length})`;
    }

    query += ' ORDER BY tool_name';

    const result = await pool.query(query, params);

    res.json({ tools: result.rows });
  } catch (error) {
    console.error('Get tools error:', error);
    res.status(500).json({ error: 'Failed to fetch tools' });
  }
});

// Get tool by ID
router.get('/:toolId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*,
              (SELECT json_agg(json_build_object(
                'loanId', tl.loan_id,
                'studentId', tl.student_id,
                'studentName', s.preferred_name,
                'loanDate', tl.loan_date,
                'dueDate', tl.due_date,
                'status', tl.status
              ))
              FROM tool_loans tl
              JOIN students s ON tl.student_id = s.student_id
              WHERE tl.tool_id = t.tool_id
              ORDER BY tl.loan_date DESC
              LIMIT 10) as recent_loans
       FROM tools t
       WHERE t.tool_id = $1`,
      [req.params.toolId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tool not found' });
    }

    res.json({ tool: result.rows[0] });
  } catch (error) {
    console.error('Get tool error:', error);
    res.status(500).json({ error: 'Failed to fetch tool' });
  }
});

// Create tool
router.post('/',
  requireRole('Admin'),
  body('toolId').trim().notEmpty(),
  body('toolName').trim().notEmpty(),
  validate,
  async (req, res) => {
    try {
      const { toolId, toolName, category, replacementCost, isKit, location, notes } = req.body;

      const result = await pool.query(
        `INSERT INTO tools (tool_id, tool_name, category, replacement_cost, is_kit, location, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [toolId, toolName, category, replacementCost, isKit, location, notes]
      );

      res.status(201).json({
        message: 'Tool created successfully',
        tool: result.rows[0]
      });
    } catch (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Tool ID already exists' });
      }
      console.error('Create tool error:', error);
      res.status(500).json({ error: 'Failed to create tool' });
    }
  }
);

// ===== TOOL LOANS =====

// Get all loans
router.get('/loans/all', requireRole('Admin', 'Monitor'), async (req, res) => {
  try {
    const { status } = req.query;

    let query = `
      SELECT tl.*, t.tool_name, s.preferred_name as student_name, s.tag_number
      FROM tool_loans tl
      JOIN tools t ON tl.tool_id = t.tool_id
      JOIN students s ON tl.student_id = s.student_id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND tl.status = $${params.length}`;
    }

    query += ' ORDER BY tl.loan_date DESC';

    const result = await pool.query(query, params);

    res.json({ loans: result.rows });
  } catch (error) {
    console.error('Get loans error:', error);
    res.status(500).json({ error: 'Failed to fetch loans' });
  }
});

// Create loan (checkout)
router.post('/loans',
  requireRole('Admin', 'Monitor'),
  body('toolId').trim().notEmpty(),
  body('studentId').trim().notEmpty(),
  validate,
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { toolId, studentId } = req.body;

      // Check tool availability
      const toolCheck = await client.query(
        'SELECT status FROM tools WHERE tool_id = $1',
        [toolId]
      );

      if (toolCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Tool not found' });
      }

      if (toolCheck.rows[0].status !== 'Available') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Tool is not available' });
      }

      // Check student exists
      const studentCheck = await client.query(
        'SELECT student_id FROM students WHERE student_id = $1',
        [studentId]
      );

      if (studentCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Student not found' });
      }

      // Create loan (due date = loan date + 24 hours)
      const loanResult = await client.query(
        `INSERT INTO tool_loans (tool_id, student_id, loan_date, due_date, created_by)
         VALUES ($1, $2, NOW(), NOW() + INTERVAL '24 hours', $3)
         RETURNING *`,
        [toolId, studentId, req.user.user_id]
      );

      // Update tool status
      await client.query(
        'UPDATE tools SET status = $1 WHERE tool_id = $2',
        ['On Loan', toolId]
      );

      await client.query('COMMIT');

      res.status(201).json({
        message: 'Tool checked out successfully',
        loan: loanResult.rows[0]
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Create loan error:', error);
      res.status(500).json({ error: 'Failed to checkout tool' });
    } finally {
      client.release();
    }
  }
);

// Return tool
router.put('/loans/:loanId/return',
  requireRole('Admin', 'Monitor'),
  body('condition').optional().trim(),
  validate,
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { loanId } = req.params;
      const { condition, damageFee } = req.body;

      // Get loan info
      const loanResult = await client.query(
        'SELECT * FROM tool_loans WHERE loan_id = $1',
        [loanId]
      );

      if (loanResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Loan not found' });
      }

      const loan = loanResult.rows[0];

      if (loan.status === 'Returned') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Tool already returned' });
      }

      // Update loan
      await client.query(
        `UPDATE tool_loans
         SET return_date = NOW(), condition = $1, status = 'Returned'
         WHERE loan_id = $2`,
        [condition, loanId]
      );

      // Update tool status
      await client.query(
        'UPDATE tools SET status = $1 WHERE tool_id = $2',
        ['Available', loan.tool_id]
      );

      // If damage fee, post to transactions
      if (damageFee && damageFee > 0) {
        await client.query(
          `INSERT INTO lockup_account_transactions
           (student_id, type, description, amount, related_id, related_table, created_by)
           VALUES ($1, 'Fee', $2, $3, $4, 'tool_loans', $5)`,
          [
            loan.student_id,
            `Tool damage fee - ${loan.tool_id}`,
            -Math.abs(damageFee),
            loanId,
            req.user.user_id
          ]
        );
      }

      // Check for reservations
      const reservation = await client.query(
        `SELECT * FROM tool_reservations
         WHERE tool_id = $1 AND status = 'Pending'
         ORDER BY requested_at
         LIMIT 1`,
        [loan.tool_id]
      );

      if (reservation.rows.length > 0) {
        // Notify next student (would trigger email)
        await client.query(
          `UPDATE tool_reservations
           SET status = 'Notified', notified_at = NOW(), expires_at = NOW() + INTERVAL '24 hours'
           WHERE reservation_id = $1`,
          [reservation.rows[0].reservation_id]
        );
      }

      await client.query('COMMIT');

      res.json({
        message: 'Tool returned successfully',
        damageFeesPosted: damageFee > 0
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Return tool error:', error);
      res.status(500).json({ error: 'Failed to return tool' });
    } finally {
      client.release();
    }
  }
);

// Create reservation
router.post('/reservations',
  body('toolId').trim().notEmpty(),
  body('studentId').trim().notEmpty(),
  validate,
  async (req, res) => {
    try {
      const { toolId, studentId } = req.body;

      // Check if student already has pending reservation for this tool
      const existing = await pool.query(
        `SELECT reservation_id FROM tool_reservations
         WHERE tool_id = $1 AND student_id = $2 AND status = 'Pending'`,
        [toolId, studentId]
      );

      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'You already have a pending reservation for this tool' });
      }

      const result = await pool.query(
        `INSERT INTO tool_reservations (tool_id, student_id)
         VALUES ($1, $2)
         RETURNING *`,
        [toolId, studentId]
      );

      res.status(201).json({
        message: 'Reservation created successfully',
        reservation: result.rows[0]
      });
    } catch (error) {
      console.error('Create reservation error:', error);
      res.status(500).json({ error: 'Failed to create reservation' });
    }
  }
);

module.exports = router;
