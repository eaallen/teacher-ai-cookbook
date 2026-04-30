import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  ButtonBase,
  Chip,
  CircularProgress,
  Fade,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import KeyboardIcon from "@mui/icons-material/Keyboard";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import { Link as RouterLink, useParams } from "react-router-dom";
import { ensureSignedIn, auth } from "../firebase";
import {
  loadStudentRecipe,
  loadStudentSession,
  type Recipe,
  type RecipeMode,
  type RecipeModeSummary,
} from "../data/recipe";
import { LandingButton } from "../components/LandingButton";
import { CoveragePanel } from "../components/CoveragePanel";
import { AssessmentPanel } from "../components/AssessmentPanel";
import {
  SettingsDrawer,
  type SettingsValue,
} from "../components/SettingsDrawer";
import { TextComposer } from "../components/TextComposer";
import {
  LiveSession,
  type SessionStatus,
  type TranscriptTurn,
} from "../live/LiveSession";
import type { CoverageState } from "../live/coverage";
import type { AssessmentState } from "../live/assessment";
import { TranscriptFlusher } from "../data/transcripts";

const DEFAULT_SETTINGS: SettingsValue = {
  voiceName: "Aoede",
  muted: false,
};

type LoadState =
  | { kind: "loading" }
  | { kind: "recipe"; recipe: Recipe; modes: RecipeModeSummary[] }
  | { kind: "ready"; recipe: Recipe; mode: RecipeMode }
  | { kind: "missing" };

interface RecipeModePickerProps {
  recipe: Recipe;
  modes: RecipeModeSummary[];
}

interface ModeDescriptionProps {
  mode: RecipeModeSummary;
}

interface ModeBadgeStyle {
  label: string;
  sx: {
    bgcolor: string;
    color: string;
    borderColor: string;
  };
}

/**
 * Builds the student route for a selected recipe mode.
 * @param {string} recipeId - Recipe document id from the loaded recipe.
 * @param {string} modeId - Mode document id selected by the student.
 */
function buildModePath(recipeId: string, modeId: string): string {
  return `/r/${encodeURIComponent(recipeId)}/m/${encodeURIComponent(modeId)}`;
}

/**
 * Returns a readable label and color style for mode pills.
 * @param {RecipeModeSummary["type"] | RecipeMode["type"]} modeType - Mode type to style.
 */
function getModeBadgeStyle(
  modeType: RecipeModeSummary["type"] | RecipeMode["type"]
): ModeBadgeStyle {
  if (modeType === "oral_assessment") {
    return {
      label: "Oral assessment",
      sx: {
        bgcolor: "#FCE4EC",
        color: "#880E4F",
        borderColor: "#F8BBD0",
      },
    };
  }

  return {
    label: "Conversational",
    sx: {
      bgcolor: "#E3F2FD",
      color: "#0D47A1",
      borderColor: "#BBDEFB",
    },
  };
}

/**
 * Renders the short student-facing description for a mode card.
 * @param {ModeDescriptionProps} props - Published mode summary to describe.
 */
function ModeDescription({ mode }: ModeDescriptionProps) {
  if (mode.type === "oral_assessment") {
    const objectives =
      mode.learningObjectives.length > 0
        ? mode.learningObjectives
        : ["Practice explaining the key ideas from this recipe."];

    return (
      <Stack spacing={0.75}>
        <Typography color="text.secondary">Learning objectives:</Typography>
        <Box component="ol" sx={{ m: 0, pl: 3 }}>
          {objectives.map((objective, index) => (
            <Typography
              key={`${index}-${objective}`}
              component="li"
              color="text.secondary"
              sx={{ mb: 0.5 }}
            >
              {objective}
            </Typography>
          ))}
        </Box>
      </Stack>
    );
  }

  return (
    <Typography color="text.secondary">
      Learn about this topic just by talking with an AI tutor.
    </Typography>
  );
}

/**
 * Lets students choose from the published modes for a recipe.
 * @param {RecipeModePickerProps} props - Recipe and available published modes.
 */
