import { useEffect, useMemo } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router";
import { api, unwrap } from "@/api/client";
import { useApp } from "@/app/AppContext";
import { TabBar } from "@/ds";
import { I } from "@/icons";
import { inTelegram, tg } from "@/lib/telegram";

import { DevLogin } from "@/screens/DevLogin";
import { Welcome } from "@/screens/Welcome";
import { Onboarding } from "@/screens/Onboarding";
import { GamesFeed } from "@/screens/GamesFeed";
import { GameDetail } from "@/screens/GameDetail";
import { Signup } from "@/screens/Signup";
import { Pay } from "@/screens/Pay";
import { Waitlist } from "@/screens/Waitlist";
import { CancelSignup } from "@/screens/CancelSignup";
import { MyGames } from "@/screens/MyGames";
import { Profile } from "@/screens/Profile";
import { StatsScreen } from "@/screens/Stats";
import { HistoryScreen } from "@/screens/History";
import { Payments } from "@/screens/Payments";
import { SettingsScreen } from "@/screens/Settings";
import { PublicProfile } from "@/screens/PublicProfile";
import { Leaderboard } from "@/screens/Leaderboard";
import { Mvp } from "@/screens/Mvp";
import { Gallery } from "@/screens/Gallery";
import { CreateGame } from "@/screens/CreateGame";
import { Manage } from "@/screens/Manage";
import { Approve } from "@/screens/Approve";
import { SplitMode } from "@/screens/SplitMode";
import { ManualSplit } from "@/screens/ManualSplit";
import { DraftConfig } from "@/screens/DraftConfig";
import { DraftBoard } from "@/screens/DraftBoard";
import { Publish } from "@/screens/Publish";
import { Checkin } from "@/screens/Checkin";
import { Live } from "@/screens/Live";
import { BatchStats } from "@/screens/BatchStats";
import { Result } from "@/screens/Result";
import { Reconcile } from "@/screens/Reconcile";
import { Refunds } from "@/screens/Refunds";
import { Broadcast } from "@/screens/Broadcast";
import { Moderation } from "@/screens/Moderation";
import { Audit } from "@/screens/Audit";
import { Reports } from "@/screens/Reports";
import { Venues } from "@/screens/Venues";
import { Schedule } from "@/screens/Schedule";
import { Seasons } from "@/screens/Seasons";
import { NewSeason } from "@/screens/NewSeason";
import { SeasonArchive } from "@/screens/SeasonArchive";
import { Tools } from "@/screens/Tools";
import { Roles } from "@/screens/Roles";
import { Community } from "@/screens/Community";
import { QrConfig } from "@/screens/QrConfig";

const PLAYER_TABS = [
  { value: "/", label: "Игры", icon: <I.Calendar /> },
  { value: "/my", label: "Мои игры", icon: <I.CheckCircle /> },
  { value: "/ranks", label: "Рейтинг", icon: <I.Trophy /> },
  { value: "/profile", label: "Профиль", icon: <I.User /> },
];
const ORG_TABS = [
  { value: "/", label: "Игры", icon: <I.Calendar /> },
  { value: "/create", label: "Создать", icon: <I.Plus /> },
  { value: "/tools", label: "Инструменты", icon: <I.Settings /> },
  { value: "/profile", label: "Профиль", icon: <I.User /> },
];
const TAB_ROOTS = new Set(["/", "/my", "/ranks", "/profile", "/tools"]);

function TelegramAutoLogin() {
  const { login, toast } = useApp();
  useEffect(() => {
    if (!tg) return;
    unwrap(api.auth.telegram.$post({ json: { initData: tg.initData } }))
      .then((res) => login(res.token))
      .catch((e: Error) => toast(e.message, "error"));
  }, [login, toast]);
  return (
    <div className="lu-scr" style={{ justifyContent: "center", alignItems: "center" }}>
      <div className="lu-btn__spinner" style={{ width: 28, height: 28, color: "var(--accent)" }} />
    </div>
  );
}

