import { Icon } from "../components/Icon.jsx";
import { PageHead } from "../components/PageHead.jsx";
import { StatCard } from "../components/StatCard.jsx";
import { Sparkline } from "../components/Sparkline.jsx";
import { useMembers, useDashboard } from "../hooks.js";

const STATUS_COLOR = {
  online: "var(--green)",
  idle: "var(--amber)",
  offline: "var(--fg-4)",
};

const xpSpark = [12, 18, 26, 22, 30, 28, 36, 32, 40, 44, 48, 52];

export const Members = () => {
  const { data: MEMBERS } = useMembers();
  const stats = useDashboard();
  const totalMembers = stats?.totalMembers ?? MEMBERS.length;
  return (
  <>
    <PageHead
      tag="MEMBERS"
      title="Server Members"
      desc="ภาพรวมสมาชิกในเซิร์ฟเวอร์ — รวม role, level, สถานะ"
      actions={
        <>
          <button className="btn ghost">
            <Icon name="filter" size={13} /> Filter
          </button>
          <button className="btn ghost">
            <Icon name="download" size={13} /> Export
          </button>
        </>
      }
    />

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4,1fr)",
        gap: "var(--gap)",
        marginBottom: "var(--gap)",
      }}
    >
      <StatCard label="Total Members" value={totalMembers.toLocaleString()} />
      <StatCard label="Online Now" value="—" delta="ต้องเชื่อม Discord gateway" deltaDir="flat" />
      <StatCard label="Stargazers" value="—" delta="ต้องเชื่อม Discord roles" deltaDir="flat" />
      <StatCard label="New This Month" value="—" />
    </div>

    <div className="card">
      <div className="card-head">
        <div className="card-title">
          <span className="dot" />
          All Members
        </div>
        <div className="search" style={{ minWidth: 200, fontSize: 11, padding: "4px 8px" }}>
          <Icon name="search" size={11} />
          <span style={{ flex: 1 }}>ค้นหา…</span>
        </div>
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th>Member</th>
            <th>Role</th>
            <th>Level</th>
            <th>Status</th>
            <th>Joined</th>
            <th>XP Source</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {MEMBERS.map((m) => (
            <tr key={m[0]}>
              <td>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span style={{ position: "relative" }}>
                    <span
                      className="e-avatar"
                      style={{
                        display: "inline-grid",
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: "linear-gradient(135deg,var(--accent-2),var(--accent))",
                        color: "#1a1a22",
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      {m[0].slice(0, 2).toUpperCase()}
                    </span>
                    <span
                      style={{
                        position: "absolute",
                        bottom: -1,
                        right: -1,
                        width: 9,
                        height: 9,
                        borderRadius: "50%",
                        border: "2px solid var(--bg-1)",
                        background: STATUS_COLOR[m[4]],
                      }}
                    />
                  </span>
                  <span>
                    <strong style={{ fontWeight: 500 }}>{m[1]}</strong>
                    {m[6] && (
                      <span style={{ marginLeft: 6 }} className="pill solid" title="Booster">
                        <Icon name="star" size={9} />
                      </span>
                    )}
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)" }}>
                      @{m[0]}
                    </div>
                  </span>
                </span>
              </td>
              <td>
                {m[2] === "Stargazer" ? (
                  <span
                    className="pill solid"
                    style={{
                      color: "var(--accent)",
                      background: "var(--accent-soft)",
                      border: "1px solid var(--accent-glow)",
                    }}
                  >
                    {m[2]}
                  </span>
                ) : (
                  <span className="pill solid offline">{m[2]}</span>
                )}
              </td>
              <td className="mono">Lv.{m[3]}</td>
              <td>
                <span className={"pill " + m[4]}>{m[4]}</span>
              </td>
              <td className="mono dim">{m[5]}</td>
              <td>
                <Sparkline data={xpSpark} color="var(--accent)" />
              </td>
              <td>
                <button className="btn ghost btn-sm">
                  <Icon name="more" size={11} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </>
  );
};
