import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

/**
 * Renders the teacher authentication form and redirects signed-in teachers.
 */
export default function LoginPage() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, user, loading } =
    useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !user || user.isAnonymous) return;
    const from =
      (location.state as { from?: { pathname?: string } } | null)?.from
        ?.pathname ?? "/";
    navigate(from, { replace: true });
  }, [loading, location.state, navigate, user]);

  if (!loading && user && !user.isAnonymous) {
    return null;
  }

  async function withBusy(fn: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "grey.50",
        p: 2,
      }}
    >
      <Paper sx={{ p: 4, width: "100%", maxWidth: 420 }} elevation={2}>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
          Teacher Cookbook
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Sign in to manage your AI tutor recipes.
        </Typography>

        <Button
          fullWidth
          variant="outlined"
          startIcon={<GoogleIcon />}
          onClick={() => withBusy(signInWithGoogle)}
          disabled={busy}
          sx={{ mb: 2 }}
        >
          Continue with Google
        </Button>

        <Divider sx={{ my: 2 }}>or</Divider>

        <Tabs
          value={mode}
          onChange={(_, v) => setMode(v)}
          sx={{ mb: 2 }}
          variant="fullWidth"
        >
          <Tab label="Sign in" value="signin" />
          <Tab label="Sign up" value="signup" />
        </Tabs>

        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === "signin") {
              withBusy(() => signInWithEmail(email, password));
            } else {
              withBusy(() => signUpWithEmail(email, password, displayName));
            }
          }}
          sx={{ display: "flex", flexDirection: "column", gap: 2 }}
        >
          {mode === "signup" && (
            <TextField
              label="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          )}
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <Alert severity="error">{error}</Alert>}
          <Button type="submit" variant="contained" disabled={busy} size="large">
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
