import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import RecipePage from "./pages/RecipePage";
import NotFoundPage from "./pages/NotFoundPage";

const theme = createTheme({
  palette: {
    mode: "light",
    background: { default: "#ffffff" },
    primary: { main: "#3b5bdb" },
  },
  typography: {
    fontFamily:
      "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <Routes>
          <Route path="/r/:recipeId" element={<RecipePage />} />
          <Route path="/r/:recipeId/m/:modeId" element={<RecipePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
