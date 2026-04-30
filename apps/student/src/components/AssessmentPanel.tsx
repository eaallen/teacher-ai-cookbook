import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import type { AssessmentState } from "../live/assessment";

/**
 * Shows oral assessment objective progress and scores.
 * @param {{ objectives: AssessmentState }} props - Assessment objectives to render.
 */
export function AssessmentPanel({
  objectives,
}: {
  objectives: AssessmentState;
}) {
  if (objectives.length === 0) return null;
  const assessed = objectives.filter((objective) => objective.assessed).length;

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
          Oral assessment
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {assessed} / {objectives.length} assessed
        </Typography>
      </Stack>
      <Box sx={{ display: "flex", gap: 1, overflowX: "auto", pb: 0.5 }}>
        {objectives.map((objective) => (
          <Chip
            key={objective.id}
            icon={
              objective.assessed ? (
                <CheckCircleIcon fontSize="small" />
              ) : (
                <RadioButtonUncheckedIcon fontSize="small" />
              )
            }
            label={
              objective.assessed
                ? `${objective.title}: ${objective.level} (${objective.points})`
                : objective.title
            }
            color={objective.assessed ? "success" : "default"}
            variant={objective.assessed ? "filled" : "outlined"}
            sx={{ flexShrink: 0 }}
          />
        ))}
      </Box>
    </Paper>
  );
}