function RecipeModePicker({ recipe, modes }: RecipeModePickerProps) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 3,
      }}
    >
      <Stack spacing={3} sx={{ width: "100%", maxWidth: 720 }}>
        <Stack spacing={1} alignItems="center" sx={{ textAlign: "center" }}>
          <Typography variant="h2" sx={{ fontWeight: 200 }}>
            {recipe.icon}
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 300 }}>
            {recipe.title}
          </Typography>
          <Typography color="text.secondary">
            Select your activity.
          </Typography>
        </Stack>

        {modes.length > 0 ? (
          <Stack spacing={2}>
            {modes.map((mode) => {
              const badge = getModeBadgeStyle(mode.type);
              return (
                <ButtonBase
                  key={mode.id}
                  component={RouterLink}
                  to={buildModePath(recipe.id, mode.id)}
                  sx={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    borderRadius: 3,
                  }}
                >
                  <Paper
                    variant="outlined"
                    sx={{
                      width: "100%",
                      p: 3,
                      borderRadius: 3,
                      transition: "border-color 120ms ease, box-shadow 120ms ease",
                      "&:hover": {
                        borderColor: "primary.main",
                        boxShadow: 2,
                      },
                    }}
                  >
                    <Stack spacing={1.5}>
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        justifyContent="space-between"
                      >
                        <Typography variant="h6" sx={{ fontWeight: 500 }}>
                          {mode.title}
                        </Typography>
                        <Chip size="small" label={badge.label} sx={badge.sx} />
                      </Stack>
                      <ModeDescription mode={mode} />
                    </Stack>
                  </Paper>
                </ButtonBase>
              );
            })}
          </Stack>
        ) : (
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
            <Typography color="text.secondary" sx={{ textAlign: "center" }}>
              No published modes are available for this recipe yet.
            </Typography>
          </Paper>
        )}
      </Stack>
    </Box>
  );
}

