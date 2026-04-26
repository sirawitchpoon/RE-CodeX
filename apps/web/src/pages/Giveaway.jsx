import { useEffect, useState } from "react";
import { Icon, Sparkle } from "../components/Icon.jsx";
import { PageHead } from "../components/PageHead.jsx";
import { GIVEAWAYS, ENTRIES } from "../data.js";

const STATUS_PILL = {
  LIVE: "live",
  SCHEDULED: "scheduled",
  ENDED: "offline",
};

export const Giveaway = () => {
  const [selectedId, setSelectedId] = useState("gw_0042");
  const selected = GIVEAWAYS.find((g) => g.id === selectedId);
  const [drawOpen, setDrawOpen] = useState(false);
  const [tab, setTab] = useState("entries");

  return (
    <>
      <PageHead
        tag="GIVEAWAY"
        title="Giveaway Bot"
        desc="จัดการกิจกรรมแจกของรางวัล รวมรายชื่อผู้สมัครจาก modal และสุ่มผู้โชคดี"
        actions={
          <>
            <button className="btn ghost">
              <Icon name="calendar" size={13} /> History
            </button>
            <button className="btn primary">
              <Icon name="plus" size={13} /> สร้าง Giveaway
            </button>
          </>
        }
      />

      <div className="gw-detail-grid">
        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <span className="dot" />
              Campaigns
            </div>
            <span className="pill solid live">
              {GIVEAWAYS.filter((g) => g.status === "LIVE").length} active
            </span>
          </div>
          <div className="card-body">
            <div className="gw-list">
              {GIVEAWAYS.map((g) => (
                <div
                  key={g.id}
                  className={"gw-card" + (g.id === selectedId ? " active" : "")}
                  onClick={() => setSelectedId(g.id)}
                >
                  <div className="gw-cover" style={{ background: g.cover }}>
                    <Sparkle
                      size={14}
                      color="rgba(255,255,255,0.6)"
                      style={{ position: "absolute", top: 6, left: 6 }}
                    />
                  </div>
                  <div className="gw-meta">
                    <div className="gw-title">{g.title}</div>
                    <div className="gw-id">
                      {g.id} · {g.entries} entries
                    </div>
                    <div className="gw-stats">
                      <span className={"pill " + STATUS_PILL[g.status]}>{g.status}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
          <div className="card hero-card">
            <div className="hero-cover" style={{ background: selected.cover }}>
              <svg className="sparkles" viewBox="0 0 400 88" preserveAspectRatio="none">
                <g fill="rgba(255,255,255,0.7)">
                  <path d="M40 20 41 30 50 31 41 32 40 42 39 32 30 31 39 30Z" />
                  <path d="M340 50 341 56 348 57 341 58 340 64 339 58 332 57 339 56Z" opacity="0.6" />
                  <path d="M180 64 181 72 190 73 181 74 180 82 179 74 170 73 179 72Z" opacity="0.5" />
                </g>
              </svg>
            </div>
            <div className="hero-body">
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div>
                  <h2 className="hero-title">{selected.title}</h2>
                  <div className="hero-prize">
                    รางวัล: <strong style={{ color: "var(--fg-0)" }}>{selected.prize}</strong>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn ghost btn-sm">
                    <Icon name="edit" size={11} /> แก้ไข
                  </button>
                  <button className="btn ghost btn-sm">
                    <Icon name="copy" size={11} /> Duplicate
                  </button>
                  <button className="btn ghost btn-sm danger">
                    <Icon name="x" size={11} /> ปิดกิจกรรม
                  </button>
                </div>
              </div>

              <div className="meta-grid">
                <MetaItem label="Status">
                  <span className={"pill " + STATUS_PILL[selected.status]}>{selected.status}</span>
                </MetaItem>
                <MetaItem label="Ends">{selected.ends}</MetaItem>
                <MetaItem label="Total Entries">{selected.entries}</MetaItem>
                <MetaItem label="Winners">{selected.winners} คน</MetaItem>
                <MetaItem label="Required Role">{selected.role}</MetaItem>
                <MetaItem label="Min Level">Lv.{selected.level}+</MetaItem>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div className="tabs">
              <TabBtn name="entries" cur={tab} onClick={setTab} count={ENTRIES.length}>
                Entries
              </TabBtn>
              <TabBtn
                name="winners"
                cur={tab}
                onClick={setTab}
                count={ENTRIES.filter((e) => e[8]).length}
              >
                Winners
              </TabBtn>
              <TabBtn name="modal" cur={tab} onClick={setTab}>
                Modal Schema
              </TabBtn>
              <TabBtn name="rules" cur={tab} onClick={setTab}>
                Rules
              </TabBtn>
            </div>

            {(tab === "entries" || tab === "winners") && (
              <>
                <div className="toolbar">
                  <div className="search" style={{ minWidth: 200, flex: "0 1 240px" }}>
                    <Icon name="search" size={12} />
                    <span style={{ flex: 1 }}>ค้นหาในรายชื่อ…</span>
                  </div>
                  <button className="btn ghost btn-sm">
                    <Icon name="filter" size={11} /> Filter
                  </button>
                  <div className="grow" />
                  <button className="btn ghost btn-sm">
                    <Icon name="download" size={11} /> Export CSV
                  </button>
                  <button className="btn primary btn-sm" onClick={() => setDrawOpen(true)}>
                    <Icon name="shuffle" size={11} /> สุ่มผู้โชคดี
                  </button>
                </div>
                <div style={{ maxHeight: 300, overflow: "auto" }} className="scrollbar-thin">
                  <table className="tbl entries-tbl">
                    <thead>
                      <tr>
                        <th style={{ width: 50 }}>#</th>
                        <th>Member</th>
                        <th>Platform</th>
                        <th>Handle</th>
                        <th>Level</th>
                        <th>Role</th>
                        <th>Entered</th>
                        <th style={{ width: 50 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {ENTRIES.filter((e) => (tab === "winners" ? e[8] : true)).map((e, i) => (
                        <tr key={i} className={"e-row" + (e[8] ? " win" : "")}>
                          <td className="mono dim">{e[0]}</td>
                          <td>
                            <span className="e-avatar">{e[1].slice(0, 2).toUpperCase()}</span>
                            <span className="e-name">{e[2]}</span>
                            <div style={{ paddingLeft: 32 }} className="e-handle">
                              @{e[1]}
                            </div>
                          </td>
                          <td>{e[3]}</td>
                          <td className="mono">{e[4]}</td>
                          <td className="mono">{e[5]}</td>
                          <td>
                            {e[6] === "—" ? (
                              <span className="dim">—</span>
                            ) : (
                              <span
                                className="pill solid"
                                style={{
                                  color: e[6] === "Stargazer" ? "var(--accent)" : "var(--cyan)",
                                  background:
                                    e[6] === "Stargazer"
                                      ? "var(--accent-soft)"
                                      : "rgba(122,224,255,0.06)",
                                  border:
                                    "1px solid " +
                                    (e[6] === "Stargazer"
                                      ? "var(--accent-glow)"
                                      : "rgba(122,224,255,0.18)"),
                                }}
                              >
                                {e[6]}
                              </span>
                            )}
                          </td>
                          <td className="mono dim">{e[7]}</td>
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
            )}

            {tab === "modal" && (
              <div
                style={{
                  padding: 16,
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--fg-1)",
                }}
              >
                <CodeLine n={1}>
                  <span className="com">// Modal ที่ผู้ใช้เห็นเมื่อกดปุ่ม "เข้าร่วม Giveaway"</span>
                </CodeLine>
                <CodeLine n={2}>
                  <span className="kw">modal</span> <span className="str">"Birthday Pack — REI"</span> {"{"}
                </CodeLine>
                <CodeLine n={3}>
                  {"  "}
                  <span className="kw">field</span>{" "}
                  <span className="str">"ชื่อในวง / Display Name"</span>{" "}
                  <span className="num">required</span> max=<span className="num">32</span>
                </CodeLine>
                <CodeLine n={4}>
                  {"  "}
                  <span className="kw">field</span>{" "}
                  <span className="str">"Platform หลัก"</span>{" "}
                  <span className="kw">select</span> [
                  <span className="str">"Twitter"</span>,
                  <span className="str">"Bluesky"</span>,
                  <span className="str">"Pixiv"</span>]
                </CodeLine>
                <CodeLine n={5}>
                  {"  "}
                  <span className="kw">field</span>{" "}
                  <span className="str">"Platform Handle"</span> placeholder=
                  <span className="str">"@yourname"</span>
                </CodeLine>
                <CodeLine n={6}>
                  {"  "}
                  <span className="kw">field</span>{" "}
                  <span className="str">"ข้อความถึงเมมเบอร์"</span>{" "}
                  <span className="kw">paragraph</span> max=<span className="num">300</span>
                </CodeLine>
                <CodeLine n={7}>{"}"}</CodeLine>
              </div>
            )}

            {tab === "rules" && (
              <div
                className="card-body"
                style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
              >
                <div className="field">
                  <label>Required Role</label>
                  <div className="input">@Stargazer</div>
                  <div className="hint">เฉพาะคนที่มี role นี้เท่านั้นจะเข้าร่วมได้</div>
                </div>
                <div className="field">
                  <label>Min Level</label>
                  <div className="input">Lv.5</div>
                  <div className="hint">ต้องมีระดับ XP จาก RX.Level อย่างน้อย</div>
                </div>
                <div className="field">
                  <label>One Entry Per</label>
                  <div className="input">User</div>
                </div>
                <div className="field">
                  <label>Auto-draw</label>
                  <div className="input">เปิดใช้งาน — สุ่มเมื่อหมดเวลา</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {drawOpen && <DrawModal onClose={() => setDrawOpen(false)} />}
    </>
  );
};

const TabBtn = ({ name, cur, onClick, count, children }) => (
  <button className={"tab-btn" + (cur === name ? " active" : "")} onClick={() => onClick(name)}>
    {children}
    {count !== undefined && <span className="count">{count}</span>}
  </button>
);

const MetaItem = ({ label, children }) => (
  <div className="meta-item">
    <span className="lab">{label}</span>
    <span className="val">{children}</span>
  </div>
);

const CodeLine = ({ n, children }) => (
  <div className="code-line">
    <span className="ln">{n}</span>
    <span>{children}</span>
  </div>
);

const DrawModal = ({ onClose }) => {
  const [phase, setPhase] = useState("ready");
  const [name, setName] = useState(["—", "—"]);
  const pool = ENTRIES.map((e) => [e[2], e[1]]);

  useEffect(() => {
    if (phase !== "rolling") return;
    let i = 0;
    const id = setInterval(() => {
      setName(pool[i % pool.length]);
      i++;
    }, 80);
    const stop = setTimeout(() => {
      clearInterval(id);
      setName(["Kazuki Asahina", "kazuki_v"]);
      setPhase("done");
    }, 2400);
    return () => {
      clearInterval(id);
      clearTimeout(stop);
    };
  }, [phase]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="draw-modal" onClick={(e) => e.stopPropagation()}>
        <div className="draw-head">
          <h3>
            <Icon name="shuffle" size={14} /> สุ่มผู้โชคดี{" "}
            <span className="tag-mono">gw_0042</span>
          </h3>
          <button className="icon-btn" onClick={onClose}>
            <Icon name="x" size={14} />
          </button>
        </div>
        <div className={"draw-stage " + (phase === "rolling" ? "draw-rolling" : "")}>
          {phase === "ready" && (
            <div className="winner-card">
              <div className="lab">พร้อมสุ่มจาก 284 รายชื่อ</div>
              <div className="who" style={{ fontSize: 22, color: "var(--fg-2)" }}>
                กดปุ่ม Roll เพื่อเริ่ม
              </div>
              <div className="why">รางวัล: Limited Cheki Set ×3 (3 ผู้โชคดี)</div>
            </div>
          )}
          {phase !== "ready" && (
            <div className="winner-card">
              <div className="lab">{phase === "rolling" ? "กำลังสุ่ม…" : "★ ผู้โชคดี"}</div>
              <div className="who">
                <div className="av">{(name[1] || "??").slice(0, 2).toUpperCase()}</div>
                <span>{name[0]}</span>
              </div>
              <div className="why">@{name[1]} · entry #001</div>
            </div>
          )}
        </div>
        <div className="draw-foot">
          <button className="btn ghost" onClick={onClose}>
            ปิด
          </button>
          {phase === "ready" && (
            <button className="btn primary" onClick={() => setPhase("rolling")}>
              <Icon name="zap" size={12} /> Roll
            </button>
          )}
          {phase === "done" && (
            <>
              <button className="btn ghost" onClick={() => setPhase("rolling")}>
                <Icon name="refresh" size={12} /> สุ่มใหม่
              </button>
              <button className="btn primary">
                <Icon name="send" size={12} /> ประกาศใน Discord
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
