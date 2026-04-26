import { useState } from "react";
import { Icon } from "../components/Icon.jsx";
import { PageHead } from "../components/PageHead.jsx";
import { useLogsLive } from "../hooks.js";

const LEVELS = ["ALL", "INFO", "WARN", "ERROR", "EVENT"];

// Logs hook returns API objects ({createdAt, level, source, event, message})
// or mock array rows ([ts, level, source, event, message]). Normalize to a
// consistent positional shape so the existing JSX doesn't change.
function normalize(row) {
  if (Array.isArray(row)) return row;
  const ts = row.createdAt
    ? new Date(row.createdAt).toISOString().replace("T", " ").slice(0, 19)
    : "";
  return [ts, row.level, row.source, row.event, row.message];
}

export const Logs = () => {
  const [filter, setFilter] = useState("ALL");
  const live = useLogsLive(filter === "ALL" ? null : filter);
  const filtered = live.map(normalize).filter((l) => filter === "ALL" || l[1] === filter);

  return (
    <>
      <PageHead
        tag="LOGS"
        title="Activity Logs"
        desc="สตรีม log จากบอททุกตัวแบบ realtime"
        actions={
          <>
            <button className="btn ghost">
              <Icon name="pause" size={13} /> Pause Stream
            </button>
            <button className="btn ghost">
              <Icon name="download" size={13} /> Export
            </button>
          </>
        }
      />

      <div className="card">
        <div className="log-toolbar">
          <div className="seg">
            {LEVELS.map((l) => (
              <button key={l} className={filter === l ? "active" : ""} onClick={() => setFilter(l)}>
                {l}
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <span className="pill live">
            <Icon name="activity" size={9} /> live · {LOGS.length} events / min
          </span>
        </div>
        <div className="log-table">
          <div
            className="log-row"
            style={{
              background: "var(--bg-2)",
              color: "var(--fg-3)",
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              borderBottom: "1px solid var(--line)",
            }}
          >
            <span>timestamp</span>
            <span>level</span>
            <span>source</span>
            <span>event</span>
            <span>message</span>
          </div>
          {filtered.map((l, i) => (
            <div className="log-row" key={i}>
              <span className="ts">{l[0]}</span>
              <span className={"lvl " + l[1]}>{l[1]}</span>
              <span className="src">{l[2]}</span>
              <span className="ev">{l[3]}</span>
              <span className="msg">{l[4]}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
