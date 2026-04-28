import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { httpsCallable } from "firebase/functions";
import { useSearchParams } from "react-router-dom";
import { functions } from "../firebase";

export default function BillingPage() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [params] = useSearchParams();
  const status = params.get("status");

  async function go(name: string) {
    setBusy(name);
    setError(null);
    try {
      const fn = httpsCallable<unknown, { url: string }>(functions, name);
      const res = await fn({});
      window.location.assign(res.data.url);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <Box sx={{ maxWidth: 720, mx: "auto" }}>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
        Billing
      </Typography>

      {status === "success" && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Subscription activated. Thank you!
        </Alert>
      )}
      {status === "cancelled" && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Checkout cancelled.
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography>
            Subscribe to unlock unlimited recipes and student sessions.
          </Typography>
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              onClick={() => go("createStripeCheckoutSession")}
              disabled={Boolean(busy)}
            >
              {busy === "createStripeCheckoutSession"
                ? "Redirecting…"
                : "Subscribe"}
            </Button>
            <Button
              variant="outlined"
              onClick={() => go("createStripeBillingPortalSession")}
              disabled={Boolean(busy)}
            >
              {busy === "createStripeBillingPortalSession"
                ? "Redirecting…"
                : "Manage billing"}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
