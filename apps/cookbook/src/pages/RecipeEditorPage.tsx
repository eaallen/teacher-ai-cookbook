import { useEffect, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  FormControlLabel,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LinkIcon from "@mui/icons-material/Link";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import {
  cloneRecipe,
  createRecipe,
  getRecipe,
  updateRecipe,
  type LegacyRecipeFields,
  type Recipe,
} from "../data/recipes";
import {
  createMode,
  DEFAULT_CONVERSATIONAL_MODE,
  DEFAULT_RUBRIC,
  deleteMode,
  getMode,
  getLegacyCourseMaterialForRecipeRefs,
  getModesForRecipeRefs,
  type ModeType,
  publishMode,
  unpublishMode,
  updateMode,
  type AssessmentRubric,
  type RubricLevel,
  type RubricObjective,
  type RecipeMode,
} from "../data/modes";
import { LEVELS } from "../lib/levels";
import { CourseMaterialEditor } from "../components/CourseMaterialEditor";
import {
  buildLiveUrl,
  buildRecipeLiveUrl,
  resolveStudentAppOrigin,
} from "../lib/buildLiveUrl";
import { generateOralAssessmentRubric } from "../data/oralAssessmentRubric";

interface FormState {
  title: string;
  icon: string;
  level: string;
  tags: string[];
  courseMaterial: string;
}

const EMPTY: FormState = {
  title: "",
  icon: "📘",
  level: "grade5",
  tags: [],
  courseMaterial: "",
};

type RubricLevelKey = keyof RubricObjective["evaluation"];

const RUBRIC_LEVELS: { key: RubricLevelKey; label: string }[] = [
  { key: "beginning", label: "Beginning" },
  { key: "developing", label: "Developing" },
  { key: "proficient", label: "Proficient" },
  { key: "exemplary", label: "Exemplary" },
];

const MODE_OPTIONS: { type: ModeType; label: string }[] = [
  { type: "conversational", label: "Conversational" },
  { type: "oral_assessment", label: "Oral assessment" },
];

const DRAFT_CONVERSATIONAL_MODE_ID = "draft-conversational-mode";

/**
 * Creates an editable conversational mode before a new recipe is saved.
 * @param {string} ownerUid - Teacher uid for the draft mode.
 * @param {string} modeId - Local-only draft mode id.
 */
function createDraftConversationalMode(
  ownerUid: string,
  modeId = DRAFT_CONVERSATIONAL_MODE_ID
): RecipeMode {
  return {
    ...DEFAULT_CONVERSATIONAL_MODE,
    id: modeId,
    ownerUid,
    recipeId: "",
    published: false,
    publishedAt: null,
  };
}

/**
 * Creates an editable oral assessment mode before a new recipe is saved.
 * @param {string} ownerUid - Teacher uid for the draft mode.
 * @param {string} modeId - Local-only draft mode id.
 */
function createDraftOralAssessmentMode(
  ownerUid: string,
  modeId: string
): RecipeMode {
  return {
    id: modeId,
    ownerUid,
    recipeId: "",
    title: "Oral assessment",
    type: "oral_assessment",
    published: false,
    publishedAt: null,
    rubric: DEFAULT_RUBRIC,
  };
}

/**
 * Creates a display label for a recipe mode.
 * @param {RecipeMode} mode - Mode to label in the editor.
 */
function modeLabel(mode: RecipeMode): string {
  return mode.type === "oral_assessment" ? "Oral assessment" : "Conversational";
}

/**
 * Creates an empty rubric objective for teacher editing.
 * @param {number} index - Zero-based position used for the default id.
 */
function createBlankObjective(index: number): RubricObjective {
  return {
    id: `objective-${index + 1}`,
    learningObjective: "",
    evaluation: {
      beginning: { description: "", points: 0 },
      developing: { description: "", points: 0 },
      proficient: { description: "", points: 0 },
      exemplary: { description: "", points: 0 },
    },
  };
}

/**
 * Adds a new objective to the rubric.
 * @param {AssessmentRubric} rubric - Current rubric state.
 */
function addRubricObjective(rubric: AssessmentRubric): AssessmentRubric {
  const learningObjectives = rubric.learningObjectives ?? [];
  return {
    learningObjectives: [
      ...learningObjectives,
      createBlankObjective(learningObjectives.length),
    ],
  };
}

/**
 * Removes an objective from the rubric.
 * @param {AssessmentRubric} rubric - Current rubric state.
 * @param {number} objectiveIndex - Objective position to remove.
 */
function removeRubricObjective(
  rubric: AssessmentRubric,
  objectiveIndex: number
): AssessmentRubric {
  return {
    learningObjectives: (rubric.learningObjectives ?? []).filter(
      (_, index) => index !== objectiveIndex
    ),
  };
}

/**
 * Updates top-level fields on one rubric objective.
 * @param {AssessmentRubric} rubric - Current rubric state.
 * @param {number} objectiveIndex - Objective position to update.
 * @param {Partial<Pick<RubricObjective, "id" | "learningObjective">>} patch - Objective fields to merge.
 */
function updateRubricObjective(
  rubric: AssessmentRubric,
  objectiveIndex: number,
  patch: Partial<Pick<RubricObjective, "id" | "learningObjective">>
): AssessmentRubric {
  return {
    learningObjectives: (rubric.learningObjectives ?? []).map((objective, index) =>
      index === objectiveIndex ? { ...objective, ...patch } : objective
    ),
  };
}

/**
 * Updates one scoring level on a rubric objective.
 * @param {AssessmentRubric} rubric - Current rubric state.
 * @param {number} objectiveIndex - Objective position to update.
 * @param {RubricLevelKey} levelKey - Evaluation level to update.
 * @param {Partial<RubricLevel>} patch - Level fields to merge.
 */
function updateRubricLevel(
  rubric: AssessmentRubric,
  objectiveIndex: number,
  levelKey: RubricLevelKey,
  patch: Partial<RubricLevel>
): AssessmentRubric {
  return {
    learningObjectives: (rubric.learningObjectives ?? []).map((objective, index) =>
      index === objectiveIndex
        ? {
            ...objective,
            evaluation: {
              ...objective.evaluation,
              [levelKey]: {
                ...objective.evaluation[levelKey],
                ...patch,
              },
            },
          }
        : objective
    ),
  };
}

export default function RecipeEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [generatingRubricModeId, setGeneratingRubricModeId] = useState<
    string | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [modes, setModes] = useState<RecipeMode[]>([]);
  const [selectedModeId, setSelectedModeId] = useState<string | null>(null);
  const [addModeMenuAnchor, setAddModeMenuAnchor] =
    useState<HTMLElement | null>(null);
  const [collapsedObjectiveIndexes, setCollapsedObjectiveIndexes] = useState<
    number[]
  >([]);
  const [courseMaterialOpen, setCourseMaterialOpen] = useState(true);
  const [modesOpen, setModesOpen] = useState(!isNew);

  useEffect(() => {
    if (!isNew || !user) return;
    setModes((items) =>
      items.length > 0 ? items : [createDraftConversationalMode(user.uid)]
    );
    setSelectedModeId((current) => current ?? DRAFT_CONVERSATIONAL_MODE_ID);
  }, [isNew, user]);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    getRecipe(id!).then(async (r) => {
      if (r) {
        let loadedModes = await getModesForRecipeRefs(r.modes ?? []);
        const legacyCourseMaterial = r.courseMaterial
          ? ""
          : await getLegacyCourseMaterialForRecipeRefs(r.modes ?? []);
        if (loadedModes.length === 0 && user) {
          const legacy = r as Recipe & LegacyRecipeFields;
          const modeRef = await createMode({
            ownerUid: user.uid,
            recipeId: r.id,
            ...DEFAULT_CONVERSATIONAL_MODE,
            published: false,
            systemPrompt:
              legacy.systemPrompt ?? DEFAULT_CONVERSATIONAL_MODE.systemPrompt,
          });
          const repairedMode = await getMode(modeRef);
          loadedModes = repairedMode ? [repairedMode] : [];
        }
        setRecipe(r);
        setModes(loadedModes);
        setSelectedModeId(loadedModes[0]?.id ?? null);
        setForm({
          title: r.title,
          icon: r.icon,
          level: r.level,
          tags: r.tags,
          courseMaterial: r.courseMaterial || legacyCourseMaterial,
        });
      } else {
        setError("Recipe not found.");
      }
      setLoading(false);
    });
  }, [id, isNew]);

  useEffect(() => {
    setCollapsedObjectiveIndexes([]);
  }, [selectedModeId]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /**
   * Updates one mode in local editor state.
   * @param {string} modeId - Mode id to update.
   * @param {Partial<RecipeMode>} patch - Local mode fields to merge.
   */
  function updateLocalMode(modeId: string, patch: Partial<RecipeMode>) {
    setModes((items) =>
      items.map((mode) =>
        mode.id === modeId ? ({ ...mode, ...patch } as RecipeMode) : mode
      )
    );
  }

  /**
   * Shows or hides one rubric objective editor.
   * @param {number} objectiveIndex - Objective position to toggle.
   */
  function toggleRubricObjectiveCollapsed(objectiveIndex: number) {
    setCollapsedObjectiveIndexes((indexes) =>
      indexes.includes(objectiveIndex)
        ? indexes.filter((index) => index !== objectiveIndex)
        : [...indexes, objectiveIndex]
    );
  }

  /**
   * Saves all recipe metadata and mode configuration edits.
   */
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
        const newId = await createRecipe(user.uid, {
          ...form,
          initialModes: modes,
        });
        navigate(`/recipes/${newId}`, { replace: true });
      } else {
        await updateRecipe(id!, form);
        await Promise.all(
          modes.map((mode) => {
            if (mode.type === "conversational") {
              return updateMode(mode.id, {
                ownerUid: mode.ownerUid,
                recipeId: mode.recipeId,
                title: mode.title,
                type: mode.type,
                published: mode.published,
                systemPrompt: mode.systemPrompt,
              });
            }
            return updateMode(mode.id, {
              ownerUid: mode.ownerUid,
              recipeId: mode.recipeId,
              title: mode.title,
              type: mode.type,
              published: mode.published,
              rubric: mode.rubric,
            });
          })
        );
        setSnack("Saved.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  /**
   * Adds a new mode of the selected type to the current recipe.
   * @param {ModeType} type - Mode type chosen from the add-mode menu.
   */
  async function handleAddMode(type: ModeType) {
    if (!user || (!isNew && !recipe)) return;
    if (isNew) {
      setAddModeMenuAnchor(null);
      const draftId = `draft-${type}-${Date.now()}`;
      const created =
        type === "conversational"
          ? createDraftConversationalMode(user.uid, draftId)
          : createDraftOralAssessmentMode(user.uid, draftId);
      setModes((items) => [...items, created]);
      setSelectedModeId(created.id);
      setModesOpen(true);
      return;
    }
    if (!recipe) return;

    setSaving(true);
    setError(null);
    setAddModeMenuAnchor(null);
    try {
      const ref =
        type === "conversational"
          ? await createMode({
              ownerUid: user.uid,
              recipeId: recipe.id,
              ...DEFAULT_CONVERSATIONAL_MODE,
              published: false,
            })
          : await createMode({
              ownerUid: user.uid,
              recipeId: recipe.id,
              title: "Oral assessment",
              type: "oral_assessment",
              published: false,
              rubric: DEFAULT_RUBRIC,
            });
      const created = await getMode(ref);
      if (created) {
        setModes((items) => [...items, created]);
        setSelectedModeId(created.id);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  /**
   * Toggles whether a mode is accessible to students.
   * @param {RecipeMode} mode - Mode to publish or unpublish.
   */
  async function handleTogglePublished(mode: RecipeMode) {
    try {
      if (mode.published) {
        await unpublishMode(mode.id);
        updateLocalMode(mode.id, { published: false });
      } else {
        await publishMode(mode.id);
        updateLocalMode(mode.id, { published: true });
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  /**
   * Generates or improves an oral assessment rubric from course material.
   * @param {Extract<RecipeMode, { type: "oral_assessment" }>} mode - Oral assessment mode to update.
   */
  async function handleGenerateOralAssessmentRubric(
    mode: Extract<RecipeMode, { type: "oral_assessment" }>
  ) {
    const courseMaterial = form.courseMaterial.trim();
    if (!courseMaterial) {
      window.alert("Add course material before generating an oral assessment.");
      return;
    }

    setGeneratingRubricModeId(mode.id);
    setError(null);
    try {
      const rubric = await generateOralAssessmentRubric(
        courseMaterial,
        mode.rubric
      );
      updateLocalMode(mode.id, { rubric });
      setSnack("Oral assessment rubric generated.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGeneratingRubricModeId(null);
    }
  }

  /**
   * Removes a mode from the recipe and local editor state.
   * @param {RecipeMode} mode - Mode selected for deletion.
   */
  async function handleRemoveMode(mode: RecipeMode) {
    if (isNew) {
      const removedIndex = modes.findIndex((item) => item.id === mode.id);
      const nextModes = modes.filter((item) => item.id !== mode.id);
      setModes(nextModes);
      if (selectedModeId === mode.id) {
        setSelectedModeId(
          nextModes[removedIndex]?.id ?? nextModes[removedIndex - 1]?.id ?? null
        );
      }
      return;
    }

    if (!recipe) return;
    const confirmed = window.confirm(
      `Remove "${mode.title || modeLabel(mode)}"? Students will no longer be able to access this mode.`
    );
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    try {
      await deleteMode(recipe.id, mode.id);
      const removedIndex = modes.findIndex((item) => item.id === mode.id);
      const nextModes = modes.filter((item) => item.id !== mode.id);
      setModes(nextModes);
      if (selectedModeId === mode.id) {
        setSelectedModeId(
          nextModes[removedIndex]?.id ?? nextModes[removedIndex - 1]?.id ?? null
        );
      }
      setSnack("Mode removed.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  /**
   * Copies the student link for a published mode.
   * @param {RecipeMode} mode - Mode whose URL should be copied.
   */
  async function handleCopyModeLink(mode: RecipeMode) {
    if (!recipe) return;
    const origin = resolveStudentAppOrigin(import.meta.env.VITE_STUDENT_APP_ORIGIN);
    const url = buildLiveUrl(origin, recipe.id, mode.id);
    try {
      await navigator.clipboard.writeText(url);
      setSnack("Mode link copied.");
    } catch {
      setSnack(`Mode link: ${url}`);
    }
  }

  /**
   * Copies the student recipe link that opens the activity picker.
   */
  async function handleCopyRecipeLink() {
    if (!recipe) return;
    const origin = resolveStudentAppOrigin(import.meta.env.VITE_STUDENT_APP_ORIGIN);
    const url = buildRecipeLiveUrl(origin, recipe.id);
    try {
      await navigator.clipboard.writeText(url);
      setSnack("Recipe link copied.");
    } catch {
      setSnack(`Recipe link: ${url}`);
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
      const newId = await cloneRecipe(user.uid, sourceRecipe, modes);
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

  const selectedMode =
    modes.find((mode) => mode.id === selectedModeId) ?? modes[0] ?? null;

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
          {!isNew && recipe && (
            <Tooltip title="Copy recipe link">
              <span>
                <IconButton
                  aria-label="Copy recipe link"
                  onClick={handleCopyRecipeLink}
                  disabled={saving || cloning}
                >
                  <LinkIcon />
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
        </Stack>
      </Paper>

      <ButtonBase
        aria-expanded={courseMaterialOpen}
        onClick={() => setCourseMaterialOpen((open) => !open)}
        sx={{
          width: "100%",
          justifyContent: "flex-start",
          textAlign: "left",
          borderRadius: 1,
          mb: 2,
          p: 1,
          "&:hover": {
            bgcolor: "action.hover",
          },
        }}
      >
        <ExpandMoreIcon
          sx={{
            mr: 1,
            transition: "transform 160ms ease",
            transform: courseMaterialOpen ? "rotate(0deg)" : "rotate(-90deg)",
          }}
        />
        <Box>
          <Typography variant="h6">Course material</Typography>
          <Typography variant="body2" color="text.secondary">
            Markdown content the AI will reference and walk students through.
          </Typography>
        </Box>
      </ButtonBase>
      <Collapse in={courseMaterialOpen} timeout="auto" sx={{ mb: 3 }}>
        <CourseMaterialEditor
          markdown={form.courseMaterial}
          onChange={(md) => update("courseMaterial", md)}
        />
      </Collapse>

      <ButtonBase
        aria-expanded={modesOpen}
        onClick={() => setModesOpen((open) => !open)}
        sx={{
          width: "100%",
          justifyContent: "flex-start",
          textAlign: "left",
          borderRadius: 1,
          mb: 2,
          p: 1,
          "&:hover": {
            bgcolor: "action.hover",
          },
        }}
      >
        <ExpandMoreIcon
          sx={{
            mr: 1,
            transition: "transform 160ms ease",
            transform: modesOpen ? "rotate(0deg)" : "rotate(-90deg)",
          }}
        />
        <Box>
          <Typography variant="h6">Modes</Typography>
          <Typography variant="body2" color="text.secondary">
            Publish and configure each student experience separately.
          </Typography>
        </Box>
      </ButtonBase>

      <Collapse in={modesOpen} timeout="auto">
        {!isNew && modes.length === 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            No modes found yet. Save or reload this recipe to create one.
          </Alert>
        )}

        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <Stack spacing={1} sx={{ minWidth: { md: 260 } }}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<AddIcon />}
            endIcon={<ArrowDropDownIcon />}
            onClick={(event) => setAddModeMenuAnchor(event.currentTarget)}
            disabled={saving || (!isNew && !recipe)}
            sx={{ justifyContent: "space-between", mb: 1 }}
          >
            Add mode
          </Button>
          <Menu
            anchorEl={addModeMenuAnchor}
            open={Boolean(addModeMenuAnchor)}
            onClose={() => setAddModeMenuAnchor(null)}
          >
            {MODE_OPTIONS.map((option) => (
              <MenuItem
                key={option.type}
                onClick={() => handleAddMode(option.type)}
              >
                {option.label}
              </MenuItem>
            ))}
          </Menu>
          {modes.map((mode) => (
            <ButtonBase
              key={mode.id}
              onClick={() => setSelectedModeId(mode.id)}
              sx={{
                width: "100%",
                justifyContent: "stretch",
                borderRadius: 2,
                border: "1px solid",
                borderColor:
                  mode.id === selectedMode?.id ? "primary.main" : "divider",
                bgcolor:
                  mode.id === selectedMode?.id ? "action.selected" : "background.paper",
                p: 1.5,
                textAlign: "left",
              }}
            >
              <Stack spacing={0.75} sx={{ width: "100%" }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontWeight: 600 }}>
                      {mode.title || modeLabel(mode)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {modeLabel(mode)}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    color={mode.published ? "success" : "default"}
                    label={mode.published ? "Published" : "Draft"}
                  />
                  <Tooltip title="Remove mode">
                    <span>
                      <IconButton
                        aria-label={`Remove ${mode.title || modeLabel(mode)}`}
                        color="error"
                        disabled={saving || (isNew && modes.length <= 1)}
                        size="small"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleRemoveMode(mode);
                        }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Stack>
            </ButtonBase>
          ))}
        </Stack>

        {selectedMode && (
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack
              spacing={2}
              sx={{
                bgcolor: "grey.50",
                borderRadius: 2,
                p: 2,
              }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                alignItems={{ xs: "stretch", sm: "center" }}
                spacing={2}
              >
                <TextField
                  label="Mode title"
                  value={selectedMode.title}
                  onChange={(e) =>
                    updateLocalMode(selectedMode.id, { title: e.target.value })
                  }
                  sx={{ flex: 1 }}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={selectedMode.published}
                      disabled={isNew}
                      onChange={() => handleTogglePublished(selectedMode)}
                    />
                  }
                  label="Published"
                />
                <Tooltip title="Copy student link">
                  <span>
                    <IconButton
                      disabled={isNew || !selectedMode.published}
                      onClick={() => handleCopyModeLink(selectedMode)}
                    >
                      <LinkIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
              <Divider />

              {selectedMode.type === "conversational" ? (
                <Stack spacing={2}>
                  <TextField
                    label="AI Instructions"
                    value={selectedMode.systemPrompt}
                    onChange={(e) =>
                      updateLocalMode(selectedMode.id, {
                        systemPrompt: e.target.value,
                      })
                    }
                    multiline
                    minRows={3}
                    helperText="How the AI should behave during this conversational session."
                  />
                </Stack>
              ) : (
                <Stack spacing={2}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    alignItems={{ xs: "stretch", sm: "center" }}
                    justifyContent="space-between"
                    spacing={2}
                  >
                    <Box>
                      <Typography variant="subtitle1">Rubric</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Define each learning objective and point criteria for
                        the oral assessment.
                      </Typography>
                    </Box>
                    <Button
                      variant="outlined"
                      startIcon={<AutoAwesomeIcon />}
                      disabled={generatingRubricModeId === selectedMode.id}
                      onClick={() =>
                        handleGenerateOralAssessmentRubric(selectedMode)
                      }
                    >
                      {generatingRubricModeId === selectedMode.id
                        ? "Generating..."
                        : "Generate with AI"}
                    </Button>
                  </Stack>
                  <Stack spacing={2}>
                    {selectedMode.rubric.learningObjectives.map(
                      (objective, objectiveIndex) => {
                        const objectiveCollapsed =
                          collapsedObjectiveIndexes.includes(objectiveIndex);

                        return (
                        <Box
                          key={`${objective.id}-${objectiveIndex}`}
                          sx={{
                            borderTop: objectiveIndex === 0 ? 0 : "1px solid",
                            borderColor: "divider",
                            pt: objectiveIndex === 0 ? 0 : 2,
                          }}
                        >
                          <Stack spacing={2}>
                            <Stack
                              direction="row"
                              spacing={2}
                              alignItems="center"
                            >
                              <ButtonBase
                                aria-expanded={!objectiveCollapsed}
                                onClick={() =>
                                  toggleRubricObjectiveCollapsed(objectiveIndex)
                                }
                                sx={{
                                  flex: 1,
                                  justifyContent: "flex-start",
                                  textAlign: "left",
                                  borderRadius: 1,
                                  p: 1,
                                  minWidth: 0,
                                  "&:hover": {
                                    bgcolor: "action.hover",
                                  },
                                }}
                              >
                                <ExpandMoreIcon
                                  sx={{
                                    mr: 1,
                                    transition: "transform 160ms ease",
                                    transform: objectiveCollapsed
                                      ? "rotate(-90deg)"
                                      : "rotate(0deg)",
                                  }}
                                />
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography sx={{ fontWeight: 600 }}>
                                    Objective {objectiveIndex + 1}
                                    {objective.id ? `: ${objective.id}` : ""}
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    noWrap
                                  >
                                    {objective.learningObjective ||
                                      "No learning objective yet"}
                                  </Typography>
                                </Box>
                              </ButtonBase>
                              <Button
                                color="error"
                                disabled={
                                  selectedMode.rubric.learningObjectives.length <=
                                  1
                                }
                                onClick={() =>
                                  updateLocalMode(selectedMode.id, {
                                    rubric: removeRubricObjective(
                                      selectedMode.rubric,
                                      objectiveIndex
                                    ),
                                  })
                                }
                              >
                                Remove
                              </Button>
                            </Stack>
                            <Collapse in={!objectiveCollapsed} timeout="auto">
                              <Stack spacing={2}>
                                <TextField
                                  label="Objective id"
                                  value={objective.id}
                                  onChange={(e) =>
                                    updateLocalMode(selectedMode.id, {
                                      rubric: updateRubricObjective(
                                        selectedMode.rubric,
                                        objectiveIndex,
                                        { id: e.target.value }
                                      ),
                                    })
                                  }
                                  sx={{ maxWidth: { sm: 220 } }}
                                />
                                <TextField
                                  label="Learning objective"
                                  value={objective.learningObjective}
                                  onChange={(e) =>
                                    updateLocalMode(selectedMode.id, {
                                      rubric: updateRubricObjective(
                                        selectedMode.rubric,
                                        objectiveIndex,
                                        { learningObjective: e.target.value }
                                      ),
                                    })
                                  }
                                  multiline
                                  minRows={2}
                                />
                                <Stack
                                  divider={<Divider flexItem />}
                                  sx={{
                                    borderTop: "1px solid",
                                    borderColor: "divider",
                                  }}
                                >
                                  {RUBRIC_LEVELS.map((level) => (
                                    <Stack
                                      key={level.key}
                                      direction={{ xs: "column", md: "row" }}
                                      spacing={2}
                                      alignItems={{
                                        xs: "stretch",
                                        md: "flex-start",
                                      }}
                                      sx={{ py: 2 }}
                                    >
                                      <Typography
                                        variant="subtitle2"
                                        sx={{
                                          fontWeight: 600,
                                          minWidth: { md: 110 },
                                          pt: { md: 1.5 },
                                        }}
                                      >
                                        {level.label}
                                      </Typography>
                                      <TextField
                                        label="Criteria description"
                                        value={
                                          objective.evaluation[level.key]
                                            .description
                                        }
                                        onChange={(e) =>
                                          updateLocalMode(selectedMode.id, {
                                            rubric: updateRubricLevel(
                                              selectedMode.rubric,
                                              objectiveIndex,
                                              level.key,
                                              {
                                                description: e.target.value,
                                              }
                                            ),
                                          })
                                        }
                                        multiline
                                        minRows={2}
                                        sx={{ flex: 1 }}
                                      />
                                      <TextField
                                        label="Points"
                                        type="number"
                                        value={
                                          objective.evaluation[level.key].points
                                        }
                                        onChange={(e) =>
                                          updateLocalMode(selectedMode.id, {
                                            rubric: updateRubricLevel(
                                              selectedMode.rubric,
                                              objectiveIndex,
                                              level.key,
                                              {
                                                points: Number(
                                                  e.target.value || 0
                                                ),
                                              }
                                            ),
                                          })
                                        }
                                        sx={{ width: { md: 120 } }}
                                      />
                                    </Stack>
                                  ))}
                                </Stack>
                              </Stack>
                            </Collapse>
                          </Stack>
                        </Box>
                        );
                      }
                    )}
                    <Button
                      variant="outlined"
                      onClick={() =>
                        updateLocalMode(selectedMode.id, {
                          rubric: addRubricObjective(selectedMode.rubric),
                        })
                      }
                    >
                      Add objective
                    </Button>
                  </Stack>
                </Stack>
              )}
            </Stack>
          </Box>
        )}
        </Stack>
      </Collapse>

      <Alert
        severity="info"
        sx={{ mt: 3 }}
      >
        Save recipe changes after editing mode content. Publishing can be toggled
        independently for each mode.
      </Alert>

      <Alert
        severity="success"
        sx={{ mt: 2, display: snack ? "flex" : "none" }}
        onClose={() => setSnack(null)}
      >
        {snack}
      </Alert>
    </Box>
  );
}
