import {
  Box,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import type { CoverageState } from "../live/coverage";

export function CoveragePanel({ topics }: { topics: CoverageState }) {
  if (topics.length === 0) return null;
  const total = topics.length;
  const done = topics.filter((t) => t.covered).length;

  return (
    <Paper
      elevation={3}
      sx={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        p: 2,
        borderRadius: 0,
        borderTop: "1px solid",
        borderTopColor: "divider",
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="overline" color="text.secondary">
          Coverage
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {done} / {total}
        </Typography>
      </Stack>
      <Box sx={{ display: "flex", gap: 1, overflowX: "auto", pb: 0.5 }}>
        {topics.map((t) => (
          <Chip
            key={t.id}
            icon={
              t.covered ? (
                <CheckCircleIcon fontSize="small" />
              ) : (
                <RadioButtonUncheckedIcon fontSize="small" />
              )
            }
            label={t.title}
            color={t.covered ? "success" : "default"}
            variant={t.covered ? "filled" : "outlined"}
            sx={{
              flexShrink: 0,
              textDecoration: t.covered ? "line-through" : "none",
            }}
          />
        ))}
      </Box>
    </Paper>
  );
}
