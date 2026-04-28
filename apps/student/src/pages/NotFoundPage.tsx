import { Box, Typography } from "@mui/material";

export default function NotFoundPage() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Typography variant="h4" sx={{ fontWeight: 300, mb: 1 }}>
        Recipe not found
      </Typography>
      <Typography color="text.secondary">
        The link you followed isn&rsquo;t a valid tutor session.
      </Typography>
    </Box>
  );
}
