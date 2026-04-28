import {
  AppBar,
  Avatar,
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from "@mui/material";
import RestaurantMenuIcon from "@mui/icons-material/RestaurantMenu";
import { useState } from "react";
import { Link as RouterLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

/**
 * Renders the authenticated app shell with top navigation.
 */
export function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: "1px solid #eee" }}>
        <Toolbar>
          <RestaurantMenuIcon sx={{ mr: 1, color: "primary.main" }} />
          <Typography
            variant="h6"
            component={RouterLink}
            to="/"
            sx={{
              color: "inherit",
              textDecoration: "none",
              flexGrow: 1,
              fontWeight: 600,
            }}
          >
            Teacher's AI Cookbook
          </Typography>
          <Button color="inherit" component={RouterLink} to="/pricing">
            Pricing
          </Button>
          <IconButton onClick={(e) => setAnchor(e.currentTarget)} sx={{ ml: 1 }}>
            <Avatar sx={{ width: 32, height: 32 }}>
              {user?.displayName?.[0]?.toUpperCase() ??
                user?.email?.[0]?.toUpperCase() ??
                "T"}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={anchor}
            open={Boolean(anchor)}
            onClose={() => setAnchor(null)}
          >
            <MenuItem disabled>{user?.email}</MenuItem>
            <MenuItem
              onClick={async () => {
                setAnchor(null);
                await signOut();
                navigate("/login", { replace: true });
              }}
            >
              Sign out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ p: 3 }}>
        <Outlet />
      </Box>
    </>
  );
}