export function App() {
  const { authed, meLoading, me, isOrganizer } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const isTabRoot = TAB_ROOTS.has(path);

  // Telegram BackButton drives stacked navigation.
  useEffect(() => {
    const t = tg;
    if (!t) return;
    const back = () => navigate(-1);
    if (!isTabRoot && authed) {
      t.BackButton.show();
      t.BackButton.onClick(back);
      return () => {
        t.BackButton.offClick(back);
        t.BackButton.hide();
      };
    }
    t.BackButton.hide();
    return undefined;
  }, [isTabRoot, authed, navigate]);

  const tabs = useMemo(() => (isOrganizer ? ORG_TABS : PLAYER_TABS), [isOrganizer]);

  if (!authed) {
    if (meLoading) {
      return (
        <div className="lu-app">
          <div className="lu-scr" style={{ justifyContent: "center", alignItems: "center" }}>
            <div className="lu-btn__spinner" style={{ width: 28, height: 28, color: "var(--accent)" }} />
          </div>
        </div>
      );
    }
    return <div className="lu-app">{inTelegram ? <TelegramAutoLogin /> : <DevLogin />}</div>;
  }

  // Force the onboarding wizard until the profile is complete.
  if (me && !me.onboarded && path !== "/welcome" && path !== "/onboarding") {
    return (
      <div className="lu-app">
        <Navigate to="/welcome" replace />
      </div>
    );
  }

  return (
    <div className="lu-app">
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative" }}>
        <Routes>
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/" element={<GamesFeed />} />
          <Route path="/my" element={<MyGames />} />
          <Route path="/ranks" element={<Leaderboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/game/:id" element={<GameDetail />} />
          <Route path="/game/:id/signup" element={<Signup />} />
          <Route path="/game/:id/pay" element={<Pay />} />
          <Route path="/game/:id/waitlist" element={<Waitlist />} />
          <Route path="/game/:id/cancel" element={<CancelSignup />} />
          <Route path="/game/:id/manage" element={<Manage />} />
          <Route path="/game/:id/approve" element={<Approve />} />
          <Route path="/game/:id/split" element={<SplitMode />} />
          <Route path="/game/:id/manual" element={<ManualSplit />} />
          <Route path="/game/:id/draftcfg" element={<DraftConfig />} />
          <Route path="/game/:id/draft" element={<DraftBoard />} />
          <Route path="/game/:id/publish" element={<Publish />} />
          <Route path="/game/:id/checkin" element={<Checkin />} />
          <Route path="/game/:id/live" element={<Live />} />
          <Route path="/game/:id/stats" element={<BatchStats />} />
          <Route path="/game/:id/result" element={<Result />} />
          <Route path="/game/:id/mvp" element={<Mvp />} />
          <Route path="/game/:id/gallery" element={<Gallery />} />
          <Route path="/game/:id/reconcile" element={<Reconcile />} />
          <Route path="/create" element={<CreateGame />} />
          <Route path="/stats" element={<StatsScreen />} />
          <Route path="/history" element={<HistoryScreen />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/player/:id" element={<PublicProfile />} />
          <Route path="/venues" element={<Venues />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/seasons" element={<Seasons />} />
          <Route path="/seasons/new" element={<NewSeason />} />
          <Route path="/seasons/:id" element={<SeasonArchive />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/broadcast" element={<Broadcast />} />
          <Route path="/moderation" element={<Moderation />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/refunds" element={<Refunds />} />
          <Route path="/roles" element={<Roles />} />
          <Route path="/community" element={<Community />} />
          <Route path="/qrconfig" element={<QrConfig />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {isTabRoot && (
        <TabBar
          items={tabs}
          value={path}
          onChange={(t) => navigate(t === "/create" ? "/create" : t)}
        />
      )}
    </div>
  );
}
