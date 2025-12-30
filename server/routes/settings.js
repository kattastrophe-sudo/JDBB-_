const express = require('express');
const { body } = require('express-validator');
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();
router.use(authenticateToken);

// ===== CATEGORIES =====

// Get all categories
router.get('/categories', async (req, res) => {
  try {
    const { domain } = req.query;

    let query = 'SELECT * FROM categories WHERE is_active = TRUE';
    const params = [];

    if (domain) {
      params.push(domain);
      query += ` AND domain = $${params.length}`;
    }

    query += ' ORDER BY domain, sort_order, name';

    const result = await pool.query(query, params);

    res.json({ categories: result.rows });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Create category (Admin only)
router.post('/categories',
  requireRole('Admin'),
  body('categoryId').trim().notEmpty(),
  body('domain').isIn(['Tool', 'JewelleryItem', 'Material', 'Stone', 'Pronouns', 'Payment', 'MetalType']),
  body('name').trim().notEmpty(),
  validate,
  async (req, res) => {
    try {
      const { categoryId, domain, name, sortOrder = 0 } = req.body;

      const result = await pool.query(
        `INSERT INTO categories (category_id, domain, name, sort_order)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [categoryId, domain, name, sortOrder]
      );

      res.status(201).json({
        message: 'Category created successfully',
        category: result.rows[0]
      });
    } catch (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Category ID already exists' });
      }
      console.error('Create category error:', error);
      res.status(500).json({ error: 'Failed to create category' });
    }
  }
);

// ===== EMAIL TEMPLATES =====

// Get all email templates
router.get('/email-templates',
  requireRole('Admin'),
  async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT * FROM email_templates ORDER BY name'
      );

      res.json({ templates: result.rows });
    } catch (error) {
      console.error('Get email templates error:', error);
      res.status(500).json({ error: 'Failed to fetch templates' });
    }
  }
);

// Get email template by ID
router.get('/email-templates/:templateId',
  requireRole('Admin'),
  async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT * FROM email_templates WHERE template_id = $1',
        [req.params.templateId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Template not found' });
      }

      res.json({ template: result.rows[0] });
    } catch (error) {
      console.error('Get email template error:', error);
      res.status(500).json({ error: 'Failed to fetch template' });
    }
  }
);

// Update email template
router.put('/email-templates/:templateId',
  requireRole('Admin'),
  body('subject').optional().trim(),
  body('body').optional().trim(),
  validate,
  async (req, res) => {
    try {
      const { templateId } = req.params;
      const { name, subject, body, isActive, notes } = req.body;

      const updates = [];
      const values = [];
      let paramCount = 1;

      const fields = { name, subject, body, is_active: isActive, notes };

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

      values.push(templateId);

      const result = await pool.query(
        `UPDATE email_templates SET ${updates.join(', ')}
         WHERE template_id = $${paramCount}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Template not found' });
      }

      res.json({
        message: 'Template updated successfully',
        template: result.rows[0]
      });
    } catch (error) {
      console.error('Update email template error:', error);
      res.status(500).json({ error: 'Failed to update template' });
    }
  }
);

// ===== METAL PRICING =====

// Get current metal pricing
router.get('/metal-pricing', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM metal_pricing
       WHERE is_current = TRUE
       ORDER BY metal_type`
    );

    res.json({ pricing: result.rows });
  } catch (error) {
    console.error('Get metal pricing error:', error);
    res.status(500).json({ error: 'Failed to fetch metal pricing' });
  }
});

// Update metal pricing (Admin only)
router.put('/metal-pricing/:metalId',
  requireRole('Admin'),
  body('spotPerTroyOunce').optional().isFloat({ min: 0 }),
  body('markupDefault').optional().isFloat({ min: 0 }),
  body('laborFeeDefault').optional().isFloat({ min: 0 }),
  validate,
  async (req, res) => {
    try {
      const { metalId } = req.params;
      const { spotPerTroyOunce, markupDefault, laborFeeDefault, purity } = req.body;

      const updates = [];
      const values = [];
      let paramCount = 1;

      const fields = {
        spot_per_troy_ounce: spotPerTroyOunce,
        markup_default: markupDefault,
        labor_fee_default: laborFeeDefault,
        purity
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

      // Add effective date
      updates.push(`effective_date = CURRENT_DATE`);

      values.push(metalId);

      const result = await pool.query(
        `UPDATE metal_pricing SET ${updates.join(', ')}
         WHERE metal_id = $${paramCount}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Metal pricing not found' });
      }

      res.json({
        message: 'Metal pricing updated successfully',
        pricing: result.rows[0]
      });
    } catch (error) {
      console.error('Update metal pricing error:', error);
      res.status(500).json({ error: 'Failed to update pricing' });
    }
  }
);

// ===== FEE TIERS =====

// Get fee tiers
router.get('/fee-tiers',
  requireRole('Admin'),
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT * FROM fee_tiers
         WHERE is_active = TRUE
         ORDER BY applies_to, lower_bound`
      );

      res.json({ tiers: result.rows });
    } catch (error) {
      console.error('Get fee tiers error:', error);
      res.status(500).json({ error: 'Failed to fetch fee tiers' });
    }
  }
);

// Update fee tier
router.put('/fee-tiers/:tierId',
  requireRole('Admin'),
  body('rate').optional().isFloat({ min: 0, max: 1 }),
  validate,
  async (req, res) => {
    try {
      const { tierId } = req.params;
      const { lowerBound, upperBound, rate } = req.body;

      const updates = [];
      const values = [];
      let paramCount = 1;

      const fields = { lower_bound: lowerBound, upper_bound: upperBound, rate };

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

      values.push(tierId);

      const result = await pool.query(
        `UPDATE fee_tiers SET ${updates.join(', ')}
         WHERE tier_id = $${paramCount}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Fee tier not found' });
      }

      res.json({
        message: 'Fee tier updated successfully',
        tier: result.rows[0]
      });
    } catch (error) {
      console.error('Update fee tier error:', error);
      res.status(500).json({ error: 'Failed to update fee tier' });
    }
  }
);

// ===== SYSTEM INFO =====

// Get system information
router.get('/system-info',
  requireRole('Admin'),
  async (req, res) => {
    try {
      const studentCount = await pool.query('SELECT COUNT(*) FROM students');
      const toolCount = await pool.query('SELECT COUNT(*) FROM tools');
      const storeItemCount = await pool.query('SELECT COUNT(*) FROM store_items WHERE status != \'Removed\'');
      const lockupItemCount = await pool.query('SELECT COUNT(*) FROM lockup_items WHERE status = \'Active\'');

      res.json({
        version: '1.0.0',
        database: {
          students: parseInt(studentCount.rows[0].count),
          tools: parseInt(toolCount.rows[0].count),
          storeItems: parseInt(storeItemCount.rows[0].count),
          lockupItems: parseInt(lockupItemCount.rows[0].count)
        },
        serverTime: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get system info error:', error);
      res.status(500).json({ error: 'Failed to fetch system info' });
    }
  }
);

module.exports = router;
