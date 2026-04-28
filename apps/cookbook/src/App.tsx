import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth/RequireAuth";
import { AppShell } from "./components/AppShell";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import RecipeEditorPage from "./pages/RecipeEditorPage";
import TranscriptsPage from "./pages/TranscriptsPage";
import PricingPage from "./pages/PricingPage";

/**
 * Declares the app's top-level authenticated and public routes.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/recipes/new" element={<RecipeEditorPage />} />
        <Route path="/recipes/:id" element={<RecipeEditorPage />} />
        <Route
          path="/recipes/:id/transcripts"
          element={<TranscriptsPage />}
        />
        <Route path="/pricing" element={<PricingPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
