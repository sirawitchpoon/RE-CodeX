import { useEffect, useState } from "react";
import { AppShell } from "./components/AppShell.jsx";
import { TweaksPanel } from "./components/TweaksPanel.jsx";
import { Dashboard } from "./pages/Dashboard.jsx";
import { Members } from "./pages/Members.jsx";
import { Logs } from "./pages/Logs.jsx";
import { Giveaway } from "./pages/Giveaway.jsx";
import { Leaderboard } from "./pages/Leaderboard.jsx";
import { LevelRules } from "./pages/LevelRules.jsx";
import { UserProfile } from "./pages/UserProfile.jsx";
import { Settings } from "./pages/Settings.jsx";
import { DiscordMockup } from "./pages/DiscordMockup.jsx";
import { Placeholder } from "./pages/Placeholder.jsx";

const PAGES = {
  dashboard: {
    crumbs: ["RE:CodeX", "Overview", "Dashboard"],
    render: () => <Dashboard />,
  },
  members: {
    crumbs: ["RE:CodeX", "Overview", "Server Members"],
    render: () => <Members />,
  },
  logs: {
    crumbs: ["RE:CodeX", "Overview", "Logs / Activity"],
    render: () => <Logs />,
  },
  giveaway: {
    crumbs: ["RE:CodeX", "Botstack", "Giveaway"],
    render: () => <Giveaway />,
  },
  level: {
    crumbs: ["RE:CodeX", "Botstack", "Level — Leaderboard"],
    render: () => <Leaderboard />,
  },
  rules: {
    crumbs: ["RE:CodeX", "Botstack", "Level — XP Rules"],
    render: () => <LevelRules />,
  },
  profile: {
    crumbs: ["RE:CodeX", "Botstack", "Member Profile"],
    render: () => <UserProfile />,
  },
  moderation: {
    crumbs: ["RE:CodeX", "Botstack", "Moderation"],
    render: () => (
      <Placeholder
        tag="MODERATION"
        title="Moderation Bot"
        desc="ตั้งค่ากฎ automod, รายการ case และ log การลงโทษ"
        icon="shield"
      />
    ),
  },
  music: {
    crumbs: ["RE:CodeX", "Botstack", "Music"],
    render: () => (
      <Placeholder
        tag="MUSIC"
        title="Music Bot"
        desc="คิวเพลง, ห้อง stage และการเชื่อมต่อ provider"
        icon="mic"
      />
    ),
  },
  welcome: {
    crumbs: ["RE:CodeX", "Botstack", "Welcome"],
    render: () => (
      <Placeholder
        tag="WELCOME"
        title="Welcome Bot"
        desc="ตั้งค่าข้อความต้อนรับ และ banner สำหรับสมาชิกใหม่"
        icon="smile"
      />
    ),
  },
  discord: {
    crumbs: ["RE:CodeX", "Mockups", "Discord UX"],
    render: () => <DiscordMockup />,
  },
  settings: {
    crumbs: ["RE:CodeX", "System", "Settings"],
    render: () => <Settings />,
  },
};

const DEFAULT_TWEAKS = { theme: "dark", nav: "side", density: "comfy" };

const App = () => {
  const [active, setActive] = useState("dashboard");
  const [tweaks, setTweaks] = useState(DEFAULT_TWEAKS);

  useEffect(() => {
    const html = document.documentElement;
    html.dataset.theme = tweaks.theme;
    html.dataset.nav = tweaks.nav;
    html.dataset.density = tweaks.density;
  }, [tweaks]);

  const setTweak = (k, v) => setTweaks((t) => ({ ...t, [k]: v }));

  const page = PAGES[active] || PAGES.dashboard;

  return (
    <>
      <AppShell active={active} crumbs={page.crumbs} onNavigate={setActive}>
        {page.render()}
      </AppShell>
      <TweaksPanel tweaks={tweaks} setTweak={setTweak} />
    </>
  );
};

export default App;
