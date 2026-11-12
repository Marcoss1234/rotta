import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { getMe } from "@/app/api.js";
import AppLayout from "@/app/components/AppLayout.jsx";
import AccessRequestsPage from "@/app/pages/AccessRequestsPage.jsx";
import LiveMatchPage from "@/app/pages/LiveMatchPage.jsx";
import ShopPage from "@/app/pages/ShopPage.jsx";
import AccessStatusPage from "@/app/pages/AccessStatusPage.jsx";
import ChangePasswordPage from "@/app/pages/ChangePasswordPage.jsx";
import ChatPage from "@/app/pages/ChatPage.jsx";
import EventsPage from "@/app/pages/EventsPage.jsx";
import HomePage from "@/app/pages/HomePage.jsx";
import LoginPage from "@/app/pages/LoginPage.jsx";
import PlayedMatchesPage from "@/app/pages/PlayedMatchesPage.jsx";
import ProfilePage from "@/app/pages/ProfilePage.jsx";
import RankingPage from "@/app/pages/RankingPage.jsx";
import RewardsPage from "@/app/pages/RewardsPage.jsx";
import RatingSheetPage from "@/app/pages/RatingSheetPage.jsx";
import RosterPage from "@/app/pages/RosterPage.jsx";
import UsersPage from "@/app/pages/UsersPage.jsx";
import { syncPushSubscription } from "@/app/notifications.js";

// La pizarra pesa bastante: solo se descarga al entrar en ella.
const BoardsPage = lazy(() => import("@/app/pages/BoardsPage.jsx"));
const BoardEditorPage = lazy(() => import("@/app/pages/BoardEditorPage.jsx"));
const boardLoading = <p role="status" className="text-zinc-300">Cargando la pizarra…</p>;
import useAppViewport from "@/app/useAppViewport.js";

function FullScreenMessage({ children }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-void px-6 text-center font-body text-zinc-200">
      {children}
    </div>
  );
}

export default function PrivateApp() {
  const [session, setSession] = useState({ state: "loading", user: null });
  useAppViewport();

  const refresh = useCallback(async () => {
    try {
      const user = await getMe();
      setSession({ state: "ready", user });
    } catch (error) {
      setSession({ state: error.status === 401 ? "anonymous" : "error", user: null });
    }
  }, []);

  useEffect(() => {
    document.title = "App | Rotta";
    refresh();
  }, [refresh]);

  const userId = session.user?.status === "approved" ? session.user.id : null;
  useEffect(() => {
    // Es un extra: si falla, la app sigue funcionando sin avisos.
    if (userId) syncPushSubscription().catch(() => {});
  }, [userId]);

  const signedOut = useCallback(() => setSession({ state: "anonymous", user: null }), []);
  const signedIn = useCallback((user) => setSession({ state: "ready", user }), []);

  if (session.state === "loading") {
    return <FullScreenMessage><p role="status">Cargando…</p></FullScreenMessage>;
  }
  if (session.state === "error") {
    return (
      <FullScreenMessage>
        <p role="alert">No se ha podido conectar con el servidor.</p>
        <button
          type="button"
          onClick={refresh}
          className="min-h-11 rounded-lg border border-white/20 px-5 font-semibold text-white hover:bg-white/5"
        >
          Reintentar
        </button>
      </FullScreenMessage>
    );
  }
  if (session.state === "anonymous") {
    return <LoginPage onSignedIn={signedIn} />;
  }
  if (session.user.must_change_password) {
    return <ChangePasswordPage onChanged={signedIn} onSignedOut={signedOut} />;
  }
  if (session.user.status !== "approved") {
    return <AccessStatusPage user={session.user} onSignedOut={signedOut} onRefresh={refresh} />;
  }

  const isAdmin = session.user.role === "admin";
  return (
    <AppLayout isAdmin={isAdmin} user={session.user}>
      <Routes>
        <Route index element={<HomePage user={session.user} onAccessLost={refresh} />} />
        <Route path="partidos/jugados" element={<PlayedMatchesPage user={session.user} onAccessLost={refresh} />} />
        <Route path="eventos" element={<EventsPage onAccessLost={refresh} />} />
        <Route path="plantillas" element={<RosterPage user={session.user} onAccessLost={refresh} />} />
        <Route path="plantillas/pizarra" element={<Suspense fallback={boardLoading}><BoardsPage user={session.user} onAccessLost={refresh} /></Suspense>} />
        <Route path="plantillas/pizarra/:boardId" element={<Suspense fallback={boardLoading}><BoardEditorPage onAccessLost={refresh} /></Suspense>} />
        <Route path="ranking" element={<RankingPage user={session.user} onAccessLost={refresh} />} />
        <Route path="ranking/recompensas" element={<RewardsPage user={session.user} onAccessLost={refresh} />} />
        <Route path="ranking/notas" element={<RatingSheetPage onAccessLost={refresh} />} />
        <Route
          path="solicitudes"
          element={isAdmin || session.user.role === "entrenador" ? <AccessRequestsPage onAccessLost={refresh} /> : <Navigate to="/app" replace />}
        />
        <Route path="chat" element={<ChatPage onAccessLost={refresh} />} />
        <Route path="directo/:liveId" element={<LiveMatchPage onAccessLost={refresh} />} />
        <Route path="tienda" element={<ShopPage onAccessLost={refresh} />} />
        <Route
          path="usuarios"
          element={isAdmin ? <UsersPage currentUser={session.user} onAccessLost={refresh} /> : <Navigate to="/app" replace />}
        />
        <Route path="perfil" element={<ProfilePage user={session.user} onSignedOut={signedOut} onUserChanged={signedIn} onAccessLost={refresh} />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </AppLayout>
  );
}