export default function RecipePage() {
  const { recipeId, modeId } = useParams<{ recipeId: string; modeId: string }>();
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [coverage, setCoverage] = useState<CoverageState>([]);
  const [assessment, setAssessment] = useState<AssessmentState>([]);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<SettingsValue>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showText, setShowText] = useState(false);
  const [lastAssistantText, setLastAssistantText] = useState("");

  const sessionRef = useRef<LiveSession | null>(null);
  const flusherRef = useRef<TranscriptFlusher | null>(null);

  useEffect(() => {
    if (!recipeId) {
      setLoadState({ kind: "missing" });
      return;
    }
    setLoadState({ kind: "loading" });
    let cancelled = false;
    (async () => {
      await ensureSignedIn();
      const session = modeId
        ? await loadStudentSession(recipeId, modeId)
        : await loadStudentRecipe(recipeId);
      if (cancelled) return;
      if (!session) setLoadState({ kind: "missing" });
      else if ("mode" in session) setLoadState({ kind: "ready", ...session });
      else setLoadState({ kind: "recipe", ...session });
    })().catch((e) => {
      if (!cancelled) {
        setError((e as Error).message);
        setLoadState({ kind: "missing" });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [recipeId, modeId]);

  useEffect(() => {
    if (loadState.kind === "ready" || loadState.kind === "recipe") {
      document.title = `${loadState.recipe.icon} ${loadState.recipe.title}`;
    }
  }, [loadState]);

  // Effect: keep mute state in sync with the active session.
  useEffect(() => {
    sessionRef.current?.setMuted(settings.muted);
  }, [settings.muted]);

  const onTranscript = useCallback((turn: TranscriptTurn) => {
    if (turn.role === "model") setLastAssistantText(turn.text);
    flusherRef.current?.add(turn);
  }, []);

  async function start() {
    if (loadState.kind !== "ready") return;
    setError(null);
    const recipe = loadState.recipe;
    const mode = loadState.mode;
    const sessionId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    flusherRef.current = new TranscriptFlusher(recipe.id, mode.id, sessionId);

    const session = new LiveSession();
    sessionRef.current = session;

    try {
      await session.start({
        recipe,
        mode,
        micDeviceId: settings.micDeviceId,
        voiceName: settings.voiceName,
        events: {
          onCoverage: setCoverage,
          onAssessment: setAssessment,
          onTranscript,
          onStatus: setStatus,
          onError: setError,
        },
      });

      session.sendText(
        mode.type === "oral_assessment"
          ? "Please begin the oral assessment."
          : "What is the course material we are going to cover today?"
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function end() {
    await sessionRef.current?.end();
    sessionRef.current = null;
    try {
      await flusherRef.current?.flush();
    } catch (e) {
      setError(`Could not save transcript: ${(e as Error).message}`);
    }
    flusherRef.current = null;
  }

  // Best-effort transcript flush on tab close.
  useEffect(() => {
    const flush = () => {
      void flusherRef.current?.flush().catch(() => undefined);
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
    return () => {
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  const sessionActive = useMemo(
    () => status === "connected" || status === "connecting" || status === "reconnecting",
    [status]
  );

  const bottomPanelVisible =
    loadState.kind === "ready" && (coverage.length > 0 || assessment.length > 0);
  const isAssessment =
    loadState.kind === "ready" && loadState.mode.type === "oral_assessment";
  const activeModeBadge =
    loadState.kind === "ready" ? getModeBadgeStyle(loadState.mode.type) : null;

  if (loadState.kind === "loading") {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (loadState.kind === "missing") {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          p: 3,
          textAlign: "center",
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 300, mb: 1 }}>
          Recipe not available
        </Typography>
        <Typography color="text.secondary">
          This tutor session isn&rsquo;t published yet, or the link is invalid.
        </Typography>
      </Box>
    );
  }

  if (loadState.kind === "recipe") {
    return (
      <RecipeModePicker recipe={loadState.recipe} modes={loadState.modes} />
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        pb: bottomPanelVisible ? 14 : 4,
      }}
    >
      <Stack alignItems="center" spacing={3}>
        {!sessionActive && status !== "ended" && (
          <Stack alignItems="center" spacing={2}>
            {isAssessment && (
              <Typography color="text.secondary" sx={{ maxWidth: 520, textAlign: "center" }}>
                This mode is an oral assessment. Alex will ask questions and
                score each learning objective with the rubric.
              </Typography>
            )}
            <LandingButton
              onClick={start}
              disabled={status === "connecting"}
              label={isAssessment ? "START ASSESSMENT" : "TAP TO BEGIN"}
            />
          </Stack>
        )}

        {status === "connecting" && (
          <Typography color="text.secondary">Connecting…</Typography>
        )}

        {sessionActive && (
          <Stack alignItems="center" spacing={2}>
            <Typography variant="h2" sx={{ fontWeight: 200 }}>
              {loadState.recipe.icon}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 300 }}>
              {loadState.recipe.title}
            </Typography>
            {isAssessment && activeModeBadge && (
              <Chip label={activeModeBadge.label} sx={activeModeBadge.sx} />
            )}
            <Stack direction="row" alignItems="center" spacing={2}>
              <IconButton
                size="large"
                color={settings.muted ? "default" : "primary"}
                onClick={() =>
                  setSettings((s) => ({ ...s, muted: !s.muted }))
                }
              >
                {settings.muted ? (
                  <MicOffIcon fontSize="large" />
                ) : (
                  <MicIcon fontSize="large" />
                )}
              </IconButton>
              <Tooltip title="Type instead">
                <IconButton onClick={() => setShowText((v) => !v)}>
                  <KeyboardIcon />
                </IconButton>
              </Tooltip>
            </Stack>
            <Box
              aria-live="polite"
              sx={{
                minHeight: 80,
                maxWidth: 560,
                textAlign: "center",
                px: 3,
                color: "text.secondary",
              }}
            >
              <Fade in={Boolean(lastAssistantText)} timeout={400}>
                <Typography variant="body1">{lastAssistantText}</Typography>
              </Fade>
            </Box>
            {showText && (
              <TextComposer
                onSend={(text) => sessionRef.current?.sendText(text)}
              />
            )}
          </Stack>
        )}

        {status === "ended" && (
          <Stack alignItems="center" spacing={2}>
            <Typography variant="h5" sx={{ fontWeight: 300 }}>
              Session ended
            </Typography>
            <Typography color="text.secondary">
              Refresh the page to start again.
            </Typography>
          </Stack>
        )}
      </Stack>

      <Tooltip title="Settings">
        <IconButton
          aria-label="Settings"
          onClick={() => setSettingsOpen(true)}
          sx={{
            position: "fixed",
            bottom: bottomPanelVisible ? 100 : 16,
            right: 16,
          }}
        >
          <SettingsRoundedIcon />
        </IconButton>
      </Tooltip>

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        value={settings}
        onChange={setSettings}
        sessionActive={sessionActive}
        onEndSession={() => {
          setSettingsOpen(false);
          void end();
        }}
      />

      {isAssessment ? (
        <AssessmentPanel objectives={assessment} />
      ) : (
        <CoveragePanel topics={coverage} />
      )}

      <Snackbar
        open={Boolean(error)}
        autoHideDuration={8000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>

      {/* Anonymous uid debug — invisible, but useful for verifying auth state */}
      <Box
        sx={{
          position: "fixed",
          left: 8,
          bottom: 8,
          fontSize: 10,
          color: "transparent",
        }}
      >
        {auth.currentUser?.uid}
      </Box>
    </Box>
  );
}
