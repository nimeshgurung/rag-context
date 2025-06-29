import React from 'react';
import { Outlet } from 'react-router-dom';
import { AppBar, Toolbar, Typography, TextField, Button, Link, Box } from '@mui/material';

const Layout: React.FC = () => {
  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Context7
          </Typography>
          <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
            <TextField
              variant="outlined"
              size="small"
              placeholder="Search library (e.g. Next, React)"
              sx={{ width: 400 }}
            />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Link href="#" color="inherit" underline="none">MCP Server</Link>
            <Link href="#" color="inherit" underline="none">API</Link>
            <Link href="#" color="inherit" underline="none">About</Link>
            <Button variant="contained" color="success">
              + Add Docs
            </Button>
          </Box>
        </Toolbar>
      </AppBar>
      <main>
        <Outlet />
      </main>
    </Box>
  );
};

export default Layout;