// Per-guild cast-member admin. The bot's main-pick flow reads this list,
// shows one button per row in the giveaway entry ephemeral, and assigns the
// member's roleId when a user picks them.
//
// Mutations publish `giveaway.members.changed` so the bot's TTL cache
// invalidates immediately rather than waiting up to 60s.

import { useEffect, useMemo, useState } from "react";
import { Icon } from "../components/Icon.jsx";
import { PageHead } from "../components/PageHead.jsx";
import {
  useGiveawayMembers,
  createGwMember,
  updateGwMember,
  deleteGwMember,
} from "../hooks.js";

const DEFAULT_ACCENT = "#c77dff";

export const GiveawayMembers = () => {
  const { data, reload } = useGiveawayMembers();
  const rows = Array.isArray(data) ? data : [];
  const [editing, setEditing] = useState(null); // null | "new" | <id>
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [rows],
  );

  const startNew = () => {
    setDraft({
      id: null,
      name: "",
      roleId: "",
      sortOrder: rows.length,
      accentColor: DEFAULT_ACCENT,
      emoji: "",
    });
    setEditing("new");
  };

  const startEdit = (m) => {
    setDraft({
      id: m.id,
      name: m.name ?? "",
      roleId: m.roleId ?? "",
      sortOrder: m.sortOrder ?? 0,
      accentColor: m.accentColor ?? DEFAULT_ACCENT,
      emoji: m.emoji ?? "",
    });
    setEditing(m.id);
  };

  const cancel = () => {
    setEditing(null);
    setDraft(null);
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim() || !draft.roleId.trim()) {
      setMsg({ kind: "err", text: "Name และ Role ID ห้ามว่าง" });
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: draft.name.trim(),
        roleId: draft.roleId.trim(),
        sortOrder: Number(draft.sortOrder) || 0,
        accentColor: draft.accentColor || null,
        emoji: draft.emoji.trim() || null,
      };
      if (editing === "new") {
        await createGwMember(payload);
        setMsg({ kind: "ok", text: `เพิ่มเมน "${payload.name}" แล้ว` });
      } else {
        await updateGwMember(editing, payload);
        setMsg({ kind: "ok", text: `อัปเดตเมน "${payload.name}" แล้ว` });
      }
      cancel();
      await reload();
    } catch (e) {
      setMsg({ kind: "err", text: `บันทึกล้มเหลว: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (m) => {
    setBusy(true);
    try {
      await deleteGwMember(m.id);
      setMsg({ kind: "ok", text: `ลบเมน "${m.name}" แล้ว` });
      setConfirmDelete(null);
      await reload();
    } catch (e) {
      const text = /in_use/.test(e.message)
        ? `ลบไม่ได้ — ยังมีผู้ใช้ที่เลือกเมนนี้อยู่ (${e.message})`
        : `ลบล้มเหลว: ${e.message}`;
      setMsg({ kind: "err", text });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead
        tag="GIVEAWAY · MEMBERS"
        title="Cast Members"
        desc="รายชื่อเมน 6 คนที่ผู้ใช้เลือกได้ตอนกดเข้าร่วม Giveaway — ปุ่ม + Discord role + สี"
        actions={
          <button className="btn primary" onClick={startNew} disabled={busy || editing}>
            <Icon name="plus" size={13} /> เพิ่มเมน
          </button>
        }
      />

      {msg && (
        <div
          className="card"
          style={{
            padding: "10px 14px",
            fontSize: 13,
            color: msg.kind === "ok" ? "var(--green)" : "var(--red)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: "var(--gap)",
          }}
        >
          <span>{msg.text}</span>
          <button className="icon-btn" onClick={() => setMsg(null)}>
            <Icon name="x" size={12} />
          </button>
        </div>
      )}

      <div
        className="card"
        style={{
          padding: "10px 14px",
          fontSize: 12,
          color: "var(--fg-2)",
          marginBottom: "var(--gap)",
          background: "rgba(255,193,7,0.04)",
          border: "1px solid rgba(255,193,7,0.18)",
        }}
      >
        <Icon name="alert" size={11} /> บอท giveaway ต้องมีสิทธิ์ <code>Manage Roles</code> และ
        role ของบอทต้องอยู่เหนือ role ของเมนทุกตัวใน server settings
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="tbl entries-tbl">
          <thead>
            <tr>
              <th style={{ width: 60 }}>Order</th>
              <th>Name</th>
              <th>Role ID</th>
              <th style={{ width: 90 }}>Emoji</th>
              <th style={{ width: 110 }}>Accent</th>
              <th style={{ width: 120 }}></th>
            </tr>
          </thead>
          <tbody>
            {editing === "new" && draft && (
              <MemberEditRow
                draft={draft}
                setDraft={setDraft}
                onSave={save}
                onCancel={cancel}
                busy={busy}
              />
            )}
            {sorted.length === 0 && editing !== "new" && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--fg-3)" }}>
                  ยังไม่มีเมน — กด "เพิ่มเมน" เพื่อเริ่มต้น (แนะนำ 6 คน)
                </td>
              </tr>
            )}
            {sorted.map((m) =>
              editing === m.id && draft ? (
                <MemberEditRow
                  key={m.id}
                  draft={draft}
                  setDraft={setDraft}
                  onSave={save}
                  onCancel={cancel}
                  busy={busy}
                />
              ) : (
                <tr key={m.id}>
                  <td className="mono dim">{m.sortOrder ?? 0}</td>
                  <td>
                    <span
                      style={{
                        display: "inline-block",
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: m.accentColor ?? DEFAULT_ACCENT,
                        marginRight: 8,
                        verticalAlign: "middle",
                      }}
                    />
                    <strong>{m.name}</strong>
                  </td>
                  <td className="mono dim">{m.roleId}</td>
                  <td style={{ fontSize: 16 }}>{m.emoji ?? "—"}</td>
                  <td className="mono dim">{m.accentColor ?? "—"}</td>
                  <td>
                    <button
                      className="btn ghost btn-sm"
                      onClick={() => startEdit(m)}
                      disabled={busy || !!editing}
                    >
                      <Icon name="edit" size={11} />
                    </button>
                    <button
                      className="btn ghost btn-sm"
                      onClick={() => setConfirmDelete(m)}
                      disabled={busy || !!editing}
                      style={{ marginLeft: 4, color: "var(--red)" }}
                    >
                      <Icon name="x" size={11} />
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      {confirmDelete && (
        <div className="modal-backdrop" onClick={() => setConfirmDelete(null)}>
          <div
            className="draw-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 420 }}
          >
            <div className="draw-head">
              <h3>
                <Icon name="x" size={14} /> ลบเมน
              </h3>
              <button className="icon-btn" onClick={() => setConfirmDelete(null)}>
                <Icon name="x" size={14} />
              </button>
            </div>
            <div style={{ padding: 16, fontSize: 13 }}>
              ยืนยันลบเมน <strong>{confirmDelete.name}</strong>?<br />
              <span style={{ fontSize: 12, color: "var(--fg-3)" }}>
                ถ้ามีผู้ใช้เลือกเมนนี้อยู่ระบบจะปฏิเสธคำขอ — ต้องให้ผู้ใช้เปลี่ยนเมนก่อน
              </span>
            </div>
            <div className="draw-foot">
              <button className="btn ghost" onClick={() => setConfirmDelete(null)} disabled={busy}>
                ยกเลิก
              </button>
              <button
                className="btn primary"
                style={{ background: "var(--red)", borderColor: "var(--red)" }}
                onClick={() => handleDelete(confirmDelete)}
                disabled={busy}
              >
                {busy ? "กำลังลบ…" : "ยืนยันลบ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const MemberEditRow = ({ draft, setDraft, onSave, onCancel, busy }) => {
  const set = (k) => (e) =>
    setDraft((d) => ({ ...(d ?? {}), [k]: e.target.value }));
  return (
    <tr style={{ background: "var(--accent-soft)" }}>
      <td>
        <input
          className="input"
          type="number"
          min="0"
          value={draft.sortOrder}
          onChange={set("sortOrder")}
          style={{ width: 50, padding: "4px 6px" }}
        />
      </td>
      <td>
        <input
          className="input"
          value={draft.name}
          onChange={set("name")}
          placeholder="AL"
          style={{ padding: "4px 8px" }}
        />
      </td>
      <td>
        <input
          className="input mono"
          value={draft.roleId}
          onChange={set("roleId")}
          placeholder="1234567890123456789"
          style={{ padding: "4px 8px", fontSize: 12 }}
        />
      </td>
      <td>
        <input
          className="input"
          value={draft.emoji}
          onChange={set("emoji")}
          placeholder="💎"
          style={{ width: 60, padding: "4px 6px" }}
        />
      </td>
      <td>
        <input
          className="input mono"
          value={draft.accentColor}
          onChange={set("accentColor")}
          placeholder="#c77dff"
          style={{ width: 90, padding: "4px 6px", fontSize: 11 }}
        />
      </td>
      <td>
        <button
          className="btn primary btn-sm"
          onClick={onSave}
          disabled={busy}
        >
          <Icon name="check" size={11} />
        </button>
        <button
          className="btn ghost btn-sm"
          onClick={onCancel}
          disabled={busy}
          style={{ marginLeft: 4 }}
        >
          <Icon name="x" size={11} />
        </button>
      </td>
    </tr>
  );
};
