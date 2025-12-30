import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403 || error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth endpoints
export const auth = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
}

// Students endpoints
export const students = {
  getAll: (params) => api.get('/students', { params }),
  getById: (id) => api.get(`/students/${id}`),
  getByTag: (tagNumber) => api.get(`/students/tag/${tagNumber}`),
  create: (data) => api.post('/students', data),
  update: (id, data) => api.put(`/students/${id}`, data),
  getTransactions: (id, params) => api.get(`/students/${id}/transactions`, { params }),
}

// Tools endpoints
export const tools = {
  getAll: (params) => api.get('/tools', { params }),
  getById: (id) => api.get(`/tools/${id}`),
  create: (data) => api.post('/tools', data),
  update: (id, data) => api.put(`/tools/${id}`, data),
  // Loans
  getAllLoans: (params) => api.get('/tools/loans/all', { params }),
  createLoan: (data) => api.post('/tools/loans', data),
  returnTool: (loanId, data) => api.put(`/tools/loans/${loanId}/return`, data),
  // Reservations
  createReservation: (data) => api.post('/tools/reservations', data),
}

// Store endpoints
export const store = {
  getAll: (params) => api.get('/store', { params }),
  getById: (id) => api.get(`/store/${id}`),
  create: (formData) => api.post('/store', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, formData) => api.put(`/store/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  delete: (id) => api.delete(`/store/${id}`),
  // Sales
  getAllSales: (params) => api.get('/store/sales/all', { params }),
  createSale: (data) => api.post('/store/sales', data),
}

// Lockup endpoints
export const lockup = {
  getAll: (params) => api.get('/lockup', { params }),
  getById: (id) => api.get(`/lockup/${id}`),
  create: (data) => api.post('/lockup', data),
  update: (id, data) => api.put(`/lockup/${id}`, data),
  // Sales
  getAllSales: (params) => api.get('/lockup/sales/all', { params }),
  createSale: (data) => api.post('/lockup/sales', data),
  // Metal pricing
  calculateMetalPrice: (data) => api.post('/lockup/calculate-metal-price', data),
}

// Transactions endpoints
export const transactions = {
  getAll: (params) => api.get('/transactions', { params }),
  getByStudent: (studentId, params) =>
    api.get(`/transactions/student/${studentId}`, { params }),
  create: (data) => api.post('/transactions', data),
  getNegativeBalances: () => api.get('/transactions/balances/negative'),
  getAllBalances: () => api.get('/transactions/balances/all'),
}

// Reports endpoints
export const reports = {
  dailyStoreSales: (params) => api.get('/reports/daily-store-sales', { params }),
  monthlyJewellerySales: (params) => api.get('/reports/monthly-jewellery-sales', { params }),
  toolUtilization: (params) => api.get('/reports/tool-utilization', { params }),
  studentAccountSummary: (studentId) => api.get(`/reports/student-account-summary/${studentId}`),
  dashboard: () => api.get('/reports/dashboard'),
}

// QR endpoints
export const qr = {
  generateStudent: (tagNumber, params) => api.get(`/qr/student/${tagNumber}`, { params }),
  generateTool: (toolId, params) => api.get(`/qr/tool/${toolId}`, { params }),
  generateLockup: (itemId, params) => api.get(`/qr/lockup/${itemId}`, { params }),
  generateStore: (itemId, params) => api.get(`/qr/store/${itemId}`, { params }),
  batchStudents: () => api.post('/qr/batch/students'),
  batchTools: () => api.post('/qr/batch/tools'),
}

// Settings endpoints
export const settings = {
  // Categories
  getCategories: (params) => api.get('/settings/categories', { params }),
  createCategory: (data) => api.post('/settings/categories', data),
  // Email templates
  getEmailTemplates: () => api.get('/settings/email-templates'),
  getEmailTemplate: (id) => api.get(`/settings/email-templates/${id}`),
  updateEmailTemplate: (id, data) => api.put(`/settings/email-templates/${id}`, data),
  // Metal pricing
  getMetalPricing: () => api.get('/settings/metal-pricing'),
  updateMetalPricing: (id, data) => api.put(`/settings/metal-pricing/${id}`, data),
  // Fee tiers
  getFeeTiers: () => api.get('/settings/fee-tiers'),
  updateFeeTier: (id, data) => api.put(`/settings/fee-tiers/${id}`, data),
  // System info
  getSystemInfo: () => api.get('/settings/system-info'),
}

export default api
