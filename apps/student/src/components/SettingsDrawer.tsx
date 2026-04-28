import {
  Box,
  Button,
  Divider,
  Drawer,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

const PREBUILT_VOICES = [
  "Aoede",
  "Charon",
  "Fenrir",
  "Kore",
  "Leda",
  "Orus",
  "Puck",
  "Zephyr",
];

export interface SettingsValue {
  micDeviceId?: string;
  voiceName: string;
  muted: boolean;
}

export function SettingsDrawer({
  open,
  onClose,
  value,
  onChange,
  onEndSession,
  sessionActive,
}: {
  open: boolean;
  onClose: () => void;
  value: SettingsValue;
  onChange: (v: SettingsValue) => void;
  onEndSession: () => void;
  sessionActive: boolean;
}) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    if (!open) return;
    navigator.mediaDevices
      .enumerateDevices()
      .then((all) => setDevices(all.filter((d) => d.kind === "audioinput")))
      .catch(() => setDevices([]));
  }, [open]);

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: 320, p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Settings
        </Typography>
        <Stack spacing={3}>
          <FormControl fullWidth>
            <InputLabel id="mic-label">Microphone</InputLabel>
            <Select
              labelId="mic-label"
              value={value.micDeviceId ?? ""}
              label="Microphone"
              onChange={(e) =>
                onChange({ ...value, micDeviceId: e.target.value || undefined })
              }
            >
              <MenuItem value="">System default</MenuItem>
              {devices.map((d) => (
                <MenuItem key={d.deviceId} value={d.deviceId}>
                  {d.label || `Mic ${d.deviceId.slice(0, 6)}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel id="voice-label">Voice</InputLabel>
            <Select
              labelId="voice-label"
              value={value.voiceName}
              label="Voice"
              onChange={(e) => onChange({ ...value, voiceName: e.target.value })}
            >
              {PREBUILT_VOICES.map((v) => (
                <MenuItem key={v} value={v}>
                  {v}
                </MenuItem>
              ))}
            </Select>
            {sessionActive && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                Voice changes apply to the next session.
              </Typography>
            )}
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={value.muted}
                onChange={(e) =>
                  onChange({ ...value, muted: e.target.checked })
                }
              />
            }
            label="Mute mic"
          />

          <Divider />

          <Button
            color="error"
            variant="outlined"
            disabled={!sessionActive}
            onClick={onEndSession}
          >
            Save and Publish
          </Button>
        </Stack>
      </Box>
    </Drawer>
  );
}
