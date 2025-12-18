const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: 'Google Sheets'
  });
});

// API Routes (Google Sheets version)
app.use('/api/auth', require('./routes-sheets/auth'));

// Simple welcome route
app.get('/', (req, res) => {
  res.json({
    message: 'JDBB System API (Google Sheets)',
    version: '2.0.0',
    database: 'Google Sheets',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║  JDBB - Jewellery & Lock-Up Management System        ║
║  Google Sheets Version                                ║
║  Server running on port ${PORT}                        ║
║  Environment: ${process.env.NODE_ENV || 'development'}                             ║
║  API: http://localhost:${PORT}/api                     ║
╚═══════════════════════════════════════════════════════╝
    `);
  });
}

module.exports = app;
