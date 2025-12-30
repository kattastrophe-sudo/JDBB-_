const nodemailer = require('nodemailer');
const pool = require('../config/database');

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD // Use App Password, not regular password
    }
  });
};

// Replace placeholders in email template
const replacePlaceholders = (text, data) => {
  let result = text;
  Object.keys(data).forEach(key => {
    const placeholder = `{${key}}`;
    result = result.replace(new RegExp(placeholder, 'g'), data[key]);
  });
  return result;
};

// Send email using template
const sendTemplateEmail = async (templateId, recipientEmail, data) => {
  try {
    // Get template
    const templateResult = await pool.query(
      'SELECT * FROM email_templates WHERE template_id = $1 AND is_active = TRUE',
      [templateId]
    );

    if (templateResult.rows.length === 0) {
      throw new Error(`Email template ${templateId} not found or inactive`);
    }

    const template = templateResult.rows[0];

    // Replace placeholders
    const subject = replacePlaceholders(template.subject, data);
    const body = replacePlaceholders(template.body, data);

    // Send email
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: recipientEmail,
      subject: subject,
      text: body,
      html: body.replace(/\n/g, '<br>') // Simple HTML formatting
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`Email sent: ${templateId} to ${recipientEmail} (${info.messageId})`);

    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    console.error('Send email error:', error);
    throw error;
  }
};

// Send sale notification to student
const sendSaleNotification = async (saleId) => {
  try {
    const result = await pool.query(
      `SELECT ss.*, si.item_name, s.preferred_name, s.personal_email, s.college_email
       FROM store_sales ss
       JOIN store_items si ON ss.item_id = si.item_id
       JOIN students s ON ss.student_id = s.student_id
       WHERE ss.sale_id = $1`,
      [saleId]
    );

    if (result.rows.length === 0) {
      throw new Error('Sale not found');
    }

    const sale = result.rows[0];
    const email = sale.personal_email || sale.college_email;

    if (!email) {
      console.warn(`No email address for student ${sale.student_id}`);
      return { success: false, reason: 'No email address' };
    }

    const data = {
      PreferredName: sale.preferred_name,
      ItemTitle: sale.item_name,
      FinalPrice: `$${parseFloat(sale.price_final).toFixed(2)}`,
      StudentShare: `$${parseFloat(sale.student_share_amount).toFixed(2)}`
    };

    return await sendTemplateEmail('EML001', email, data);
  } catch (error) {
    console.error('Send sale notification error:', error);
    throw error;
  }
};

// Send balance reminder to student
const sendBalanceReminder = async (studentId) => {
  try {
    const result = await pool.query(
      `SELECT s.*, sb.lockup_balance
       FROM students s
       JOIN student_balances sb ON s.student_id = sb.student_id
       WHERE s.student_id = $1`,
      [studentId]
    );

    if (result.rows.length === 0) {
      throw new Error('Student not found');
    }

    const student = result.rows[0];
    const email = student.personal_email || student.college_email;

    if (!email) {
      console.warn(`No email address for student ${studentId}`);
      return { success: false, reason: 'No email address' };
    }

    const balance = parseFloat(student.lockup_balance);

    if (balance >= 0) {
      return { success: false, reason: 'Balance is not negative' };
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7); // 7 days to pay

    const data = {
      PreferredName: student.preferred_name,
      Balance: `$${Math.abs(balance).toFixed(2)}`,
      DueDate: dueDate.toLocaleDateString()
    };

    return await sendTemplateEmail('EML010', email, data);
  } catch (error) {
    console.error('Send balance reminder error:', error);
    throw error;
  }
};

