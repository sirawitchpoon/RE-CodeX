import { Icon, LogoMark } from "./Icon.jsx";

const NAV = [
  {
    section: "OVERVIEW",
    items: [
      { id: "dashboard", label: "Dashboard", icon: "dashboard" },
      { id: "members", label: "Server Members", icon: "users", badge: "1.2K" },
      { id: "logs", label: "Logs / Activity", icon: "activity" },
    ],
  },
  {
    section: "BOTSTACK",
    items: [
      { id: "giveaway", label: "Giveaway Bot", icon: "gift", badge: "LIVE" },
      { id: "level", label: "Level Bot", icon: "trophy" },
      { id: "rules", label: "XP Rules", icon: "sliders" },
      { id: "profile", label: "Member Profile", icon: "star" },
      { id: "moderation", label: "Moderation", icon: "shield" },
      { id: "music", label: "Music", icon: "mic" },
      { id: "welcome", label: "Welcome", icon: "smile" },
    ],
  },
  {
    section: "MOCKUPS",
    items: [{ id: "discord", label: "Discord UX", icon: "message" }],
  },
  {
    section: "SYSTEM",
    items: [{ id: "settings", label: "Settings", icon: "settings" }],
  },
];

export const Sidebar = ({ active = "dashboard", onNavigate }) => (
  <aside className="sidebar">
    <div className="brand">
      <div className="brand-mark">
        <LogoMark size={20} />
      </div>
      <div className="brand-name">
        RE:CodeX
        <small>BOT CONSOLE</small>
      </div>
    </div>

    <div className="nav-flow" style={{ display: "contents" }}>
      {NAV.map((group) => (
        <div className="side-section" key={group.section}>
          <div className="side-section-label">{group.section}</div>
          <div className="nav-list">
            {group.items.map((it) => (
              <button
                key={it.id}
                className={"nav-item" + (it.id === active ? " active" : "")}
                onClick={() => onNavigate && onNavigate(it.id)}
              >
                <span className="nav-icon">
                  <Icon name={it.icon} size={15} />
                </span>
                <span>{it.label}</span>
                {it.badge && <span className="nav-badge">{it.badge}</span>}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>

    <div className="user-card">
      <div className="avatar">AD</div>
      <div className="user-meta">
        <strong>admin</strong>
        <span>recodex.staff</span>
      </div>
    </div>
  </aside>
);

export const Topbar = ({ crumbs = [] }) => (
  <div className="topbar">
    <div className="crumbs">
      {crumbs.map((c, i) => (
        <span key={i} style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          {i > 0 && <span className="sep">/</span>}
          {i === crumbs.length - 1 ? <strong>{c}</strong> : <span>{c}</span>}
        </span>
      ))}
    </div>
    <div className="topbar-spacer" />
    <div className="search">
      <Icon name="search" size={13} />
      <span style={{ flex: 1 }}>ค้นหา bot, member, log…</span>
      <span className="kbd">⌘K</span>
    </div>
    <button className="icon-btn" title="Notifications">
      <Icon name="bell" size={15} />
    </button>
    <button className="icon-btn" title="Refresh">
      <Icon name="refresh" size={15} />
    </button>
  </div>
);

export const AppShell = ({ active, crumbs, onNavigate, children }) => (
  <div className="app">
    <Sidebar active={active} onNavigate={onNavigate} />
    <main className="main">
      <Topbar crumbs={crumbs} />
      <div className="content scrollbar-thin">{children}</div>
    </main>
  </div>
);
