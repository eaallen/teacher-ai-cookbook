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
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ListAltIcon from "@mui/icons-material/ListAlt";
import DeleteIcon from "@mui/icons-material/Delete";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import SchoolIcon from "@mui/icons-material/School";
import LinkIcon from "@mui/icons-material/Link";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import {
  cloneRecipe,
  deleteRecipe,
  listenRecipes,
  type Recipe,
} from "../data/recipes";
import { getModesForRecipeRefs, type RecipeMode } from "../data/modes";
import { LEVELS, levelLabel } from "../lib/levels";
import { buildRecipeLiveUrl, resolveStudentAppOrigin } from "../lib/buildLiveUrl";

/**
 * Shows the teacher recipe dashboard with filtering, grouping, and empty states.
 */
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
  const [modeSummaries, setModeSummaries] = useState<
    Record<string, { total: number; published: number; modes: RecipeMode[] }>
  >({});

  useEffect(() => {
    if (!user) return;
    return listenRecipes(user.uid, setRecipes);
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        recipes.map(async (recipe) => {
          const modes = await getModesForRecipeRefs(recipe.modes ?? []);
          return [
            recipe.id,
            {
              total: modes.length,
              published: modes.filter((mode) => mode.published).length,
              modes,
            },
          ] as const;
        })
      );
      if (!cancelled) setModeSummaries(Object.fromEntries(entries));
    })().catch((e) => setSnack((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [recipes]);

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

  /**
   * Creates a copy of the selected recipe.
   * @param {Recipe} sourceRecipe - Recipe to clone into a new draft.
   */
  async function handleCloneRecipe(sourceRecipe: Recipe) {
    if (!user) return;
    const sourceModes =
      modeSummaries[sourceRecipe.id]?.modes ??
      (await getModesForRecipeRefs(sourceRecipe.modes ?? []));
    await cloneRecipe(user.uid, sourceRecipe, sourceModes);
    setSnack("Recipe cloned.");
  }

  /**
   * Copies the student recipe link that opens the activity picker.
   * @param {Recipe} recipe - Recipe whose student link should be copied.
   */
  async function handleCopyRecipeLink(recipe: Recipe) {
    const origin = resolveStudentAppOrigin(import.meta.env.VITE_STUDENT_APP_ORIGIN);
    const url = buildRecipeLiveUrl(origin, recipe.id);
    try {
      await navigator.clipboard.writeText(url);
      setSnack("Recipe link copied.");
    } catch {
      setSnack(`Recipe link: ${url}`);
    }
  }

  return (
    <Box>
      {recipes.length > 0 && (
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
      )}

      {recipes.length === 0 && (
        <Box
          sx={{
            minHeight: "calc(100vh - 220px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            px: 2,
            py: 8,
          }}
        >
          <Stack spacing={3} alignItems="center" sx={{ maxWidth: 560 }}>
            <Box
              sx={{
                position: "relative",
                width: 220,
                height: 160,
                borderRadius: 6,
                background:
                  "linear-gradient(135deg, rgba(59, 91, 219, 0.14), rgba(59, 91, 219, 0.04))",
                border: "1px solid",
                borderColor: "primary.light",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <SchoolIcon sx={{ fontSize: 72, color: "primary.main" }} />
              <AutoAwesomeIcon
                sx={{
                  position: "absolute",
                  top: 24,
                  right: 34,
                  fontSize: 34,
                  color: "primary.main",
                }}
              />
              <AutoAwesomeIcon
                sx={{
                  position: "absolute",
                  bottom: 26,
                  left: 34,
                  fontSize: 24,
                  color: "primary.light",
                }}
              />
            </Box>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                Start building learner experiences
              </Typography>
              <Typography color="text.secondary">
                Create a tutor recipe, add learning material, and publish modes
                for students.
              </Typography>
            </Box>
            <Button
              variant="contained"
              size="large"
              startIcon={<AddIcon />}
              onClick={() => navigate("/recipes/new")}
              sx={{ px: 4, py: 1.5, fontSize: "1rem", textTransform: "none" }}
            >
              Create Your First AI Experiance for Learners
            </Button>
          </Stack>
        </Box>
      )}

      {recipes.length > 0 && filtered.length === 0 && (
        <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
          <Typography variant="h6">No matching recipes</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Try changing your search or filters.
          </Typography>
        </Box>
      )}

      {recipes.length > 0 && groups.map((g) => (
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
                        <Chip
                          size="small"
                          color={
                            modeSummaries[r.id]?.published ? "success" : "default"
                          }
                          label={`${modeSummaries[r.id]?.total ?? 0} modes · ${
                            modeSummaries[r.id]?.published ?? 0
                          } published`}
                        />
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
                    <Button size="small" onClick={() => navigate(`/recipes/${r.id}`)}>
                      Edit
                    </Button>
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
                    <Tooltip title="Copy recipe link">
                      <IconButton
                        size="small"
                        onClick={() => handleCopyRecipeLink(r)}
                      >
                        <LinkIcon fontSize="small" />
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

      {recipes.length > 0 && (
        <Fab
          color="primary"
          aria-label="New recipe"
          sx={{ position: "fixed", bottom: 24, right: 24 }}
          onClick={() => navigate("/recipes/new")}
        >
          <AddIcon />
        </Fab>
      )}

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
