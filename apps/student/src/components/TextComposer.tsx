import {
  Box,
  IconButton,
  InputBase,
  Paper,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import { useState } from "react";

export function TextComposer({
  onSend,
}: {
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");

  function send() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <Paper
      elevation={2}
      sx={{
        display: "flex",
        alignItems: "center",
        px: 2,
        py: 0.5,
        width: "min(560px, 90vw)",
      }}
    >
      <InputBase
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a message…"
        sx={{ flex: 1 }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
      />
      <Box sx={{ width: 8 }} />
      <IconButton color="primary" onClick={send} disabled={!text.trim()}>
        <SendIcon />
      </IconButton>
    </Paper>
  );
}
