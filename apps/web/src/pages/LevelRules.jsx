import { useEffect, useMemo, useState } from "react";
import { Icon, Sparkle } from "../components/Icon.jsx";
import { PageHead } from "../components/PageHead.jsx";
import { Toggle } from "../components/Toggle.jsx";
import { CurveChart } from "../components/CurveChart.jsx";
import { useLevelConfig, saveLevelConfig, resetXp } from "../hooks.js";

const FEATURE_FIELDS = ["textEnabled", "voiceEnabled", "reactionEnabled", "streakEnabled"];

export const LevelRules = () => {
  const { data: serverCfg, reload } = useLevelConfig();
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (serverCfg) setDraft(serverCfg);
  }, [serverCfg]);

  const dirty = useMemo(() => {
    if (!draft || !serverCfg) return false;
    return FEATURE_FIELDS.some((k) => draft[k] !== serverCfg[k]);
  }, [draft, serverCfg]);

  const setFlag = (key, value) => setDraft((d) => ({ ...(d ?? {}), [key]: value }));

  const onSave = async () => {
    if (!draft || !dirty) return;
    setSaving(true);
    try {
      const patch = Object.fromEntries(FEATURE_FIELDS.map((k) => [k, !!draft[k]]));
      await saveLevelConfig(patch);
      setMsg({ kind: "ok", text: "บันทึกการตั้งค่าแล้ว" });
      await reload();
    } catch (e) {
      setMsg({ kind: "err", text: `บันทึกล้มเหลว: ${e.message}` });
    } finally {
      setSaving(false);
    }
  };

  const onResetCfg = () => {
    if (serverCfg) setDraft(serverCfg);
    setMsg(null);
  };

  return (
  <>
    <PageHead
      tag="LEVEL · CONFIG"
      title="XP Rules"
      desc="ตั้งค่าวิธีคำนวณ XP, anti-spam และรางวัลตาม role ที่จะมอบให้ผู้ใช้เมื่อถึงเลเวลที่กำหนด"
      actions={
        <>
          <button className="btn ghost" onClick={() => setResetOpen(true)}>
            <Icon name="refresh" size={13} /> Reset XP คะแนนทั้งเซิร์ฟ
          </button>
          <button className="btn ghost" onClick={onResetCfg} disabled={!dirty}>
            <Icon name="x" size={13} /> ยกเลิก
          </button>
          <button className="btn primary" onClick={onSave} disabled={!dirty || saving}>
            <Icon name="check" size={13} /> {saving ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </>
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

    <div className="rules-grid">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <span className="dot" />
              XP Sources
            </div>
            {!draft && <span className="pill solid offline">กำลังโหลด…</span>}
          </div>
          <div>
            <Toggle
              label="Text Messages"
              desc="ให้ XP เมื่อสมาชิกพิมพ์ข้อความในแชท"
              on={!!draft?.textEnabled}
              onChange={(v) => setFlag("textEnabled", v)}
              val={draft ? `${draft.textMin} — ${draft.textMax} XP` : "—"}
              range="ต่อข้อความ"
            />
            <Toggle
              label="Voice Activity"
              desc="ให้ XP ตามเวลาที่อยู่ในห้องวอยซ์"
              on={!!draft?.voiceEnabled}
              onChange={(v) => setFlag("voiceEnabled", v)}
              val={draft ? `${draft.voicePerMinute} XP` : "—"}
              range="ต่อนาที"
            />
            <Toggle
              label="Reactions"
              desc="ให้ XP เล็กน้อยเมื่อมีคน react ข้อความของผู้ใช้"
              on={!!draft?.reactionEnabled}
              onChange={(v) => setFlag("reactionEnabled", v)}
              val={draft ? `${draft.reactionAmount} XP` : "—"}
              range="ต่อ react ที่ได้รับ"
            />
            <Toggle
              label="Stage / Karaoke"
              desc="โบนัสในห้อง stage (สำหรับ event ของวง)"
              on={(draft?.stageMultiplier ?? 0) > 1}
              val={draft ? `${draft.stageMultiplier}×` : "—"}
              range="multiplier"
            />
            <Toggle
              label="Daily Streak"
              desc="โบนัสรายวันเมื่อ active ต่อเนื่อง"
              on={!!draft?.streakEnabled}
              onChange={(v) => setFlag("streakEnabled", v)}
              val={draft ? `+${draft.streakBonus} XP / day` : "—"}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <span className="dot" />
              Anti-spam · Cooldown
            </div>
          </div>
          <div className="card-body">
            <div className="rule-block">
              <div className="rule-info">
                <h4>Cooldown ระหว่างข้อความ</h4>
                <p>ภายใน N วินาที จะนับ XP เพียง 1 ครั้ง</p>
              </div>
              <div className="rule-input">
                <span className="mono">{draft?.textCooldownSec ?? "—"}s</span>
              </div>
            </div>
            <div className="rule-block">
              <div className="rule-info">
                <h4>ความยาวขั้นต่ำ</h4>
                <p>ข้อความต้องมีอย่างน้อย N ตัวอักษร</p>
              </div>
              <div className="rule-input">
                <span className="mono">≥ {draft?.textMinChars ?? "—"} chars</span>
              </div>
            </div>
            <div className="rule-block">
              <div className="rule-info">
                <h4>ห้องที่ยกเว้น</h4>
                <p>ห้องที่ไม่นับ XP เช่น #spam, #bot-cmd</p>
              </div>
              <div className="rule-input">
                <span className="mono">{draft?.excludedChannels?.length ?? 0} channels</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <span className="dot" />
              Role Rewards
            </div>
            <span className="pill solid offline">เร็วๆ นี้</span>
          </div>
          <div className="card-body" style={{ color: "var(--fg-3)", fontSize: 12 }}>
            จัดการผ่าน API <code>POST /api/level/:guildId/role-rewards</code> ก่อน — UI ยังไม่ได้ wire
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <span className="dot" />
              Level Curve
            </div>
          </div>
          <div className="card-body">
            <div className="formula-card">
              <pre>{`xp_required(level) =
   ${draft?.curveLinear ?? "—"} × level
 + ${draft?.curveQuadratic ?? "—"} × level²`}</pre>
            </div>
            <div style={{ marginTop: 14 }}>
              <CurveChart />
            </div>
          </div>
        </div>
      </div>
    </div>

    {resetOpen && (
      <ResetXpModal
        onClose={() => setResetOpen(false)}
        onDone={(result) => {
          setResetOpen(false);
          setMsg({
            kind: "ok",
            text: `Reset XP สำเร็จ — ลบ ${result.deletedEvents} events / ${result.deletedTotals} users`,
          });
        }}
      />
    )}
  </>
  );
};

const ResetXpModal = ({ onClose, onDone }) => {
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const armed = confirmText === "RESET";

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await resetXp();
      onDone?.(res);
    } catch (e) {
      setError(e.message ?? "reset_failed");
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="draw-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="draw-head">
          <h3 style={{ color: "var(--red)" }}>
            <Icon name="alert" size={14} /> Reset XP คะแนนทั้งเซิร์ฟ
          </h3>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div style={{ padding: 16, display: "grid", gap: 12 }}>
          <div style={{ fontSize: 13, color: "var(--fg-1)", lineHeight: 1.6 }}>
            การทำงานนี้จะ <strong style={{ color: "var(--red)" }}>ลบ XP, level และประวัติทั้งหมด</strong> ของทุกคนในเซิร์ฟ <em>ทันที</em> และ <strong>ไม่สามารถย้อนกลับได้</strong>
          </div>
          <div style={{ fontSize: 12, color: "var(--fg-3)" }}>
            ใช้ก่อนวัน Launch จริงเพื่อล้างข้อมูลทดสอบ — RoleReward / LevelConfig จะไม่กระทบ
          </div>
          <div className="field">
            <label>พิมพ์ <code style={{ color: "var(--red)" }}>RESET</code> เพื่อยืนยัน</label>
            <input
              className="input"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="RESET"
              autoFocus
            />
          </div>
          {error && <div style={{ color: "var(--red)", fontSize: 12 }}>{error}</div>}
          <div className="draw-foot" style={{ paddingTop: 8 }}>
            <button className="btn ghost" onClick={onClose} disabled={submitting}>ยกเลิก</button>
            <button
              className="btn primary"
              onClick={submit}
              disabled={!armed || submitting}
              style={{ background: armed ? "var(--red)" : undefined }}
            >
              <Icon name="alert" size={12} /> {submitting ? "กำลังลบ…" : "Reset ทั้งหมด"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
