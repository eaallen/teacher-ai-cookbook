import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";

/**
 * Shows current and upcoming plan options for the app.
 */
export default function PricingPage() {
  return (
    <Box sx={{ maxWidth: 960, mx: "auto" }}>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
        Pricing
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Choose the plan that fits where you are right now.
      </Typography>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="h6">Free</Typography>
                <Chip label="Available now" color="success" size="small" />
              </Stack>
              <Typography color="text.secondary">
                This is an early tool, and you can use it for free while we keep building.
                During this phase, things may change, data could get deleted, features may go
                down, and overall stability may vary.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="h6">Paid</Typography>
                <Chip label="Coming soon" color="warning" size="small" />
              </Stack>
              <Typography color="text.secondary">
                Paid plans are not available yet, but they are coming soon. With paid, you
                will get first-class support directly from the developers.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
