import { useEffect, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useNavigate, useParams } from "react-router-dom";
import { listenTranscripts, type TranscriptDoc } from "../data/transcripts";
import { getRecipe, type Recipe } from "../data/recipes";

export default function TranscriptsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [items, setItems] = useState<TranscriptDoc[] | null>(null);

  useEffect(() => {
    if (!id) return;
    getRecipe(id).then(setRecipe);
    return listenTranscripts(id, setItems);
  }, [id]);

  if (!id) return null;

  return (
    <Box sx={{ maxWidth: 960, mx: "auto" }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 3 }}
      >
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Transcripts {recipe ? `— ${recipe.title}` : ""}
        </Typography>
        <Button onClick={() => navigate(`/recipes/${id}`)}>Back to recipe</Button>
      </Stack>

      {items === null && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {items && items.length === 0 && (
        <Paper sx={{ p: 6, textAlign: "center", color: "text.secondary" }}>
          No transcripts yet. Once a student starts a session, it will appear
          here.
        </Paper>
      )}

      {items?.map((t) => (
        <Accordion key={t.id} sx={{ mb: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" spacing={2} sx={{ width: "100%" }}>
              <Typography sx={{ flex: 1 }}>
                Session {t.id.slice(0, 8)}
              </Typography>
              <Chip
                size="small"
                label={`${t.turns?.length ?? 0} turns`}
              />
              <Typography variant="body2" color="text.secondary">
                {t.lastAppendedAt
                  ? new Date(t.lastAppendedAt.seconds * 1000).toLocaleString()
                  : "—"}
              </Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <List dense>
              {t.turns?.map((turn, i) => (
                <ListItem key={i} alignItems="flex-start">
                  <ListItemText
                    primary={
                      <Typography variant="caption" color="text.secondary">
                        {turn.role === "user" ? "Student" : "Tutor"} ·{" "}
                        {new Date(turn.ts).toLocaleTimeString()}
                      </Typography>
                    }
                    secondary={
                      <Typography
                        variant="body2"
                        color="text.primary"
                        sx={{ whiteSpace: "pre-wrap" }}
                      >
                        {turn.text}
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}
