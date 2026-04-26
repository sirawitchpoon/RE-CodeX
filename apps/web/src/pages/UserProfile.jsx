import { useMemo } from "react";
import { Icon, Sparkle } from "../components/Icon.jsx";
import { PageHead } from "../components/PageHead.jsx";

const member = {
  name: "Kazuki Asahina",
  handle: "kazuki_v",
  id: "384207192749211648",
  joined: "2025-09-12",
  level: 62,
  xp: 184230,
  nextXP: 225000,
  role: "Stargazer",
  msgs: 4204,
  voice: "82h 14m",
  streak: 42,
};

const TOP_CHANNELS = [
  ["#general-chat", 1842, 100],
  ["#fan-art", 982, 53],
  ["#karaoke-stage", 612, 33],
  ["#mv-watchparty", 410, 22],
  ["#mod-events", 358, 19],
];

const ACHIEVEMENTS = [
  ["Lv.60 Constellation Unlock", "2 วันก่อน", "trophy"],
  ["First Place — Weekly Leaderboard", "5 วันก่อน", "star"],
  ["Won Giveaway: MV Pre-listening Pass", "1 สัปดาห์ก่อน", "gift"],
  ["30-day streak", "12 วันก่อน", "flame"],
];

export const UserProfile = () => {
  const heatmap = useMemo(
    () => Array.from({ length: 12 * 7 }, () => Math.random()),
    []
  );

  return (
    <>
      <PageHead
        tag="LEVEL · MEMBER"
        title="Member Profile"
        desc="ดูกิจกรรม XP รายคน รวมถึง heatmap และ ห้องที่ active ที่สุด"
        actions={
          <>
            <button className="btn ghost">
              <Icon name="external" size={13} /> เปิดใน Discord
            </button>
            <button className="btn ghost">
              <Icon name="edit" size={13} /> แก้ไข XP
            </button>
          </>
        }
      />

      <div className="profile-grid">
        <div className="profile-hero">
          <div className="ph-av">{member.handle.slice(0, 2).toUpperCase()}</div>
          <div className="ph-name">{member.name}</div>
          <div className="ph-handle">@{member.handle}</div>
          <div className="ph-id">id: {member.id}</div>

          <div style={{ marginTop: 14, display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span
              className="pill solid"
              style={{
                color: "var(--accent)",
                background: "var(--accent-soft)",
                border: "1px solid var(--accent-glow)",
              }}
            >
              <Sparkle size={9} /> {member.role}
            </span>
            <span
              className="pill solid"
              style={{
                color: "var(--cyan)",
                background: "rgba(122,224,255,0.06)",
                border: "1px solid rgba(122,224,255,0.18)",
              }}
            >
              <Icon name="flame" size={9} /> {member.streak}d streak
            </span>
          </div>

          <div className="ph-prog">
            <div className="lvl">
              <strong>Lv.{member.level}</strong>
              <span>
                {member.xp.toLocaleString()} / {member.nextXP.toLocaleString()} XP
              </span>
            </div>
            <div className="ph-bar">
              <i style={{ width: ((member.xp / member.nextXP) * 100).toFixed(1) + "%" }} />
            </div>
            <div
              style={{
                marginTop: 6,
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--fg-3)",
              }}
            >
              เหลืออีก {(member.nextXP - member.xp).toLocaleString()} XP สู่ Lv.
              {member.level + 1}
            </div>
          </div>

          <div className="ph-stats">
            <div className="ph-stat">
              <span>Messages</span>
              <strong>{member.msgs.toLocaleString()}</strong>
            </div>
            <div className="ph-stat">
              <span>Voice Time</span>
              <strong>{member.voice}</strong>
            </div>
            <div className="ph-stat">
              <span>Joined</span>
              <strong style={{ fontSize: 11 }}>{member.joined}</strong>
            </div>
            <div className="ph-stat">
              <span>Rank</span>
              <strong>#01</strong>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
          <div className="card">
            <div className="card-head">
              <div className="card-title">
                <span className="dot" />
                Activity Heatmap · 84 days
              </div>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--fg-3)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                less{" "}
                <span style={{ display: "inline-flex", gap: 2, marginLeft: 6 }}>
                  {[0.05, 0.2, 0.4, 0.7, 1].map((a, i) => (
                    <span
                      key={i}
                      style={{
                        width: 10,
                        height: 10,
                        background: `rgba(199,125,255,${a})`,
                        borderRadius: 2,
                        border: "1px solid var(--line-soft)",
                      }}
                    />
                  ))}
                </span>{" "}
                more
              </span>
            </div>
            <div className="card-body">
              <div className="heatmap">
                {heatmap.map((v, i) => (
                  <div
                    key={i}
                    className="hm-day"
                    style={{
                      background:
                        v < 0.1 ? "var(--bg-3)" : `rgba(199,125,255,${0.15 + v * 0.85})`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="activity-grid">
            <div className="card">
              <div className="card-head">
                <div className="card-title">
                  <span className="dot" />
                  Top Channels
                </div>
              </div>
              <div className="card-body">
                {TOP_CHANNELS.map((c) => (
                  <div className="channel-bar" key={c[0]}>
                    <span className="ch-name">{c[0]}</span>
                    <div className="ch-bar">
                      <i style={{ width: c[2] + "%" }} />
                    </div>
                    <span className="ch-val">{c[1].toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-head">
                <div className="card-title">
                  <span className="dot" />
                  Recent Achievements
                </div>
              </div>
              <div
                className="card-body"
                style={{ display: "flex", flexDirection: "column", gap: 8 }}
              >
                {ACHIEVEMENTS.map((a, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 10px",
                      background: "var(--bg-2)",
                      borderRadius: 6,
                      border: "1px solid var(--line-soft)",
                    }}
                  >
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: "var(--accent-soft)",
                        border: "1px solid var(--accent-glow)",
                        color: "var(--accent)",
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <Icon name={a[2]} size={13} />
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{a[0]}</div>
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          color: "var(--fg-3)",
                        }}
                      >
                        {a[1]}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
