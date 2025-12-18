const express = require('express');
const QRCode = require('qrcode');
const fs = require('fs').promises;
const path = require('path');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);
router.use(requireRole('Admin', 'Monitor'));

// Generate QR code for student tag
router.get('/student/:tagNumber', async (req, res) => {
  try {
    const { tagNumber } = req.params;
    const { format = 'png', size = 300 } = req.query;

    // Generate QR code data (could be a URL or just the tag number)
    const qrData = `STUDENT:${tagNumber}`;

    if (format === 'svg') {
      const qrCodeSVG = await QRCode.toString(qrData, {
        type: 'svg',
        width: parseInt(size)
      });

      res.setHeader('Content-Type', 'image/svg+xml');
      res.send(qrCodeSVG);
    } else {
      const qrCodeBuffer = await QRCode.toBuffer(qrData, {
        width: parseInt(size),
        margin: 1
      });

      res.setHeader('Content-Type', 'image/png');
      res.send(qrCodeBuffer);
    }
  } catch (error) {
    console.error('Generate student QR error:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Generate QR code for tool
router.get('/tool/:toolId', async (req, res) => {
  try {
    const { toolId } = req.params;
    const { format = 'png', size = 300 } = req.query;

    const qrData = `TOOL:${toolId}`;

    if (format === 'svg') {
      const qrCodeSVG = await QRCode.toString(qrData, {
        type: 'svg',
        width: parseInt(size)
      });

      res.setHeader('Content-Type', 'image/svg+xml');
      res.send(qrCodeSVG);
    } else {
      const qrCodeBuffer = await QRCode.toBuffer(qrData, {
        width: parseInt(size),
        margin: 1
      });

      res.setHeader('Content-Type', 'image/png');
      res.send(qrCodeBuffer);
    }
  } catch (error) {
    console.error('Generate tool QR error:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Generate QR code for lockup item
router.get('/lockup/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { format = 'png', size = 300 } = req.query;

    const qrData = `LOCKUP:${itemId}`;

    if (format === 'svg') {
      const qrCodeSVG = await QRCode.toString(qrData, {
        type: 'svg',
        width: parseInt(size)
      });

      res.setHeader('Content-Type', 'image/svg+xml');
      res.send(qrCodeSVG);
    } else {
      const qrCodeBuffer = await QRCode.toBuffer(qrData, {
        width: parseInt(size),
        margin: 1
      });

      res.setHeader('Content-Type', 'image/png');
      res.send(qrCodeBuffer);
    }
  } catch (error) {
    console.error('Generate lockup QR error:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Generate QR code for store item (price tag)
router.get('/store/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { format = 'png', size = 300 } = req.query;

    const qrData = `STORE:${itemId}`;

    if (format === 'svg') {
      const qrCodeSVG = await QRCode.toString(qrData, {
        type: 'svg',
        width: parseInt(size)
      });

      res.setHeader('Content-Type', 'image/svg+xml');
      res.send(qrCodeSVG);
    } else {
      const qrCodeBuffer = await QRCode.toBuffer(qrData, {
        width: parseInt(size),
        margin: 1
      });

      res.setHeader('Content-Type', 'image/png');
      res.send(qrCodeBuffer);
    }
  } catch (error) {
    console.error('Generate store QR error:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Batch generate QR codes for all students
router.post('/batch/students', async (req, res) => {
  try {
    const pool = require('../config/database');
    const studentsResult = await pool.query(
      'SELECT student_id, tag_number, preferred_name FROM students ORDER BY tag_number'
    );

    const qrCodes = [];

    for (const student of studentsResult.rows) {
      const qrData = `STUDENT:${student.tag_number}`;
      const fileName = `student-${student.tag_number}.png`;
      const filePath = path.join('uploads/qr', fileName);

      await QRCode.toFile(filePath, qrData, {
        width: 300,
        margin: 1
      });

      qrCodes.push({
        studentId: student.student_id,
        tagNumber: student.tag_number,
        name: student.preferred_name,
        qrPath: filePath,
        url: `/uploads/qr/${fileName}`
      });
    }

    res.json({
      message: `Generated ${qrCodes.length} QR codes`,
      qrCodes
    });
  } catch (error) {
    console.error('Batch generate student QR error:', error);
    res.status(500).json({ error: 'Failed to generate QR codes' });
  }
});

// Batch generate QR codes for all tools
router.post('/batch/tools', async (req, res) => {
  try {
    const pool = require('../config/database');
    const toolsResult = await pool.query(
      'SELECT tool_id, tool_name FROM tools ORDER BY tool_id'
    );

    const qrCodes = [];

    for (const tool of toolsResult.rows) {
      const qrData = `TOOL:${tool.tool_id}`;
      const fileName = `tool-${tool.tool_id}.png`;
      const filePath = path.join('uploads/qr', fileName);

      await QRCode.toFile(filePath, qrData, {
        width: 300,
        margin: 1
      });

      qrCodes.push({
        toolId: tool.tool_id,
        toolName: tool.tool_name,
        qrPath: filePath,
        url: `/uploads/qr/${fileName}`
      });
    }

    res.json({
      message: `Generated ${qrCodes.length} QR codes`,
      qrCodes
    });
  } catch (error) {
    console.error('Batch generate tool QR error:', error);
    res.status(500).json({ error: 'Failed to generate QR codes' });
  }
});

module.exports = router;
