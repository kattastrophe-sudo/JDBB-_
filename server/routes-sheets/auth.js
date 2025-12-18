const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const { findRow, queryRows, appendRow } = require('../config/sheets');
const { validate } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Login
router.post('/login',
  body('email').isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
  validate,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      // Find user by email
      const userRow = await findRow('Users', 'email', email);

      if (!userRow) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = userRow.data;

      // Check if active
      if (user.active !== 'true') {
        return res.status(403).json({ error: 'Account is inactive' });
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, user.passwordHash);

      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // If student, get student info
      let studentInfo = null;
      if (user.role === 'Student') {
        const studentRow = await findRow('Students', 'userId', user.userId);
        if (studentRow) {
          studentInfo = studentRow.data;
        }
      }

      // Generate JWT
      const token = jwt.sign(
        { userId: user.userId, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
      );

      res.json({
        message: 'Login successful',
        token,
        user: {
          userId: user.userId,
          email: user.email,
          role: user.role,
          displayName: user.displayName,
          studentId: studentInfo?.studentId,
          preferredName: studentInfo?.preferredName,
          tagNumber: studentInfo?.tagNumber,
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
      tagNumber: req.user.tag_number,
    }
  });
});

// Register (Admin only for now - can be opened up later)
router.post('/register',
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['Admin', 'Monitor', 'Student']),
  validate,
  async (req, res) => {
    try {
      const { email, password, role, displayName } = req.body;

      // Check if user exists
      const existing = await findRow('Users', 'email', email);
      if (existing) {
        return res.status(400).json({ error: 'Email already registered' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Generate userId
      const userId = `user-${Date.now()}`;

      // Create user
      await appendRow('Users', [
        userId,
        email,
        passwordHash,
        role,
        displayName || '',
        'true',
        new Date().toISOString(),
      ]);

      res.status(201).json({
        message: 'User registered successfully',
        user: { userId, email, role, displayName }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

module.exports = router;
