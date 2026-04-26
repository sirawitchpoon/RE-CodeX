import { Icon } from "../components/Icon.jsx";
import { PageHead } from "../components/PageHead.jsx";

export const Settings = () => (
  <>
    <PageHead
      tag="SETTINGS"
      title="Bot Settings"
      desc="ตั้งค่าทั่วไปของบอทและการเชื่อมต่อ Discord server"
      actions={
        <button className="btn primary">
          <Icon name="check" size={13} /> บันทึก
        </button>
      }
    />

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--gap)" }}>
      <div className="card">
        <div className="card-head">
          <div className="card-title">
            <span className="dot" />
            Discord Server
          </div>
        </div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Server ID">1192847219384720384</Field>
          <Field label="Server Name">RE:CodeX Official</Field>
          <Field label="Default Channel">#general-chat</Field>
          <Field label="Announcements Channel">#announcements</Field>
          <Field label="Bot Command Channel" hint="ห้องสำหรับให้สมาชิกใช้ปุ่ม/คำสั่งบอท">
            #bot-cmd
          </Field>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">
            <span className="dot" />
            Permissions & Access
          </div>
        </div>
        <div className="card-body">
          <RuleRow label="Admin Roles" desc="Role ที่เข้า backoffice นี้ได้">
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)" }}>
              @admin, @staff
            </span>
          </RuleRow>
          <RuleRow label="Audit Log" desc="บันทึกการแก้ไขทุกการเปลี่ยนแปลง">
            <span className="toggle on">
              <span className="track" />
            </span>
          </RuleRow>
          <RuleRow label="2FA Required" desc="บังคับใช้ 2FA สำหรับ admin ทุกคน">
            <span className="toggle on">
              <span className="track" />
            </span>
          </RuleRow>
          <RuleRow label="Webhook Outputs" desc="ส่ง event ไปยัง endpoint ภายนอก">
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)" }}>
              3 webhooks
            </span>
          </RuleRow>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">
            <span className="dot" />
            Branding
          </div>
        </div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Bot Display Name">RE:CodeX Bot</Field>
          <div className="field">
            <label>Embed Accent</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Swatch color="#c77dff" />
              <Swatch color="#9d4edd" />
              <Swatch color="#7b2cbf" selected />
              <Swatch color="#7ae0ff" />
              <div className="input" style={{ width: 100 }}>
                #7b2cbf
              </div>
            </div>
          </div>
          <div className="field">
            <label>Welcome Banner</label>
            <div className="empty-strip" style={{ height: 64 }} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">
            <span className="dot" />
            System Status
          </div>
          <span className="pill online">healthy</span>
        </div>
        <div className="card-body">
          <div className="health-list">
            <SysRow name="discord.api" pct={12} val="42ms" />
            <SysRow name="db.primary" pct={24} val="8ms" color="var(--cyan)" />
            <SysRow name="cache" pct={6} val="2ms" color="var(--green)" />
            <SysRow name="queue.worker" pct={18} val="12 jobs" color="var(--accent)" />
          </div>
          <div
            style={{
              marginTop: 14,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--fg-3)",
            }}
          >
            <div>
              last deploy:{" "}
              <span style={{ color: "var(--fg-1)" }}>2026-04-24 11:08 UTC+7</span>
            </div>
            <div>
              build: <span style={{ color: "var(--fg-1)" }}>v3.2.1-rcx · sha 8a47d2f</span>
            </div>
            <div>
              uptime: <span style={{ color: "var(--green)" }}>32d 14h 22m</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </>
);

const Field = ({ label, hint, children }) => (
  <div className="field">
    <label>{label}</label>
    <div className="input">{children}</div>
    {hint && <div className="hint">{hint}</div>}
  </div>
);

const RuleRow = ({ label, desc, children }) => (
  <div className="rule-block">
    <div className="rule-info">
      <h4>{label}</h4>
      <p>{desc}</p>
    </div>
    <div className="rule-input">{children}</div>
  </div>
);

const Swatch = ({ color, selected }) => (
  <span
    style={{
      width: 24,
      height: 24,
      background: color,
      borderRadius: 4,
      border: "1px solid var(--line)",
      ...(selected ? { outline: "2px solid var(--accent)", outlineOffset: 2 } : null),
    }}
  />
);

const SysRow = ({ name, pct, val, color }) => (
  <div className="health-row">
    <div className="health-name">{name}</div>
    <div className="health-bar">
      <i style={{ width: pct + "%", background: color }} />
    </div>
    <div className="health-val">{val}</div>
  </div>
);
