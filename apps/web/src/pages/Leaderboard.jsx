import { useState } from "react";
import { Icon } from "../components/Icon.jsx";
import { PageHead } from "../components/PageHead.jsx";
import { useLeaderboard } from "../hooks.js";

const RANGES = [
  ["day", "วันนี้"],
  ["week", "สัปดาห์"],
  ["month", "เดือน"],
  ["all", "All-time"],
];

const PODIUM_COLORS = ["#c77dff", "#9aa0aa", "#cd9b6f"];
const PODIUM_GLOWS = [
  "rgba(199,125,255,0.18)",
  "rgba(154,160,170,0.10)",
  "rgba(205,155,111,0.14)",
];

export const Leaderboard = () => {
  const [range, setRange] = useState("week");
  const { data: LB } = useLeaderboard(range);
  return (
    <>
      <PageHead
        tag="LEADERBOARD"
        title="Level Bot — Leaderboard"
        desc="อันดับการมีส่วนร่วมในเซิร์ฟเวอร์ จัดอันดับตาม XP สะสม"
        actions={
          <div className="seg">
            {RANGES.map(([k, v]) => (
              <button key={k} className={range === k ? "active" : ""} onClick={() => setRange(k)}>
                {v}
              </button>
            ))}
          </div>
        }
      />

      <div className="lb-grid">
        {LB.slice(0, 3).map((r, i) => (
          <div
            className="podium"
            key={r[0]}
            style={{
              "--podium-color": PODIUM_COLORS[i],
              "--podium-glow": PODIUM_GLOWS[i],
            }}
          >
            <div className="podium-rank">
              #{i + 1} · {i === 0 ? "CHAMPION" : i === 1 ? "RUNNER-UP" : "THIRD"}
            </div>
            <div className="podium-who">
              <div className="podium-av">{r[0].slice(0, 2).toUpperCase()}</div>
              <div>
                <div className="podium-name">{r[1]}</div>
                <div className="podium-handle">@{r[0]}</div>
              </div>
            </div>
            <div className="podium-stats">
              <div>
                <span>Level</span>
                <strong>{r[2]}</strong>
              </div>
              <div>
                <span>Total XP</span>
                <strong>{r[3].toLocaleString()}</strong>
              </div>
              <div>
                <span>Messages</span>
                <strong>{r[4].toLocaleString()}</strong>
              </div>
              <div>
                <span>This {range}</span>
                <strong style={{ color: "var(--green)" }}>{r[5]}</strong>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">
            <span className="dot" />
            All Members
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <div className="search" style={{ minWidth: 200, fontSize: 11, padding: "4px 8px" }}>
              <Icon name="search" size={11} />
              <span style={{ flex: 1 }}>ค้นหา…</span>
            </div>
            <button className="btn ghost btn-sm">
              <Icon name="download" size={11} /> Export
            </button>
          </div>
        </div>
        <div>
          <table className="tbl lb-tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>Member</th>
                <th>Level</th>
                <th>Total XP</th>
                <th>Progress</th>
                <th>Messages</th>
                <th>This {range}</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {LB.map((r, i) => {
                const pct = Math.min(100, (r[3] % 3000) / 30);
                return (
                  <tr key={r[0]}>
                    <td>
                      <span className={"lb-rank" + (i < 3 ? " top" : "")}>
                        #{(i + 1).toString().padStart(2, "0")}
                      </span>
                    </td>
                    <td>
                      <span
                        className="e-avatar"
                        style={{
                          display: "inline-grid",
                          width: 24,
                          height: 24,
                          borderRadius: 4,
                          background: "linear-gradient(135deg,var(--accent-2),var(--accent))",
                          color: "#1a1a22",
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          fontWeight: 700,
                          marginRight: 8,
                          verticalAlign: "middle",
                        }}
                      >
                        {r[0].slice(0, 2).toUpperCase()}
                      </span>
                      <strong style={{ fontWeight: 500 }}>{r[1]}</strong>{" "}
                      <span
                        style={{
                          color: "var(--fg-3)",
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                        }}
                      >
                        @{r[0]}
                      </span>
                    </td>
                    <td className="mono">Lv.{r[2]}</td>
                    <td className="mono col-num">{r[3].toLocaleString()}</td>
                    <td style={{ width: 140 }}>
                      <div className="lb-bar">
                        <i style={{ width: pct + "%" }} />
                      </div>
                    </td>
                    <td className="mono col-num">{r[4].toLocaleString()}</td>
                    <td className="mono" style={{ color: "var(--green)" }}>
                      {r[5]}
                    </td>
                    <td>
                      {r[6] === "Stargazer" ? (
                        <span
                          className="pill solid"
                          style={{
                            color: "var(--accent)",
                            background: "var(--accent-soft)",
                            border: "1px solid var(--accent-glow)",
                          }}
                        >
                          {r[6]}
                        </span>
                      ) : (
                        <span className="pill solid offline">{r[6]}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};
