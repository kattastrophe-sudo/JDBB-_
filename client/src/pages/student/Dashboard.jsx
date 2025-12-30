import Layout from '../../components/Layout'
import { Box, Typography, Grid, Card, CardContent } from '@mui/material'

const StudentDashboard = () => {
  return (
    <Layout>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Student Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Welcome to your dashboard
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>My Jewellery Items</Typography>
              <Typography>View and manage your submitted items</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Account Balance</Typography>
              <Typography>Check your Lock-Up account status</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Layout>
  )
}

export default StudentDashboard
