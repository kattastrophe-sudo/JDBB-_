const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const pool = require('../config/database');
const { validate } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Register new user
router.post('/register',
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['Admin', 'Monitor', 'Student']).withMessage('Invalid role'),
  body('displayName').optional().trim(),
  validate,
  async (req, res) => {
    try {
      const { email, password, role, displayName } = req.body;

      // Check if user already exists
      const existingUser = await pool.query(
        'SELECT user_id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'Email already registered' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const result = await pool.query(
        `INSERT INTO users (email, password_hash, role, display_name)
         VALUES ($1, $2, $3, $4)
         RETURNING user_id, email, role, display_name`,
        [email, passwordHash, role, displayName]
      );

      const user = result.rows[0];

      res.status(201).json({
        message: 'User registered successfully',
        user: {
          userId: user.user_id,
          email: user.email,
          role: user.role,
          displayName: user.display_name
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// Login
router.post('/login',
  body('email').isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
  validate,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      // Find user
      const result = await pool.query(
        `SELECT u.user_id, u.email, u.password_hash, u.role, u.display_name, u.active,
                s.student_id, s.preferred_name, s.tag_number
         FROM users u
         LEFT JOIN students s ON u.user_id = s.user_id
         WHERE u.email = $1`,
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = result.rows[0];

      if (!user.active) {
        return res.status(403).json({ error: 'Account is inactive' });
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password_hash);

      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate JWT
      const token = jwt.sign(
        { userId: user.user_id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
      );

      res.json({
        message: 'Login successful',
        token,
        user: {
          userId: user.user_id,
          email: user.email,
          role: user.role,
          displayName: user.display_name,
          studentId: user.student_id,
          preferredName: user.preferred_name,
          tagNumber: user.tag_number
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// Get current user info
router.get('/me', authenticateToken, async (req, res) => {
  res.json({
    user: {
      userId: req.user.user_id,
      email: req.user.email,
      role: req.user.role,
      displayName: req.user.display_name,
      studentId: req.user.student_id,
      preferredName: req.user.preferred_name,
      tagNumber: req.user.tag_number
    }
  });
});

// Change password
router.post('/change-password',
  authenticateToken,
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 }),
  validate,
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      // Get current password hash
      const result = await pool.query(
        'SELECT password_hash FROM users WHERE user_id = $1',
        [req.user.user_id]
      );

      const user = result.rows[0];

      // Verify current password
      const validPassword = await bcrypt.compare(currentPassword, user.password_hash);

      if (!validPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, 10);

      // Update password
      await pool.query(
        'UPDATE users SET password_hash = $1 WHERE user_id = $2',
        [newPasswordHash, req.user.user_id]
      );

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  }
);

module.exports = router;
