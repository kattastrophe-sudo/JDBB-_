import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material'
import {
  TrendingUp,
  People,
  Build,
  Store,
  Warning,
  AttachMoney,
} from '@mui/icons-material'
import Layout from '../../components/Layout'
import { reports } from '../../services/api'

const StatCard = ({ title, value, subtitle, icon: Icon, color, onClick }) => (
  <Card sx={{ cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
    <CardContent>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography color="text.secondary" variant="caption" display="block">
            {title}
          </Typography>
          <Typography variant="h4" fontWeight="bold" sx={{ my: 1 }}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            backgroundColor: `${color}.lighter`,
            color: `${color}.main`,
            p: 1.5,
            borderRadius: 2,
          }}
        >
          <Icon />
        </Box>
      </Box>
    </CardContent>
  </Card>
)

const AdminDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const response = await reports.dashboard()
      setDashboardData(response.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress />
        </Box>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button onClick={loadDashboardData}>Retry</Button>
      </Layout>
    )
  }

  return (
    <Layout>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Admin Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Overview of the JDBB system
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Today's Sales */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Today's Sales"
            value={dashboardData?.todaySales.count || 0}
            subtitle={`$${dashboardData?.todaySales.total.toFixed(2) || '0.00'}`}
            icon={TrendingUp}
            color="success"
            onClick={() => navigate('/admin/store')}
          />
        </Grid>

        {/* Negative Balances */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Negative Balances"
            value={dashboardData?.negativeBalances.count || 0}
            subtitle={`Owing: $${Math.abs(dashboardData?.negativeBalances.totalOwing || 0).toFixed(2)}`}
            icon={Warning}
            color="error"
            onClick={() => navigate('/admin/transactions')}
          />
        </Grid>

        {/* Tools On Loan */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Tools On Loan"
            value={dashboardData?.tools.onLoan || 0}
            subtitle={`${dashboardData?.tools.overdue || 0} overdue`}
            icon={Build}
            color="info"
            onClick={() => navigate('/admin/tools')}
          />
        </Grid>

        {/* Store Items */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Store Items"
            value={dashboardData?.store.available || 0}
            subtitle={`${dashboardData?.store.pendingApproval || 0} pending approval`}
            icon={Store}
            color="primary"
            onClick={() => navigate('/admin/store')}
          />
        </Grid>

        {/* 30-Day Lock-Up Revenue */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Lock-Up Revenue (Last 30 Days)
                  </Typography>
                  <Typography variant="h3" fontWeight="bold">
                    ${dashboardData?.lockupRevenue30Days.toFixed(2) || '0.00'}
                  </Typography>
                </Box>
                <AttachMoney sx={{ fontSize: 60, color: 'success.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
                <Button
                  variant="contained"
                  onClick={() => navigate('/admin/students')}
                >
                  Manage Students
                </Button>
                <Button
                  variant="contained"
                  onClick={() => navigate('/admin/store')}
                >
                  Process Sale
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/admin/reports')}
                >
                  View Reports
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/admin/settings')}
                >
                  Settings
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Layout>
  )
}

export default AdminDashboard
