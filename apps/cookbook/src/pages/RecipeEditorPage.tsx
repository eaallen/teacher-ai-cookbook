import { useEffect, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import {
  createRecipe,
  getRecipe,
  updateRecipe,
  type Recipe,
} from "../data/recipes";
import { LEVELS } from "../lib/levels";
import { CourseMaterialEditor } from "../components/CourseMaterialEditor";

interface FormState {
  title: string;
  icon: string;
  level: string;
  tags: string[];
  systemPrompt: string;
  courseMaterial: string;
}

const EMPTY: FormState = {
  title: "",
  icon: "📘",
  level: "grade5",
  tags: [],
  systemPrompt:
    "You are a friendly tutor. Greet the student warmly, then guide them through the course material. Use the addTopic, setTopics, and markCovered tools to track which topics you've discussed.",
  courseMaterial: "",
};

export default function RecipeEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipe, setRecipe] = useState<Recipe | null>(null);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    getRecipe(id!).then((r) => {
      if (r) {
        setRecipe(r);
        setForm({
          title: r.title,
          icon: r.icon,
          level: r.level,
          tags: r.tags,
          systemPrompt: r.systemPrompt,
          courseMaterial: r.courseMaterial,
        });
      } else {
        setError("Recipe not found.");
      }
      setLoading(false);
    });
  }, [id, isNew]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!user) return;
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        const newId = await createRecipe(user.uid, form);
        navigate(`/recipes/${newId}`, { replace: true });
      } else {
        await updateRecipe(id!, form);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  /**
   * Creates a new recipe by cloning the current one.
   * @param {Recipe} sourceRecipe - Existing recipe used as the clone source.
   */
  async function handleClone(sourceRecipe: Recipe) {
    if (!user) return;
    setCloning(true);
    setError(null);
    try {
      const newId = await createRecipe(user.uid, {
        title: `${sourceRecipe.title} copy`,
        icon: sourceRecipe.icon,
        level: sourceRecipe.level,
        tags: sourceRecipe.tags,
        systemPrompt: sourceRecipe.systemPrompt,
        courseMaterial: sourceRecipe.courseMaterial,
        initialTopics: sourceRecipe.initialTopics,
      });
      navigate(`/recipes/${newId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCloning(false);
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 960, mx: "auto" }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 3 }}
      >
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          {isNew ? "New recipe" : "Edit recipe"}
        </Typography>
        <Stack direction="row" spacing={1}>
          {!isNew && recipe && (
            <Tooltip title="Clone recipe">
              <span>
                <IconButton
                  aria-label="Clone recipe"
                  onClick={() => handleClone(recipe)}
                  disabled={saving || cloning}
                >
                  <ContentCopyIcon />
                </IconButton>
              </span>
            </Tooltip>
          )}
          <Button onClick={() => navigate("/")} disabled={saving || cloning}>
            Back
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || cloning}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {recipe?.published && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Published. Live URL:&nbsp;
          <a href={recipe.liveUrl} target="_blank" rel="noreferrer">
            {recipe.liveUrl}
          </a>
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Icon"
              value={form.icon}
              onChange={(e) => update("icon", e.target.value.slice(0, 2))}
              inputProps={{ maxLength: 2 }}
              sx={{ width: 100 }}
            />
            <TextField
              label="Title"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              required
              sx={{ flex: 1 }}
            />
            <TextField
              select
              label="Level"
              value={form.level}
              onChange={(e) => update("level", e.target.value)}
              sx={{ minWidth: 200 }}
            >
              {LEVELS.map((l) => (
                <MenuItem key={l.value} value={l.value}>
                  {l.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Autocomplete
            multiple
            freeSolo
            options={[]}
            value={form.tags}
            onChange={(_, v) => update("tags", v)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Tags"
                placeholder="Press enter to add"
              />
            )}
          />
          <TextField
            label="System prompt"
            value={form.systemPrompt}
            onChange={(e) => update("systemPrompt", e.target.value)}
            multiline
            minRows={3}
            helperText="How the AI should behave during the live session."
          />
        </Stack>
      </Paper>

      <Typography variant="h6" sx={{ mb: 1 }}>
        Course material
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Markdown content the AI will reference and walk students through.
      </Typography>
      <CourseMaterialEditor
        markdown={form.courseMaterial}
        onChange={(md) => update("courseMaterial", md)}
      />
    </Box>
  );
}
