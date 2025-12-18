const bcrypt = require('bcryptjs');
const pool = require('../config/database');

async function seedDatabase() {
  const client = await pool.connect();

  try {
    console.log('Starting database seeding with sample data...');

    // Create sample admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    await client.query(`
      INSERT INTO users (email, password_hash, role, display_name)
      VALUES
        ('admin@jdbb.edu', $1, 'Admin', 'Administrator'),
        ('monitor@jdbb.edu', $2, 'Monitor', 'Studio Monitor'),
        ('student@jdbb.edu', $3, 'Student', 'Test Student')
      ON CONFLICT (email) DO NOTHING
    `, [adminPassword, await bcrypt.hash('monitor123', 10), await bcrypt.hash('student123', 10)]);

    console.log('✓ Sample users created');

    // Get user IDs
    const adminResult = await client.query(`SELECT user_id FROM users WHERE email = 'admin@jdbb.edu'`);
    const studentUserResult = await client.query(`SELECT user_id FROM users WHERE email = 'student@jdbb.edu'`);

    // Create sample students
    await client.query(`
      INSERT INTO students (
        student_id, student_code, tag_number, legal_name, preferred_name,
        pronouns, college_email, personal_email, status, user_id
      ) VALUES
        ('STU001', 'ART', '01', 'Alice Reynolds Taylor', 'Alice', 'she/her',
         'student@jdbb.edu', 'alice@example.com', 'Full-time', $1),
        ('STU002', 'BEN', '02', 'Benjamin Carter', 'Ben', 'he/him',
         'ben@jdbb.edu', 'ben@example.com', 'Full-time', NULL),
        ('STU003', 'CHR', '03', 'Chris Morgan', 'Chris', 'they/them',
         'chris@jdbb.edu', 'chris@example.com', 'Part-time', NULL)
      ON CONFLICT (student_id) DO NOTHING
    `, [studentUserResult.rows[0]?.user_id]);

    console.log('✓ Sample students created');

    // Create sample tools
    await client.query(`
      INSERT INTO tools (tool_id, tool_name, category, status, replacement_cost, is_kit, location)
      VALUES
        ('TOOL001', 'Soldering Iron Set', 'Soldering Kit', 'Available', 125.00, TRUE, 'Tool Crib A'),
        ('TOOL002', 'Rolling Mill - Large', 'Rolling Mill', 'Available', 850.00, FALSE, 'Tool Crib A'),
        ('TOOL003', 'Jeweler''s Saw Frame', 'Files Set', 'Available', 35.00, FALSE, 'Tool Crib B'),
        ('TOOL004', 'Digital Scale', 'Tool', 'Available', 75.00, FALSE, 'Tool Crib B'),
        ('TOOL005', 'Polishing Motor', 'Polishing Kit', 'On Loan', 450.00, FALSE, 'Tool Crib A')
      ON CONFLICT (tool_id) DO NOTHING
    `);

    console.log('✓ Sample tools created');

    // Create sample lock-up items
    await client.query(`
      INSERT INTO lockup_items (
        item_id, item_name, category, unit, weight, selling_price,
        markup_rate, allowed_payments, status, metal_type, use_metal_formula
      ) VALUES
        ('LOCK001', 'Sterling Silver Wire 18ga', 'Silver Wire', 'g', NULL, 2.50, 0.20,
         ARRAY['Cash', 'OneCard', 'LockupAccount'], 'Active', 'Silver', TRUE),
        ('LOCK002', '14K Gold Wire 20ga', 'Gold Wire', 'g', NULL, 85.00, 0.25,
         ARRAY['Cash', 'OneCard', 'LockupAccount'], 'Active', 'Gold14K', TRUE),
        ('LOCK003', 'Solder - Easy', 'Solder', 'each', 5, 12.00, 0.15,
         ARRAY['Cash', 'OneCard', 'LockupAccount'], 'Active', NULL, FALSE),
        ('LOCK004', 'Flux Paste 50g', 'Flux', 'each', 50, 8.50, 0.15,
         ARRAY['Cash', 'OneCard'], 'Active', NULL, FALSE)
      ON CONFLICT (item_id) DO NOTHING
    `);

    console.log('✓ Sample lock-up items created');

    // Create sample jewellery store items
    await client.query(`
      INSERT INTO store_items (
        item_id, student_id, item_name, category, materials, size,
        price_final, type, status, date_submitted
      ) VALUES
        ('ART001', 'STU001', 'Silver Ring with Moonstone', 'Ring', 'Sterling silver, moonstone',
         '7', 180.00, 'Store', 'Available', CURRENT_DATE),
        ('ART002', 'STU001', 'Copper Pendant Necklace', 'Pendant', 'Copper, leather cord',
         '18"', 95.00, 'Store', 'Available', CURRENT_DATE - INTERVAL '2 days'),
        ('BEN001', 'STU002', 'Gold Band Ring', 'Ring', '14K gold',
         '9', 650.00, 'Store', 'Available', CURRENT_DATE - INTERVAL '5 days')
      ON CONFLICT (item_id) DO NOTHING
    `);

    console.log('✓ Sample jewellery items created');

    // Create sample transaction (student has credit)
    await client.query(`
      INSERT INTO lockup_account_transactions (
        student_id, date, type, description, amount, created_by
      ) VALUES
        ('STU001', CURRENT_DATE, 'Credit', 'Initial account credit', 50.00, $1),
        ('STU002', CURRENT_DATE - INTERVAL '3 days', 'Sale', 'Lock-up materials purchase', -15.50, $1),
        ('STU003', CURRENT_DATE - INTERVAL '10 days', 'Fee', 'Tool damage fee', -25.00, $1)
    `, [adminResult.rows[0]?.user_id]);

    console.log('✓ Sample transactions created');

    console.log('\n✅ Seeding completed successfully!');
    console.log('\nSample Login Credentials:');
    console.log('----------------------------');
    console.log('Admin:   admin@jdbb.edu / admin123');
    console.log('Monitor: monitor@jdbb.edu / monitor123');
    console.log('Student: student@jdbb.edu / student123');
    console.log('\nSample Student Tags: 01, 02, 03');

  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Run seeding if called directly
if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = seedDatabase;
