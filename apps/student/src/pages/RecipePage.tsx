import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  Fade,
  IconButton,
  Snackbar,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import KeyboardIcon from "@mui/icons-material/Keyboard";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import { useParams } from "react-router-dom";
import { ensureSignedIn, auth } from "../firebase";
import { loadRecipe, type Recipe } from "../data/recipe";
import { LandingButton } from "../components/LandingButton";
import { CoveragePanel } from "../components/CoveragePanel";
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
import { TranscriptFlusher } from "../data/transcripts";

const DEFAULT_SETTINGS: SettingsValue = {
  voiceName: "Aoede",
  muted: false,
};

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; recipe: Recipe }
  | { kind: "missing" };

export default function RecipePage() {
  const { recipeId } = useParams<{ recipeId: string }>();
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [coverage, setCoverage] = useState<CoverageState>([]);
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
    let cancelled = false;
    (async () => {
      await ensureSignedIn();
      const r = await loadRecipe(recipeId);
      if (cancelled) return;
      if (!r) setLoadState({ kind: "missing" });
      else setLoadState({ kind: "ready", recipe: r });
    })().catch((e) => {
      if (!cancelled) {
        setError((e as Error).message);
        setLoadState({ kind: "missing" });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [recipeId]);

  useEffect(() => {
    if (loadState.kind === "ready") {
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
    const sessionId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    flusherRef.current = new TranscriptFlusher(recipe.id, sessionId);

    const session = new LiveSession();
    sessionRef.current = session;

    try {
      await session.start({
        recipe,
        micDeviceId: settings.micDeviceId,
        voiceName: settings.voiceName,
        events: {
          onCoverage: setCoverage,
          onTranscript,
          onStatus: setStatus,
          onError: setError,
        },
      });

      session.sendText("What is the course material we are going to cover today?");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  /**
   * Ends the active session and flushes any buffered transcript turns.
   */
  async function saveAndPublish() {
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
        pb: coverage.length ? 14 : 4,
      }}
    >
      <Stack alignItems="center" spacing={3}>
        {!sessionActive && status !== "ended" && (
          <LandingButton onClick={start} disabled={status === "connecting"} />
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
          sx={{ position: "fixed", bottom: coverage.length ? 100 : 16, right: 16 }}
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
          void saveAndPublish();
        }}
      />

      <CoveragePanel topics={coverage} />

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
