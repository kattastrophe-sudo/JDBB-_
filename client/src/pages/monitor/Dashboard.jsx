import Layout from '../../components/Layout'
import { Box, Typography, Grid, Card, CardContent, Button } from '@mui/material'
import { useNavigate } from 'react-router-dom'

const MonitorDashboard = () => {
  const navigate = useNavigate()

  return (
    <Layout>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Monitor Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Tool crib and lock-up operations
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Tool Checkout</Typography>
              <Typography paragraph>Process tool loans and returns</Typography>
              <Button variant="contained" onClick={() => navigate('/monitor/tools')}>
                Go to Tool Checkout
              </Button>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Lock-Up POS</Typography>
              <Typography paragraph>Sell materials and supplies</Typography>
              <Button variant="contained" onClick={() => navigate('/monitor/lockup')}>
                Go to Lock-Up POS
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Layout>
  )
}

export default MonitorDashboard
