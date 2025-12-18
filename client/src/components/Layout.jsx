import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Avatar,
  Menu,
  MenuItem,
} from '@mui/material'
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Build as BuildIcon,
  Store as StoreIcon,
  Inventory as InventoryIcon,
  AccountBalance as AccountBalanceIcon,
  Assessment as AssessmentIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,
} from '@mui/icons-material'
import { useAuth } from '../contexts/AuthContext'

const drawerWidth = 260

const Layout = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [anchorEl, setAnchorEl] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen)
  }

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget)
  }

  const handleProfileMenuClose = () => {
    setAnchorEl(null)
  }

  const handleLogout = () => {
    handleProfileMenuClose()
    logout()
  }

  // Navigation items based on role
  const getNavigationItems = () => {
    const baseRoute = user.role.toLowerCase()

    if (user.role === 'Admin') {
      return [
        { text: 'Dashboard', icon: <DashboardIcon />, path: `/${baseRoute}` },
        { text: 'Students', icon: <PeopleIcon />, path: `/${baseRoute}/students` },
        { text: 'Tools', icon: <BuildIcon />, path: `/${baseRoute}/tools` },
        { text: 'Jewellery Store', icon: <StoreIcon />, path: `/${baseRoute}/store` },
        { text: 'Lock-Up Store', icon: <InventoryIcon />, path: `/${baseRoute}/lockup` },
        { text: 'Transactions', icon: <AccountBalanceIcon />, path: `/${baseRoute}/transactions` },
        { text: 'Reports', icon: <AssessmentIcon />, path: `/${baseRoute}/reports` },
        { text: 'Settings', icon: <SettingsIcon />, path: `/${baseRoute}/settings` },
      ]
    } else if (user.role === 'Monitor') {
      return [
        { text: 'Dashboard', icon: <DashboardIcon />, path: `/${baseRoute}` },
        { text: 'Tool Checkout', icon: <BuildIcon />, path: `/${baseRoute}/tools` },
        { text: 'Lock-Up POS', icon: <InventoryIcon />, path: `/${baseRoute}/lockup` },
      ]
    } else {
      // Student
      return [
        { text: 'Dashboard', icon: <DashboardIcon />, path: `/${baseRoute}` },
        { text: 'My Items', icon: <StoreIcon />, path: `/${baseRoute}/my-items` },
        { text: 'Submit Item', icon: <StoreIcon />, path: `/${baseRoute}/submit` },
        { text: 'Transactions', icon: <AccountBalanceIcon />, path: `/${baseRoute}/transactions` },
      ]
    }
  }

  const drawer = (
    <Box>
      <Toolbar>
        <Typography variant="h6" noWrap component="div" fontWeight="bold">
          JDBB System
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {getNavigationItems().map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => {
                navigate(item.path)
                setMobileOpen(false)
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Jewellery & Lock-Up Management
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
              <Typography variant="body2">{user.preferredName || user.displayName}</Typography>
              <Typography variant="caption" color="inherit" sx={{ opacity: 0.8 }}>
                {user.role}
              </Typography>
            </Box>
            <IconButton onClick={handleProfileMenuOpen} color="inherit">
              <Avatar sx={{ width: 36, height: 36 }}>
                {(user.preferredName || user.displayName || 'U').charAt(0).toUpperCase()}
              </Avatar>
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
      >
        <MenuItem disabled>
          <ListItemIcon>
            <PersonIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary={user.preferredName || user.displayName}
            secondary={user.email}
          />
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Logout
        </MenuItem>
      </Menu>

      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        {/* Mobile drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>

        {/* Desktop drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: 8,
        }}
      >
        {children}
      </Box>
    </Box>
  )
}

export default Layout
