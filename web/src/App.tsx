import { useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router";
import { onAuthError } from "./api/client";
import { useSession } from "./api/hooks";
import { Layout } from "./components/Layout";
import { LogoMark } from "./components/Logo";
import { SkeletonCard } from "./components/ui";
import { LoginPage } from "./pages/Login";

const DashboardPage = lazy(() => import("./pages/Dashboard"));
const SchedulePage = lazy(() => import("./pages/Schedule"));
const GradesPage = lazy(() => import("./pages/Grades"));
const ClassesPage = lazy(() => import("./pages/Classes"));
const ClassPage = lazy(() => import("./pages/Class"));
const ProgressPage = lazy(() => import("./pages/Progress"));
const PastClassesPage = lazy(() => import("./pages/Classes").then((m) => ({ default: m.PastClassesPage })));
const CalendarPage = lazy(() => import("./pages/Calendar"));
const ForumPage = lazy(() => import("./pages/Forum"));
const NotFoundPage = lazy(() => import("./pages/NotFound"));

/** Any 401 from the API (expired SIGAA session) drops all cached data and returns to login. */
function AuthWatcher() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  useEffect(
    () =>
      onAuthError((code) => {
        qc.clear();
        navigate(code === "SESSION_EXPIRED" ? "/login?expired=1" : "/login", { replace: true });
      }),
    [qc, navigate],
  );
  return null;
}

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center" aria-busy="true" aria-label="Carregando">
      <LogoMark className="size-12 animate-pulse" />
    </div>
  );
}

function RequireAuth() {
  const session = useSession();
  const location = useLocation();
  if (session.isPending) return <Splash />;
  if (session.isError) {
    const expired = session.error.code === "SESSION_EXPIRED";
    const next = location.pathname !== "/" ? `&next=${encodeURIComponent(location.pathname)}` : "";
    return <Navigate to={`/login?${expired ? "expired=1" : ""}${next}`} replace />;
  }
  return <Layout />;
}

function PageFallback() {
  return (
    <div className="space-y-4">
      <SkeletonCard lines={2} />
      <SkeletonCard lines={4} />
    </div>
  );
}

export function App() {
  return (
    <>
      <AuthWatcher />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route
            index
            element={
              <Suspense fallback={<PageFallback />}>
                <DashboardPage />
              </Suspense>
            }
          />
          {(
            [
              ["horarios", SchedulePage],
              ["notas", GradesPage],
              ["turmas", ClassesPage],
              ["turmas/anteriores", PastClassesPage],
              ["turmas/:id", ClassPage],
              ["turmas/:id/:secao", ClassPage],
              ["progresso", ProgressPage],
              ["calendario", CalendarPage],
              ["forum", ForumPage],
              ["forum/:id", ForumPage],
              ["*", NotFoundPage],
            ] as const
          ).map(([path, Page]) => (
            <Route
              key={path}
              path={path}
              element={
                <Suspense fallback={<PageFallback />}>
                  <Page />
                </Suspense>
              }
            />
          ))}
        </Route>
      </Routes>
    </>
  );
}
