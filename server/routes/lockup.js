const express = require('express');
const { body } = require('express-validator');
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();
router.use(authenticateToken);

// Get all lock-up items
router.get('/', async (req, res) => {
  try {
    const { status, category } = req.query;

    let query = 'SELECT * FROM lockup_items WHERE 1=1';
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }

    query += ' ORDER BY item_name';

    const result = await pool.query(query, params);

    res.json({ items: result.rows });
  } catch (error) {
    console.error('Get lockup items error:', error);
    res.status(500).json({ error: 'Failed to fetch lock-up items' });
  }
});

// Get lockup item by ID
router.get('/:itemId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM lockup_items WHERE item_id = $1',
      [req.params.itemId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ item: result.rows[0] });
  } catch (error) {
    console.error('Get lockup item error:', error);
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

// Create lockup item
router.post('/',
  requireRole('Admin', 'Monitor'),
  body('itemId').trim().notEmpty(),
  body('itemName').trim().notEmpty(),
  validate,
  async (req, res) => {
    try {
      const {
        itemId, itemName, category, unit, weight, sellingPrice,
        markupRate, allowedPayments, metalType, useMetalFormula, notes
      } = req.body;

      // If monitor creating, status is PendingPricing
      const status = req.user.role === 'Monitor' ? 'PendingPricing' : 'Active';

      const result = await pool.query(
        `INSERT INTO lockup_items (
          item_id, item_name, category, unit, weight, selling_price,
          markup_rate, allowed_payments, status, metal_type, use_metal_formula, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          itemId, itemName, category, unit, weight, sellingPrice,
          markupRate, allowedPayments, status, metalType, useMetalFormula, notes
        ]
      );

      res.status(201).json({
        message: 'Lock-up item created successfully',
        item: result.rows[0]
      });
    } catch (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Item ID already exists' });
      }
      console.error('Create lockup item error:', error);
      res.status(500).json({ error: 'Failed to create item' });
    }
  }
);

// Update lockup item
router.put('/:itemId',
  requireRole('Admin'),
  async (req, res) => {
    try {
      const { itemId } = req.params;
      const {
        itemName, category, unit, weight, sellingPrice,
        markupRate, allowedPayments, status, metalType, useMetalFormula, notes
      } = req.body;

      const updates = [];
      const values = [];
      let paramCount = 1;

      const fields = {
        item_name: itemName,
        category,
        unit,
        weight,
        selling_price: sellingPrice,
        markup_rate: markupRate,
        allowed_payments: allowedPayments,
        status,
        metal_type: metalType,
        use_metal_formula: useMetalFormula,
        notes
      };

      Object.entries(fields).forEach(([key, value]) => {
        if (value !== undefined) {
          updates.push(`${key} = $${paramCount}`);
          values.push(value);
          paramCount++;
        }
      });

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      values.push(itemId);

      const result = await pool.query(
        `UPDATE lockup_items SET ${updates.join(', ')}
         WHERE item_id = $${paramCount}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }

      res.json({
        message: 'Lock-up item updated successfully',
        item: result.rows[0]
      });
    } catch (error) {
      console.error('Update lockup item error:', error);
      res.status(500).json({ error: 'Failed to update item' });
    }
  }
);

// ===== LOCK-UP SALES (POS) =====

// Get all lockup sales
router.get('/sales/all',
  requireRole('Admin', 'Monitor'),
  async (req, res) => {
    try {
      const { startDate, endDate, studentId } = req.query;

      let query = `
        SELECT ls.*, li.item_name, s.preferred_name as student_name, s.tag_number
        FROM lockup_sales ls
        JOIN lockup_items li ON ls.item_id = li.item_id
        JOIN students s ON ls.student_id = s.student_id
        WHERE 1=1
      `;
      const params = [];

      if (startDate) {
        params.push(startDate);
        query += ` AND DATE(ls.date) >= $${params.length}`;
      }

      if (endDate) {
        params.push(endDate);
        query += ` AND DATE(ls.date) <= $${params.length}`;
      }

      if (studentId) {
        params.push(studentId);
        query += ` AND ls.student_id = $${params.length}`;
      }

      query += ' ORDER BY ls.date DESC';

      const result = await pool.query(query, params);

      res.json({ sales: result.rows });
    } catch (error) {
      console.error('Get lockup sales error:', error);
      res.status(500).json({ error: 'Failed to fetch sales' });
    }
  }
);

// Process lockup sale (POS)
router.post('/sales',
  requireRole('Admin', 'Monitor'),
  body('itemId').trim().notEmpty(),
  body('studentId').trim().notEmpty(),
  body('quantity').isFloat({ min: 0.001 }),
  body('totalPrice').isFloat({ min: 0 }),
  validate,
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const {
        itemId, studentId, quantity, totalPrice,
        payCash = 0, payOneCard = 0, payAccount = 0, notes
      } = req.body;

      // Validate payment total
      const paymentTotal = parseFloat(payCash) + parseFloat(payOneCard) + parseFloat(payAccount);
      if (Math.abs(paymentTotal - totalPrice) > 0.01) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Payment amounts do not match total price',
          expected: totalPrice,
          received: paymentTotal
        });
      }

      // Check student balance if using account
      if (payAccount > 0) {
        const balanceResult = await client.query(
          'SELECT lockup_balance FROM student_balances WHERE student_id = $1',
          [studentId]
        );

        if (balanceResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Student not found' });
        }

        const currentBalance = parseFloat(balanceResult.rows[0].lockup_balance) || 0;

        // Check if balance would go negative
        if (currentBalance - payAccount < 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: 'Insufficient account balance',
            currentBalance,
            attempted: payAccount,
            message: 'Override required (admin only) or use different payment method'
          });
        }
      }

      // Determine payment methods used
      const paymentMethods = [];
      if (payCash > 0) paymentMethods.push('Cash');
      if (payOneCard > 0) paymentMethods.push('OneCard');
      if (payAccount > 0) paymentMethods.push('LockupAccount');

      // Create sale
      const saleResult = await client.query(
        `INSERT INTO lockup_sales (
          item_id, student_id, quantity, total_price,
          payment_method, payment_cash, payment_onecard, payment_account,
          notes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          itemId, studentId, quantity, totalPrice,
          paymentMethods, payCash, payOneCard, payAccount,
          notes, req.user.user_id
        ]
      );

      const saleId = saleResult.rows[0].sale_id;

      // Post to transactions ledger
      if (payAccount > 0) {
        await client.query(
          `INSERT INTO lockup_account_transactions (
            student_id, type, description, amount, related_id, related_table, created_by
          ) VALUES ($1, 'Sale', $2, $3, $4, 'lockup_sales', $5)`,
          [
            studentId,
            `Lock-up purchase - ${itemId} (${quantity} ${req.body.unit || 'units'})`,
            -payAccount, // Negative = charge
            saleId,
            req.user.user_id
          ]
        );
      }

      await client.query('COMMIT');

      res.status(201).json({
        message: 'Sale completed successfully',
        sale: saleResult.rows[0]
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Create lockup sale error:', error);
      res.status(500).json({ error: 'Failed to process sale' });
    } finally {
      client.release();
    }
  }
);

// Calculate metal price (helper endpoint)
router.post('/calculate-metal-price',
  requireRole('Admin', 'Monitor'),
  body('metalType').notEmpty(),
  body('weight').isFloat({ min: 0 }),
  validate,
  async (req, res) => {
    try {
      const { metalType, weight, includeLabor = false } = req.body;

      // Get current metal pricing
      const result = await pool.query(
        `SELECT * FROM metal_pricing
         WHERE metal_type = $1 AND is_current = TRUE
         LIMIT 1`,
        [metalType]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Metal pricing not found for this type' });
      }

      const metal = result.rows[0];

      // Formula: (spot_per_troy_ounce / 31.1035) * purity * weight * (1 + markup) + labor
      const pricePerGram = (parseFloat(metal.spot_per_troy_ounce) / 31.1035) * parseFloat(metal.purity);
      const basePrice = pricePerGram * parseFloat(weight);
      const withMarkup = basePrice * (1 + parseFloat(metal.markup_default));
      const finalPrice = withMarkup + (includeLabor ? parseFloat(metal.labor_fee_default) : 0);

      res.json({
        metalType,
        weight,
        spotPerOunce: metal.spot_per_troy_ounce,
        purity: metal.purity,
        pricePerGram: pricePerGram.toFixed(2),
        basePrice: basePrice.toFixed(2),
        markup: metal.markup_default,
        laborFee: includeLabor ? metal.labor_fee_default : 0,
        suggestedPrice: finalPrice.toFixed(2)
      });
    } catch (error) {
      console.error('Calculate metal price error:', error);
      res.status(500).json({ error: 'Failed to calculate price' });
    }
  }
);

module.exports = router;
