const express = require('express');
const multer = require('multer');
const path = require('path');
const { body } = require('express-validator');
const pool = require('../config/database');
const { authenticateToken, requireRole, requireOwnershipOrRole } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();
router.use(authenticateToken);

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/images');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, webp)'));
    }
  }
});

// Get all store items
router.get('/', async (req, res) => {
  try {
    const { status, studentId, type } = req.query;

    let query = `
      SELECT si.*, s.preferred_name as student_name, s.student_code
      FROM store_items si
      JOIN students s ON si.student_id = s.student_id
      WHERE 1=1
    `;
    const params = [];

    // Students can only see their own items or approved items
    if (req.user.role === 'Student') {
      params.push(req.user.student_id);
      query += ` AND (si.student_id = $${params.length} OR si.status = 'Available')`;
    }

    if (status) {
      params.push(status);
      query += ` AND si.status = $${params.length}`;
    }

    if (studentId) {
      params.push(studentId);
      query += ` AND si.student_id = $${params.length}`;
    }

    if (type) {
      params.push(type);
      query += ` AND si.type = $${params.length}`;
    }

    query += ' ORDER BY si.date_submitted DESC';

    const result = await pool.query(query, params);

    res.json({ items: result.rows });
  } catch (error) {
    console.error('Get store items error:', error);
    res.status(500).json({ error: 'Failed to fetch store items' });
  }
});

// Get store item by ID
router.get('/:itemId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT si.*, s.preferred_name as student_name, s.student_code,
              s.college_email, s.personal_email
       FROM store_items si
       JOIN students s ON si.student_id = s.student_id
       WHERE si.item_id = $1`,
      [req.params.itemId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = result.rows[0];

    // Students can only see their own items or approved items
    if (req.user.role === 'Student' &&
        item.student_id !== req.user.student_id &&
        item.status !== 'Available') {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ item });
  } catch (error) {
    console.error('Get store item error:', error);
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

// Create store item (submit jewellery)
router.post('/',
  upload.array('images', 3),
  body('studentId').trim().notEmpty(),
  body('itemName').trim().notEmpty(),
  body('priceFinal').isFloat({ min: 0 }),
  body('type').isIn(['Store', 'Custom', 'Repair']),
  validate,
  async (req, res) => {
    try {
      const {
        studentId, itemName, category, materials, size,
        priceFinal, type, notes
      } = req.body;

      // Students can only create items for themselves
      if (req.user.role === 'Student' && studentId !== req.user.student_id) {
        return res.status(403).json({ error: 'You can only submit items for yourself' });
      }

      // Generate item ID (student code + sequential number)
      const studentResult = await pool.query(
        'SELECT student_code FROM students WHERE student_id = $1',
        [studentId]
      );

      if (studentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Student not found' });
      }

      const studentCode = studentResult.rows[0].student_code;

      // Get next number for this student
      const countResult = await pool.query(
        `SELECT COUNT(*) as count FROM store_items WHERE student_id = $1`,
        [studentId]
      );

      const nextNum = parseInt(countResult.rows[0].count) + 1;
      const itemId = `${studentCode}${String(nextNum).padStart(3, '0')}`;

      // Get image paths
      const images = req.files ? req.files.map(f => f.path) : [];

      const result = await pool.query(
        `INSERT INTO store_items (
          item_id, student_id, item_name, category, materials, size,
          images, price_final, type, status, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          itemId, studentId, itemName, category, materials, size,
          images, priceFinal, type,
          req.user.role === 'Student' ? 'PendingApproval' : 'Available',
          notes
        ]
      );

      res.status(201).json({
        message: 'Item submitted successfully',
        item: result.rows[0]
      });
    } catch (error) {
      console.error('Create store item error:', error);
      res.status(500).json({ error: 'Failed to create item' });
    }
  }
);

// Update store item
router.put('/:itemId',
  upload.array('images', 3),
  async (req, res) => {
    try {
      const { itemId } = req.params;
      const { itemName, category, materials, size, priceFinal, type, notes, status } = req.body;

      // Get current item
      const currentItem = await pool.query(
        'SELECT * FROM store_items WHERE item_id = $1',
        [itemId]
      );

      if (currentItem.rows.length === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }

      const item = currentItem.rows[0];

      // Check permissions
      const isOwner = req.user.student_id === item.student_id;
      const isAdmin = req.user.role === 'Admin';

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Students can't edit sold items
      if (isOwner && !isAdmin && item.status === 'Sold') {
        return res.status(400).json({ error: 'Cannot edit sold items' });
      }

      // Get new images if uploaded
      let images = item.images;
      if (req.files && req.files.length > 0) {
        images = req.files.map(f => f.path);
      }

      // Build update
      const updates = [];
      const values = [];
      let paramCount = 1;

      const fields = { itemName, category, materials, size, priceFinal, type, notes, images };

      // Only admin can change status
      if (isAdmin && status) {
        fields.status = status;
      }

      Object.entries(fields).forEach(([key, value]) => {
        if (value !== undefined) {
          const columnName = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
          updates.push(`${columnName} = $${paramCount}`);
          values.push(value);
          paramCount++;
        }
      });

      values.push(itemId);

      const result = await pool.query(
        `UPDATE store_items SET ${updates.join(', ')}
         WHERE item_id = $${paramCount}
         RETURNING *`,
        values
      );

      res.json({
        message: 'Item updated successfully',
        item: result.rows[0]
      });
    } catch (error) {
      console.error('Update store item error:', error);
      res.status(500).json({ error: 'Failed to update item' });
    }
  }
);

