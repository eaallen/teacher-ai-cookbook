import { useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardActionArea,
  CardActions,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fab,
  FormControlLabel,
  IconButton,
  MenuItem,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import AddIcon from "@mui/icons-material/Add";
import LinkIcon from "@mui/icons-material/Link";
import ListAltIcon from "@mui/icons-material/ListAlt";
import DeleteIcon from "@mui/icons-material/Delete";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import {
  createRecipe,
  deleteRecipe,
  listenRecipes,
  publishRecipe,
  unpublishRecipe,
  type Recipe,
} from "../data/recipes";
import { LEVELS, levelLabel } from "../lib/levels";
import { buildLiveUrl } from "../lib/buildLiveUrl";

const DEFAULT_STUDENT_APP_ORIGIN = "https://teacher-ai-student.web.app";

/**
 * Resolves which student app origin should be used for live recipe links.
 * @param {string | undefined} configuredOrigin - Optional origin set via environment variable.
 */
function resolveStudentAppOrigin(configuredOrigin: string | undefined): string {
  if (window.location.hostname === "localhost") {
    const origin = configuredOrigin?.trim();
    console.log("given origin", origin);
    return origin && origin.length > 0 ? origin : DEFAULT_STUDENT_APP_ORIGIN;
  }
  return DEFAULT_STUDENT_APP_ORIGIN;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [titleQuery, setTitleQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [updatedSortOrder, setUpdatedSortOrder] = useState<"desc" | "asc">("desc");
  const [groupByTag, setGroupByTag] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Recipe | null>(null);

  useEffect(() => {
    if (!user) return;
    return listenRecipes(user.uid, setRecipes);
  }, [user]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const r of recipes) for (const t of r.tags) set.add(t);
    return Array.from(set).sort();
  }, [recipes]);

  const filtered = useMemo(() => {
    const q = titleQuery.trim().toLowerCase();
    const filteredRecipes = recipes.filter((r) => {
      if (q && !r.title.toLowerCase().includes(q)) return false;
      if (levelFilter && r.level !== levelFilter) return false;
      if (tagFilter.length && !tagFilter.every((t) => r.tags.includes(t))) {
        return false;
      }
      return true;
    });

    return filteredRecipes.sort((a, b) => {
      const aUpdatedAt = a.updatedAt?.seconds ?? 0;
      const bUpdatedAt = b.updatedAt?.seconds ?? 0;
      return updatedSortOrder === "desc"
        ? bUpdatedAt - aUpdatedAt
        : aUpdatedAt - bUpdatedAt;
    });
  }, [recipes, titleQuery, tagFilter, levelFilter, updatedSortOrder]);

  const groups = useMemo(() => {
    if (!groupByTag) return [{ label: "All", recipes: filtered }];
    const byTag = new Map<string, Recipe[]>();
    for (const r of filtered) {
      const tags = r.tags.length ? r.tags : ["Untagged"];
      for (const t of tags) {
        if (!byTag.has(t)) byTag.set(t, []);
        byTag.get(t)!.push(r);
      }
    }
    return Array.from(byTag.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, rs]) => ({ label, recipes: rs }));
  }, [filtered, groupByTag]);

  async function handlePublish(r: Recipe) {
    console.log("import.meta.env.VITE_STUDENT_APP_ORIGIN", import.meta.env.VITE_STUDENT_APP_ORIGIN);
    const origin = resolveStudentAppOrigin(import.meta.env.VITE_STUDENT_APP_ORIGIN);
    console.log("origin", origin);
    const url = buildLiveUrl(origin, r.id);
    console.log("url", url);
    await publishRecipe(r.id, url);
    try {
      await navigator.clipboard.writeText(url);
      setSnack(`Published — link copied to clipboard.`);
    } catch {
      setSnack(`Published. Live URL: ${url}`);
    }
  }

  async function handleCopyLink(r: Recipe) {
    const origin = resolveStudentAppOrigin(import.meta.env.VITE_STUDENT_APP_ORIGIN);
    const url = r.liveUrl ?? buildLiveUrl(origin, r.id);
    try {
      await navigator.clipboard.writeText(url);
      setSnack("Link copied.");
    } catch {
      setSnack(`Link: ${url}`);
    }
  }

  /**
   * Creates a copy of the selected recipe.
   * @param {Recipe} sourceRecipe - Recipe to clone into a new draft.
   */
  async function handleCloneRecipe(sourceRecipe: Recipe) {
    if (!user) return;
    await createRecipe(user.uid, {
      title: `${sourceRecipe.title} copy`,
      icon: sourceRecipe.icon,
      level: sourceRecipe.level,
      tags: sourceRecipe.tags,
      systemPrompt: sourceRecipe.systemPrompt,
      courseMaterial: sourceRecipe.courseMaterial,
      initialTopics: sourceRecipe.initialTopics,
    });
    setSnack("Recipe cloned.");
  }

  return (
    <Box>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 3 }}>
        <TextField
          label="Search by title"
          value={titleQuery}
          onChange={(e) => setTitleQuery(e.target.value)}
          size="small"
          sx={{ flex: 1 }}
        />
        <Autocomplete
          multiple
          options={allTags}
          value={tagFilter}
          onChange={(_, v) => setTagFilter(v)}
          renderInput={(params) => (
            <TextField {...params} label="Filter by tags" size="small" />
          )}
          sx={{ minWidth: 240 }}
        />
        <TextField
          select
          label="Level"
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          size="small"
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">All levels</MenuItem>
          {LEVELS.map((l) => (
            <MenuItem key={l.value} value={l.value}>
              {l.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Sort by updated"
          value={updatedSortOrder}
          onChange={(e) => setUpdatedSortOrder(e.target.value as "desc" | "asc")}
          size="small"
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="desc">Newest first</MenuItem>
          <MenuItem value="asc">Oldest first</MenuItem>
        </TextField>
        <FormControlLabel
          control={
            <Switch
              checked={groupByTag}
              onChange={(e) => setGroupByTag(e.target.checked)}
            />
          }
          label="Group by tag"
        />
      </Stack>

      {filtered.length === 0 && (
        <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
          <Typography variant="h6">No recipes yet</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Tap the + button to create your first AI tutor.
          </Typography>
        </Box>
      )}

      {groups.map((g) => (
        <Box key={g.label} sx={{ mb: 4 }}>
          {groupByTag && (
            <Typography variant="overline" color="text.secondary">
              {g.label}
            </Typography>
          )}
          <Grid container spacing={2}>
            {g.recipes.map((r) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={r.id}>
                <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                  <CardActionArea onClick={() => navigate(`/recipes/${r.id}`)}>
                    <CardContent>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <Typography variant="h4" component="span">
                          {r.icon}
                        </Typography>
                        <Typography variant="h6" sx={{ flex: 1 }}>
                          {r.title}
                        </Typography>
                        {r.published ? (
                          <Chip size="small" color="success" label="Published" />
                        ) : (
                          <Chip size="small" label="Draft" />
                        )}
                      </Stack>
                      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
                        <Chip size="small" label={levelLabel(r.level)} />
                        {r.tags.map((t) => (
                          <Chip
                            key={t}
                            size="small"
                            variant="outlined"
                            label={t}
                          />
                        ))}
                      </Stack>
                    </CardContent>
                  </CardActionArea>
                  <CardActions sx={{ mt: "auto" }}>
                    {r.published ? (
                      <Button size="small" onClick={() => unpublishRecipe(r.id)}>
                        Unpublish
                      </Button>
                    ) : (
                      <Button size="small" onClick={() => handlePublish(r)}>
                        Publish
                      </Button>
                    )}
                    <Tooltip title="Copy live URL">
                      <span>
                        <IconButton
                          size="small"
                          disabled={!r.published}
                          onClick={() => handleCopyLink(r)}
                        >
                          <LinkIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Transcripts">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/recipes/${r.id}/transcripts`)}
                      >
                        <ListAltIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Clone recipe">
                      <IconButton
                        size="small"
                        onClick={() => handleCloneRecipe(r)}
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Box sx={{ flex: 1 }} />
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={() => setConfirmDelete(r)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}

      <Fab
        color="primary"
        aria-label="New recipe"
        sx={{ position: "fixed", bottom: 24, right: 24 }}
        onClick={() => navigate("/recipes/new")}
      >
        <AddIcon />
      </Fab>

      <Snackbar
        open={Boolean(snack)}
        message={snack ?? ""}
        autoHideDuration={4000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />

      <Dialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
      >
        <DialogTitle>Delete recipe?</DialogTitle>
        <DialogContent>
          This will permanently delete &ldquo;{confirmDelete?.title}&rdquo; and any
          transcripts attached to it.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button
            color="error"
            onClick={async () => {
              if (confirmDelete) await deleteRecipe(confirmDelete.id);
              setConfirmDelete(null);
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
