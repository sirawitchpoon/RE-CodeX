import { useEffect, useState } from "react";
import { Icon, Sparkle } from "../components/Icon.jsx";
import { PageHead } from "../components/PageHead.jsx";
import { useGiveaways, useGiveawayEntries, publishGiveaway, drawGiveaway, announceGiveaway, createGiveaway } from "../hooks.js";

const STATUS_PILL = {
  LIVE: "live",
  SCHEDULED: "scheduled",
  ENDED: "offline",
};

export const Giveaway = () => {
  const { data: GIVEAWAYS, reload: reloadGiveaways } = useGiveaways();
  const [selectedId, setSelectedId] = useState(null);
  // First load: select the first LIVE one, else first row, else null
  useEffect(() => {
    if (selectedId || !Array.isArray(GIVEAWAYS) || GIVEAWAYS.length === 0) return;
    const live = GIVEAWAYS.find((g) => g.status === "LIVE");
    setSelectedId((live ?? GIVEAWAYS[0]).id);
  }, [GIVEAWAYS, selectedId]);
  const selected = Array.isArray(GIVEAWAYS) ? GIVEAWAYS.find((g) => g.id === selectedId) : null;
  const { data: ENTRIES, reload: reloadEntries } = useGiveawayEntries(selectedId);
  const [drawOpen, setDrawOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [tab, setTab] = useState("entries");
  const [actionMsg, setActionMsg] = useState(null);

  const refresh = async () => { await Promise.all([reloadGiveaways(), reloadEntries()]); };

  const onPublish = async () => {
    if (!selectedId) return;
    try {
      await publishGiveaway(selectedId);
      setActionMsg({ kind: "ok", text: "เผยแพร่ Giveaway แล้ว — บอทกำลังโพสต์ใน Discord" });
      await refresh();
    } catch (e) {
      setActionMsg({ kind: "err", text: `Publish ล้มเหลว: ${e.message}` });
    }
  };

  const onAnnounce = async () => {
    if (!selectedId) return;
    try {
      await announceGiveaway(selectedId);
      setActionMsg({ kind: "ok", text: "ประกาศผู้โชคดีแล้ว" });
      await refresh();
    } catch (e) {
      setActionMsg({ kind: "err", text: `Announce ล้มเหลว: ${e.message}` });
    }
  };

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
            <button className="btn primary" onClick={() => setCreateOpen(true)}>
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
          {actionMsg && (
            <div
              className="card"
              style={{
                padding: "10px 14px",
                fontSize: 13,
                color: actionMsg.kind === "ok" ? "var(--green)" : "var(--red)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span>{actionMsg.text}</span>
              <button className="icon-btn" onClick={() => setActionMsg(null)}>
                <Icon name="x" size={12} />
              </button>
            </div>
          )}
          {selected ? (<>
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
                  {(selected.status === "DRAFT" || selected.status === "SCHEDULED") && (
                    <button className="btn primary btn-sm" onClick={onPublish}>
                      <Icon name="send" size={11} /> Publish
                    </button>
                  )}
                  {selected.status === "LIVE" && (
                    <button className="btn primary btn-sm" onClick={onAnnounce}>
                      <Icon name="send" size={11} /> Announce winners
                    </button>
                  )}
                  <button className="btn ghost btn-sm">
                    <Icon name="edit" size={11} /> แก้ไข
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
                  <button
                    className="btn primary btn-sm"
                    onClick={() => setDrawOpen(true)}
                    disabled={!selected || selected.status === "ENDED"}
                  >
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
          </>) : (
            <div className="card" style={{ padding: 24, color: "var(--fg-2)" }}>
              ยังไม่มี Giveaway — กด "สร้าง Giveaway" เพื่อเริ่มต้น
            </div>
          )}
        </div>
      </div>

      {createOpen && (
        <CreateModal
          onClose={() => setCreateOpen(false)}
          onCreated={async (g) => {
            setCreateOpen(false);
            setActionMsg({ kind: "ok", text: `สร้าง Giveaway "${g.title}" แล้ว (สถานะ DRAFT — กด Publish เพื่อโพสต์ใน Discord)` });
            setSelectedId(g.id);
            await reloadGiveaways();
          }}
        />
      )}

      {drawOpen && (
        <DrawModal
          giveaway={selected}
          totalEntries={ENTRIES.length}
          onClose={() => setDrawOpen(false)}
          onDrawn={async () => {
            setActionMsg({ kind: "ok", text: "สุ่มผู้โชคดีเรียบร้อย" });
            await refresh();
          }}
          onAnnounce={async () => {
            setDrawOpen(false);
            await onAnnounce();
          }}
        />
      )}
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

const CreateModal = ({ onClose, onCreated }) => {
  const [title, setTitle] = useState("");
  const [prize, setPrize] = useState("");
  const [description, setDescription] = useState("");
  const [channelId, setChannelId] = useState("");
  const [requiredRoleId, setRequiredRoleId] = useState("");
  const [minLevel, setMinLevel] = useState(0);
  const [winnersCount, setWinnersCount] = useState(1);
  const [endsAt, setEndsAt] = useState("");
  const [coverFile, setCoverFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !prize.trim() || !channelId.trim()) {
      setError("กรอก Title, Prize และ Channel ID ให้ครบ");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        channelId: channelId.trim(),
        title: title.trim(),
        prize: prize.trim(),
        description: description.trim() || undefined,
        requiredRoleId: requiredRoleId.trim() || null,
        minLevel: Number(minLevel) || 0,
        winnersCount: Number(winnersCount) || 1,
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
      };
      const created = await createGiveaway(payload, coverFile);
      onCreated?.(created);
    } catch (err) {
      setError(err.message ?? "create_failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="draw-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="draw-head">
          <h3><Icon name="plus" size={14} /> สร้าง Giveaway ใหม่</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <form onSubmit={submit} style={{ padding: 16, display: "grid", gap: 12 }}>
          <div className="field">
            <label>Title *</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Birthday Pack — REI" />
          </div>
          <div className="field">
            <label>Prize *</label>
            <input className="input" value={prize} onChange={(e) => setPrize(e.target.value)} placeholder="Limited Cheki Set ×3" />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="รายละเอียดของกิจกรรม" />
          </div>
          <div className="field">
            <label>Channel ID * <span className="hint">(Discord channel ที่จะโพสต์)</span></label>
            <input className="input" value={channelId} onChange={(e) => setChannelId(e.target.value)} placeholder="1234567890123456789" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field">
              <label>Required Role ID</label>
              <input className="input" value={requiredRoleId} onChange={(e) => setRequiredRoleId(e.target.value)} placeholder="(ไม่บังคับ)" />
            </div>
            <div className="field">
              <label>Min Level</label>
              <input className="input" type="number" min="0" value={minLevel} onChange={(e) => setMinLevel(e.target.value)} />
            </div>
            <div className="field">
              <label>Winners Count</label>
              <input className="input" type="number" min="1" value={winnersCount} onChange={(e) => setWinnersCount(e.target.value)} />
            </div>
            <div className="field">
              <label>Ends At</label>
              <input className="input" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Cover Image</label>
            <input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} />
          </div>
          {error && <div style={{ color: "var(--red)", fontSize: 12 }}>{error}</div>}
          <div className="draw-foot" style={{ paddingTop: 8 }}>
            <button type="button" className="btn ghost" onClick={onClose} disabled={submitting}>ยกเลิก</button>
            <button type="submit" className="btn primary" disabled={submitting}>
              <Icon name="plus" size={12} /> {submitting ? "กำลังสร้าง…" : "สร้าง Giveaway"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DrawModal = ({ giveaway, totalEntries, onClose, onDrawn, onAnnounce }) => {
  const [phase, setPhase] = useState("ready");
  const [winners, setWinners] = useState([]);
  const [error, setError] = useState(null);

  const roll = async () => {
    if (!giveaway?.id) return;
    setPhase("rolling");
    setError(null);
    try {
      const res = await drawGiveaway(giveaway.id, giveaway.winnersCount ?? 1);
      const list = Array.isArray(res?.winners) ? res.winners : [];
      setWinners(list);
      setPhase("done");
      onDrawn?.();
    } catch (e) {
      setError(e.message ?? "draw_failed");
      setPhase("ready");
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="draw-modal" onClick={(e) => e.stopPropagation()}>
        <div className="draw-head">
          <h3>
            <Icon name="shuffle" size={14} /> สุ่มผู้โชคดี{" "}
            <span className="tag-mono">{giveaway?.id ?? "—"}</span>
          </h3>
          <button className="icon-btn" onClick={onClose}>
            <Icon name="x" size={14} />
          </button>
        </div>
        <div className={"draw-stage " + (phase === "rolling" ? "draw-rolling" : "")}>
          {phase === "ready" && (
            <div className="winner-card">
              <div className="lab">พร้อมสุ่มจาก {totalEntries} รายชื่อ</div>
              <div className="who" style={{ fontSize: 22, color: "var(--fg-2)" }}>
                กดปุ่ม Roll เพื่อเริ่ม
              </div>
              <div className="why">
                รางวัล: {giveaway?.prize ?? "—"} ({giveaway?.winnersCount ?? 1} ผู้โชคดี)
              </div>
              {error && (
                <div style={{ marginTop: 12, color: "var(--red)", fontSize: 12 }}>
                  {error}
                </div>
              )}
            </div>
          )}
          {phase === "rolling" && (
            <div className="winner-card">
              <div className="lab">กำลังสุ่ม…</div>
              <div className="who" style={{ fontSize: 22, color: "var(--fg-2)" }}>
                กำลังเลือกผู้โชคดี
              </div>
            </div>
          )}
          {phase === "done" && (
            <div className="winner-card">
              <div className="lab">★ ผู้โชคดี ({winners.length})</div>
              {winners.length === 0 ? (
                <div className="who" style={{ fontSize: 16, color: "var(--fg-2)" }}>
                  ไม่มีผู้โชคดี
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {winners.map((w) => (
                    <div key={String(w.id)} className="who">
                      <div className="av">
                        {(w.displayName ?? w.handle ?? "??").slice(0, 2).toUpperCase()}
                      </div>
                      <span>{w.displayName ?? w.userId}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="draw-foot">
          <button className="btn ghost" onClick={onClose}>
            ปิด
          </button>
          {phase === "ready" && (
            <button
              className="btn primary"
              onClick={roll}
              disabled={!giveaway?.id || totalEntries === 0}
            >
              <Icon name="zap" size={12} /> Roll
            </button>
          )}
          {phase === "done" && (
            <button className="btn primary" onClick={onAnnounce}>
              <Icon name="send" size={12} /> ประกาศใน Discord
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