// Delete/Remove store item
router.delete('/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;

    const item = await pool.query(
      'SELECT * FROM store_items WHERE item_id = $1',
      [itemId]
    );

    if (item.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const isOwner = req.user.student_id === item.rows[0].student_id;
    const isAdmin = req.user.role === 'Admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (item.rows[0].status === 'Sold') {
      return res.status(400).json({ error: 'Cannot delete sold items' });
    }

    // Soft delete - mark as Removed
    await pool.query(
      `UPDATE store_items SET status = 'Removed' WHERE item_id = $1`,
      [itemId]
    );

    res.json({ message: 'Item removed successfully' });
  } catch (error) {
    console.error('Delete store item error:', error);
    res.status(500).json({ error: 'Failed to remove item' });
  }
});

// ===== STORE SALES (POS) =====

// Process sale
router.post('/sales',
  requireRole('Admin', 'Monitor'),
  body('itemId').trim().notEmpty(),
  body('paymentType').isIn(['Visa', 'MC', 'Debit']),
  body('taxExempt').optional().isBoolean(),
  validate,
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { itemId, paymentType, taxExempt } = req.body;

      // Get item
      const itemResult = await client.query(
        'SELECT * FROM store_items WHERE item_id = $1',
        [itemId]
      );

      if (itemResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Item not found' });
      }

      const item = itemResult.rows[0];

      if (item.status !== 'Available') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Item is not available for sale' });
      }

      // Create sale
      const saleResult = await client.query(
        `INSERT INTO store_sales (
          item_id, student_id, payment_type, tax_exempt,
          price_final, store_fee_amount, student_share_amount, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          itemId,
          item.student_id,
          paymentType,
          taxExempt || false,
          item.price_final,
          item.store_fee_amount,
          item.student_share,
          req.user.user_id
        ]
      );

      // Update item status
      await client.query(
        `UPDATE store_items SET status = 'Sold', date_sold = CURRENT_DATE
         WHERE item_id = $1`,
        [itemId]
      );

      // Post student share as credit to their account
      await client.query(
        `INSERT INTO lockup_account_transactions (
          student_id, type, description, amount, related_id, related_table, created_by
        ) VALUES ($1, 'Credit', $2, $3, $4, 'store_sales', $5)`,
        [
          item.student_id,
          `Jewellery sale - ${itemId}`,
          item.student_share,
          saleResult.rows[0].sale_id,
          req.user.user_id
        ]
      );

      await client.query('COMMIT');

      res.status(201).json({
        message: 'Sale completed successfully',
        sale: saleResult.rows[0],
        studentShare: item.student_share
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Create sale error:', error);
      res.status(500).json({ error: 'Failed to process sale' });
    } finally {
      client.release();
    }
  }
);

// Get all sales
router.get('/sales/all',
  requireRole('Admin', 'Monitor'),
  async (req, res) => {
    try {
      const { startDate, endDate, paymentType } = req.query;

      let query = `
        SELECT ss.*, si.item_name, s.preferred_name as student_name
        FROM store_sales ss
        JOIN store_items si ON ss.item_id = si.item_id
        JOIN students s ON ss.student_id = s.student_id
        WHERE 1=1
      `;
      const params = [];

      if (startDate) {
        params.push(startDate);
        query += ` AND DATE(ss.date_sold) >= $${params.length}`;
      }

      if (endDate) {
        params.push(endDate);
        query += ` AND DATE(ss.date_sold) <= $${params.length}`;
      }

      if (paymentType) {
        params.push(paymentType);
        query += ` AND ss.payment_type = $${params.length}`;
      }

      query += ' ORDER BY ss.date_sold DESC';

      const result = await pool.query(query, params);

      res.json({ sales: result.rows });
    } catch (error) {
      console.error('Get sales error:', error);
      res.status(500).json({ error: 'Failed to fetch sales' });
    }
  }
);

module.exports = router;
