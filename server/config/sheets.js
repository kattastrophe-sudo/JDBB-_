const { google } = require('googleapis');

let sheetsClient = null;
let spreadsheetId = null;

// Initialize Google Sheets client
const initializeSheets = () => {
  if (sheetsClient) return sheetsClient;

  try {
    // Get credentials from environment variable
    const credentials = process.env.GOOGLE_CREDENTIALS
      ? JSON.parse(process.env.GOOGLE_CREDENTIALS)
      : require('./credentials.json'); // Fallback for local dev

    spreadsheetId = process.env.SPREADSHEET_ID;

    if (!spreadsheetId) {
      throw new Error('SPREADSHEET_ID environment variable is required');
    }

    // Create auth client
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    // Create sheets client
    sheetsClient = google.sheets({ version: 'v4', auth });

    console.log('✓ Google Sheets client initialized');
    return sheetsClient;
  } catch (error) {
    console.error('Failed to initialize Google Sheets:', error.message);
    throw error;
  }
};

// Get data from a sheet tab
const getSheetData = async (sheetName, range = null) => {
  const sheets = initializeSheets();
  const readRange = range || `${sheetName}!A:ZZ`;

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: readRange,
    });

    const rows = response.data.values || [];

    if (rows.length === 0) {
      return [];
    }

    // First row is headers
    const headers = rows[0];
    const data = rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });

    return data;
  } catch (error) {
    console.error(`Error reading sheet ${sheetName}:`, error.message);
    throw error;
  }
};

// Append row to a sheet
const appendRow = async (sheetName, values) => {
  const sheets = initializeSheets();

  try {
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:A`,
      valueInputOption: 'RAW',
      resource: {
        values: [values],
      },
    });

    return response.data;
  } catch (error) {
    console.error(`Error appending to sheet ${sheetName}:`, error.message);
    throw error;
  }
};

// Update a row in a sheet
const updateRow = async (sheetName, rowIndex, values) => {
  const sheets = initializeSheets();

  try {
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A${rowIndex}:ZZ${rowIndex}`,
      valueInputOption: 'RAW',
      resource: {
        values: [values],
      },
    });

    return response.data;
  } catch (error) {
    console.error(`Error updating sheet ${sheetName}:`, error.message);
    throw error;
  }
};

// Find row by column value
const findRow = async (sheetName, columnName, value) => {
  const data = await getSheetData(sheetName);
  const rowIndex = data.findIndex(row => row[columnName] === value);

  if (rowIndex === -1) return null;

  return {
    data: data[rowIndex],
    rowIndex: rowIndex + 2, // +2 because: +1 for array index, +1 for header row
  };
};

// Query rows by criteria
const queryRows = async (sheetName, criteria = {}) => {
  const data = await getSheetData(sheetName);

  if (Object.keys(criteria).length === 0) {
    return data;
  }

  return data.filter(row => {
    return Object.entries(criteria).every(([key, value]) => {
      if (typeof value === 'function') {
        return value(row[key]);
      }
      return row[key] === value;
    });
  });
};

// Create or ensure sheet tabs exist
const ensureSheets = async (sheetNames) => {
  const sheets = initializeSheets();

  try {
    // Get existing sheets
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    const existingSheets = response.data.sheets.map(s => s.properties.title);
    const sheetsToCreate = sheetNames.filter(name => !existingSheets.includes(name));

    if (sheetsToCreate.length === 0) {
      console.log('✓ All sheets already exist');
      return;
    }

    // Create missing sheets
    const requests = sheetsToCreate.map(title => ({
      addSheet: {
        properties: { title },
      },
    }));

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: { requests },
    });

    console.log(`✓ Created sheets: ${sheetsToCreate.join(', ')}`);
  } catch (error) {
    console.error('Error ensuring sheets:', error.message);
    throw error;
  }
};

// Initialize sheet headers
const initializeSheetHeaders = async (sheetName, headers) => {
  const data = await getSheetData(sheetName);

  // If sheet is empty, add headers
  if (data.length === 0) {
    await appendRow(sheetName, headers);
    console.log(`✓ Initialized headers for ${sheetName}`);
  }
};

module.exports = {
  initializeSheets,
  getSheetData,
  appendRow,
  updateRow,
  findRow,
  queryRows,
  ensureSheets,
  initializeSheetHeaders,
};
