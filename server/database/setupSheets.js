const {
  ensureSheets,
  initializeSheetHeaders,
  appendRow,
} = require('../config/sheets');
const bcrypt = require('bcryptjs');

// Define all sheet names
const SHEET_NAMES = [
  'Users',
  'Students',
  'Tools',
  'ToolLoans',
  'StoreItems',
  'StoreSales',
  'LockupItems',
  'LockupSales',
  'Transactions',
  'Categories',
];

// Define headers for each sheet
const SHEET_HEADERS = {
  Users: ['userId', 'email', 'passwordHash', 'role', 'displayName', 'active', 'createdAt'],
  Students: ['studentId', 'studentCode', 'tagNumber', 'legalName', 'preferredName', 'pronouns', 'collegeEmail', 'personalEmail', 'status', 'courses', 'notes', 'userId', 'createdAt'],
  Tools: ['toolId', 'toolName', 'category', 'status', 'replacementCost', 'isKit', 'location', 'notes', 'createdAt'],
  ToolLoans: ['loanId', 'toolId', 'studentId', 'loanDate', 'dueDate', 'returnDate', 'condition', 'status', 'createdBy', 'createdAt'],
  StoreItems: ['itemId', 'studentId', 'itemName', 'category', 'materials', 'size', 'images', 'priceFinal', 'pricePreTax', 'storeFeeRate', 'storeFeeAmount', 'studentShare', 'type', 'status', 'dateSubmitted', 'dateSold', 'notes', 'createdAt'],
  StoreSales: ['saleId', 'itemId', 'studentId', 'dateSold', 'paymentType', 'taxExempt', 'priceFinal', 'storeFeeAmount', 'studentShareAmount', 'createdBy', 'createdAt'],
  LockupItems: ['itemId', 'itemName', 'category', 'unit', 'weight', 'sellingPrice', 'markupRate', 'status', 'notes', 'createdAt'],
  LockupSales: ['saleId', 'date', 'itemId', 'studentId', 'quantity', 'totalPrice', 'paymentMethod', 'payCash', 'payOneCard', 'payAccount', 'notes', 'createdBy', 'createdAt'],
  Transactions: ['transId', 'studentId', 'date', 'type', 'description', 'amount', 'relatedId', 'createdBy', 'createdAt'],
  Categories: ['categoryId', 'domain', 'name', 'isActive', 'sortOrder', 'createdAt'],
};

async function setupSheets() {
  try {
    console.log('Starting Google Sheets setup...\n');

    // Step 1: Ensure all sheet tabs exist
    console.log('Creating sheet tabs...');
    await ensureSheets(SHEET_NAMES);

    // Step 2: Initialize headers for each sheet
    console.log('\nInitializing headers...');
    for (const [sheetName, headers] of Object.entries(SHEET_HEADERS)) {
      await initializeSheetHeaders(sheetName, headers);
    }

    // Step 3: Add sample data
    console.log('\nAdding sample data...');
    await addSampleData();

    console.log('\n✅ Google Sheets setup complete!');
    console.log('\nYour spreadsheet is ready to use.');
    console.log('You can view it at: https://docs.google.com/spreadsheets/d/' + process.env.SPREADSHEET_ID);
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    throw error;
  }
}

async function addSampleData() {
  const now = new Date().toISOString();

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  await appendRow('Users', [
    'user-admin-001',
    'admin@jdbb.edu',
    adminPassword,
    'Admin',
    'Administrator',
    'true',
    now,
  ]);

  // Create monitor user
  const monitorPassword = await bcrypt.hash('monitor123', 10);
  await appendRow('Users', [
    'user-monitor-001',
    'monitor@jdbb.edu',
    monitorPassword,
    'Monitor',
    'Studio Monitor',
    'true',
    now,
  ]);

  // Create student user
  const studentPassword = await bcrypt.hash('student123', 10);
  await appendRow('Users', [
    'user-student-001',
    'student@jdbb.edu',
    studentPassword,
    'Student',
    'Test Student',
    'true',
    now,
  ]);

  // Create sample students
  await appendRow('Students', [
    'STU001',
    'ART',
    '01',
    'Alice Reynolds Taylor',
    'Alice',
    'she/her',
    'student@jdbb.edu',
    'alice@example.com',
    'Full-time',
    '',
    '',
    'user-student-001',
    now,
  ]);

  await appendRow('Students', [
    'STU002',
    'BEN',
    '02',
    'Benjamin Carter',
    'Ben',
    'he/him',
    'ben@jdbb.edu',
    'ben@example.com',
    'Full-time',
    '',
    '',
    '',
    now,
  ]);

  // Create sample tools
  await appendRow('Tools', [
    'TOOL001',
    'Soldering Iron Set',
    'Soldering Kit',
    'Available',
    '125.00',
    'true',
    'Tool Crib A',
    '',
    now,
  ]);

  await appendRow('Tools', [
    'TOOL002',
    'Rolling Mill - Large',
    'Rolling Mill',
    'Available',
    '850.00',
    'false',
    'Tool Crib A',
    '',
    now,
  ]);

  // Add categories
  const categories = [
    ['CAT050', 'JewelleryItem', 'Ring', 'true', '10', now],
    ['CAT051', 'JewelleryItem', 'Necklace', 'true', '20', now],
    ['CAT052', 'JewelleryItem', 'Bracelet', 'true', '30', now],
    ['CAT200', 'Payment', 'Visa', 'true', '1', now],
    ['CAT201', 'Payment', 'MC', 'true', '2', now],
    ['CAT202', 'Payment', 'Debit', 'true', '3', now],
  ];

  for (const category of categories) {
    await appendRow('Categories', category);
  }

  console.log('✓ Sample data added (3 users, 2 students, 2 tools, 6 categories)');
}

// Run if called directly
if (require.main === module) {
  setupSheets()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = setupSheets;