// Send tool overdue notification
const sendToolOverdueNotification = async (loanId) => {
  try {
    const result = await pool.query(
      `SELECT tl.*, t.tool_name, s.preferred_name, s.personal_email, s.college_email
       FROM tool_loans tl
       JOIN tools t ON tl.tool_id = t.tool_id
       JOIN students s ON tl.student_id = s.student_id
       WHERE tl.loan_id = $1`,
      [loanId]
    );

    if (result.rows.length === 0) {
      throw new Error('Loan not found');
    }

    const loan = result.rows[0];
    const email = loan.personal_email || loan.college_email;

    if (!email) {
      console.warn(`No email address for student ${loan.student_id}`);
      return { success: false, reason: 'No email address' };
    }

    const data = {
      PreferredName: loan.preferred_name,
      ToolName: loan.tool_name,
      ToolID: loan.tool_id,
      DueDate: new Date(loan.due_date).toLocaleString()
    };

    return await sendTemplateEmail('EML030', email, data);
  } catch (error) {
    console.error('Send tool overdue notification error:', error);
    throw error;
  }
};

// Send tool reservation notification
const sendReservationNotification = async (reservationId) => {
  try {
    const result = await pool.query(
      `SELECT tr.*, t.tool_name, s.preferred_name, s.personal_email, s.college_email
       FROM tool_reservations tr
       JOIN tools t ON tr.tool_id = t.tool_id
       JOIN students s ON tr.student_id = s.student_id
       WHERE tr.reservation_id = $1`,
      [reservationId]
    );

    if (result.rows.length === 0) {
      throw new Error('Reservation not found');
    }

    const reservation = result.rows[0];
    const email = reservation.personal_email || reservation.college_email;

    if (!email) {
      console.warn(`No email address for student ${reservation.student_id}`);
      return { success: false, reason: 'No email address' };
    }

    const data = {
      PreferredName: reservation.preferred_name,
      ToolName: reservation.tool_name
    };

    return await sendTemplateEmail('EML040', email, data);
  } catch (error) {
    console.error('Send reservation notification error:', error);
    throw error;
  }
};

// Send daily store sales summary (to admin)
const sendDailySalesSummary = async (date, adminEmail) => {
  try {
    const result = await pool.query(
      `SELECT payment_type, COUNT(*) as count, SUM(price_final) as total
       FROM store_sales
       WHERE DATE(date_sold) = $1
       GROUP BY payment_type`,
      [date]
    );

    const visaTotal = result.rows.find(r => r.payment_type === 'Visa')?.total || 0;
    const mcTotal = result.rows.find(r => r.payment_type === 'MC')?.total || 0;
    const debitTotal = result.rows.find(r => r.payment_type === 'Debit')?.total || 0;
    const grandTotal = parseFloat(visaTotal) + parseFloat(mcTotal) + parseFloat(debitTotal);

    const data = {
      Date: new Date(date).toLocaleDateString(),
      VisaTotal: `$${parseFloat(visaTotal).toFixed(2)}`,
      MCTotal: `$${parseFloat(mcTotal).toFixed(2)}`,
      DebitTotal: `$${parseFloat(debitTotal).toFixed(2)}`,
      GrandTotal: `$${grandTotal.toFixed(2)}`
    };

    return await sendTemplateEmail('EML020', adminEmail, data);
  } catch (error) {
    console.error('Send daily sales summary error:', error);
    throw error;
  }
};

// Batch send balance reminders (scheduled task)
const sendBatchBalanceReminders = async () => {
  try {
    const result = await pool.query(
      `SELECT s.student_id
       FROM students s
       JOIN student_balances sb ON s.student_id = sb.student_id
       WHERE sb.lockup_balance < 0`
    );

    const results = [];

    for (const student of result.rows) {
      try {
        const emailResult = await sendBalanceReminder(student.student_id);
        results.push({
          studentId: student.student_id,
          ...emailResult
        });
      } catch (error) {
        results.push({
          studentId: student.student_id,
          success: false,
          error: error.message
        });
      }
    }

    return {
      total: result.rows.length,
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  } catch (error) {
    console.error('Batch send balance reminders error:', error);
    throw error;
  }
};

module.exports = {
  sendTemplateEmail,
  sendSaleNotification,
  sendBalanceReminder,
  sendToolOverdueNotification,
  sendReservationNotification,
  sendDailySalesSummary,
  sendBatchBalanceReminders
};
