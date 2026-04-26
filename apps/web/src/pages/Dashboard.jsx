import { Icon } from "../components/Icon.jsx";
import { PageHead } from "../components/PageHead.jsx";
import { StatCard } from "../components/StatCard.jsx";
import { BotCardRow } from "../components/BotCardRow.jsx";
import { useDashboard } from "../hooks.js";

export const Dashboard = () => {
  const stats = useDashboard();
  const BOTS = stats?.bots ?? [];
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
      <StatCard label="Active Bots" value="5" suffix="/ 5" delta="all online" deltaDir="up" />
      <StatCard label="Total Events / 24h" value="30,446" delta="+12.4%" deltaDir="up" />
      <StatCard label="Avg Latency" value="42" suffix="ms" delta="-3ms" deltaDir="up" />
      <StatCard label="Active Members" value="847" suffix="/ 1,243" delta="+24" deltaDir="up" />
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
              <TLItem time="14:32:08" code="RX.Level">
                granted <strong>+12 XP</strong> to @kazuki in #general-chat
              </TLItem>
              <TLItem time="14:31:52" code="RX.Giveaway" dotColor="cyan">
                new entry <strong>@hibiki_92</strong> → "Birthday Pack — REI"
              </TLItem>
              <TLItem time="14:30:14" code="RX.Level">
                level-up <strong>@aoi_v</strong> reached <strong>Lv.24</strong>
              </TLItem>
              <TLItem time="14:28:42" code="RX.Welcome" dotColor="green">
                greeted <strong>@new_listener_42</strong>
              </TLItem>
              <TLItem time="14:27:01" code="RX.Moderation" dotColor="amber">
                flagged <strong>3 messages</strong> for link-spam — auto-deleted
              </TLItem>
              <TLItem time="14:24:18" code="RX.Giveaway">
                drew winner <strong>@suki_dev</strong> for "MV Pre-listening Pass"
              </TLItem>
              <TLItem time="14:22:55" code="RX.Level">
                granted <strong>+8 XP</strong> to @ren_codex in voice #karaoke-stage
              </TLItem>
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
              <HealthRow name="api.gateway" pct={32} />
              <HealthRow name="postgres" pct={58} color="var(--cyan)" />
              <HealthRow name="redis" pct={18} color="var(--green)" />
              <HealthRow name="disk.write" pct={71} color="var(--amber)" />
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
    <div className="health-val">{pct}%</div>
  </div>
);
