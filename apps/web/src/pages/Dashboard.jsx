import { Icon } from "../components/Icon.jsx";
import { PageHead } from "../components/PageHead.jsx";
import { StatCard } from "../components/StatCard.jsx";
import { BotCardRow } from "../components/BotCardRow.jsx";
import { useDashboard, useLogsLive, useHealth } from "../hooks.js";

const SOURCE_DOT = {
  "RX.Giveaway": "cyan",
  "RX.Welcome": "green",
  "RX.Moderation": "amber",
  "RX.Mod": "amber",
};

function normalizeLog(row) {
  if (Array.isArray(row)) return row;
  const ts = row.createdAt
    ? new Date(row.createdAt).toTimeString().slice(0, 8)
    : "";
  return [ts, row.level, row.source, row.event, row.message];
}

export const Dashboard = () => {
  const stats = useDashboard();
  const BOTS = stats?.bots ?? [];
  const logs = useLogsLive(null).map(normalizeLog).slice(0, 8);
  const { data: health } = useHealth();
  return (
  <>
    <PageHead
      tag="OVERVIEW"
      title="Botstack Dashboard"
      desc="ภาพรวมของบอททุกตัวที่กำลังทำงานอยู่บน RE:CodeX Discord Server"
      actions={
        <>
          <button className="btn ghost">
            <Icon name="download" size={13} /> Export
          </button>
          <button className="btn primary">
            <Icon name="plus" size={13} /> Deploy New Bot
          </button>
        </>
      }
    />

    <div className="stat-grid">
      <StatCard
        label="Active Bots"
        value={String(stats?.activeBots ?? 0)}
        suffix={`/ ${stats?.totalBots ?? 0}`}
        delta={stats?.activeBots === stats?.totalBots ? "all online" : "บางตัว offline"}
        deltaDir={stats?.activeBots === stats?.totalBots ? "up" : "down"}
      />
      <StatCard
        label="Total Events / 24h"
        value={(stats?.totalEvents24h ?? 0).toLocaleString()}
      />
      <StatCard label="Avg Latency" value="—" suffix="ms" />
      <StatCard
        label="Active Members"
        value="—"
        suffix={`/ ${(stats?.totalMembers ?? 0).toLocaleString()}`}
      />
    </div>

    <div className="dash-grid">
      <div className="card">
        <div className="card-head">
          <div className="card-title">
            <span className="dot" />
            Botstack
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn ghost btn-sm">
              <Icon name="filter" size={11} /> Filter
            </button>
            <button className="btn ghost btn-sm">
              <Icon name="list" size={11} /> List
            </button>
          </div>
        </div>
        <div>
          {BOTS.map((b) => (
            <BotCardRow key={b.id} bot={b} />
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <span className="dot" />
              Live Activity
            </div>
            <span className="pill live">streaming</span>
          </div>
          <div className="card-body">
            <div className="timeline">
              {logs.length === 0 && (
                <div style={{ color: "var(--fg-3)", fontSize: 12, padding: 8 }}>
                  ยังไม่มีกิจกรรม — รอบอทยิง log เข้ามา
                </div>
              )}
              {logs.map((l, i) => (
                <TLItem key={i} time={l[0]} code={l[2]} dotColor={SOURCE_DOT[l[2]]}>
                  <strong>{l[3]}</strong> {l[4]}
                </TLItem>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <span className="dot" />
              Resource Health
            </div>
          </div>
          <div className="card-body">
            <div className="health-list">
              <HealthRow name="api" pct={health?.ok ? 100 : 0} color="var(--accent)" />
              <HealthRow name="app-db" pct={health?.appDb ? 100 : 0} color="var(--cyan)" />
              <HealthRow name="points-db" pct={health?.pointsDb ? 100 : 0} color="var(--cyan)" />
              <HealthRow name="redis" pct={health?.redis ? 100 : 0} color="var(--green)" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </>
  );
};

const DOT_STYLES = {
  cyan: { background: "var(--cyan)", boxShadow: "0 0 0 3px rgba(122,224,255,0.18)" },
  green: { background: "var(--green)", boxShadow: "0 0 0 3px rgba(111,227,154,0.18)" },
  amber: { background: "var(--amber)", boxShadow: "0 0 0 3px rgba(255,194,102,0.18)" },
};

const TLItem = ({ time, code, dotColor, children }) => (
  <div className="timeline-item">
    <div className="tl-time">{time}</div>
    <div className="tl-dot" style={dotColor ? DOT_STYLES[dotColor] : undefined} />
    <div className="tl-body">
      <code>{code}</code> {children}
    </div>
  </div>
);

const HealthRow = ({ name, pct, color }) => (
  <div className="health-row">
    <div className="health-name">{name}</div>
    <div className="health-bar">
      <i style={{ width: pct + "%", background: color }} />
    </div>
    <div className="health-val">{pct === 100 ? "up" : pct === 0 ? "down" : `${pct}%`}</div>
  </div>
);
