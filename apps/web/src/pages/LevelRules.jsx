import { Icon, Sparkle } from "../components/Icon.jsx";
import { PageHead } from "../components/PageHead.jsx";
import { Toggle } from "../components/Toggle.jsx";
import { CurveChart } from "../components/CurveChart.jsx";

export const LevelRules = () => (
  <>
    <PageHead
      tag="LEVEL · CONFIG"
      title="XP Rules"
      desc="ตั้งค่าวิธีคำนวณ XP, anti-spam และรางวัลตาม role ที่จะมอบให้ผู้ใช้เมื่อถึงเลเวลที่กำหนด"
      actions={
        <>
          <button className="btn ghost">
            <Icon name="refresh" size={13} /> Reset
          </button>
          <button className="btn primary">
            <Icon name="check" size={13} /> บันทึก
          </button>
        </>
      }
    />

    <div className="rules-grid">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <span className="dot" />
              XP Sources
            </div>
          </div>
          <div>
            <Toggle
              label="Text Messages"
              desc="ให้ XP เมื่อสมาชิกพิมพ์ข้อความในแชท"
              defaultOn
              val="3 — 8 XP"
              range="ต่อข้อความ"
            />
            <Toggle
              label="Voice Activity"
              desc="ให้ XP ตามเวลาที่อยู่ในห้องวอยซ์"
              defaultOn
              val="1 XP"
              range="ต่อนาที"
            />
            <Toggle
              label="Reactions"
              desc="ให้ XP เล็กน้อยเมื่อมีคน react ข้อความของผู้ใช้"
              defaultOn
              val="2 XP"
              range="ต่อ react ที่ได้รับ"
            />
            <Toggle
              label="Stage / Karaoke"
              desc="โบนัสในห้อง stage (สำหรับ event ของวง)"
              defaultOn
              val="3×"
              range="multiplier"
            />
            <Toggle
              label="Daily Streak"
              desc="โบนัสรายวันเมื่อ active ต่อเนื่อง"
              val="+50 XP / day"
            />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <span className="dot" />
              Anti-spam · Cooldown
            </div>
            <span
              className="pill solid"
              style={{
                color: "var(--green)",
                background: "rgba(111,227,154,0.06)",
                border: "1px solid rgba(111,227,154,0.18)",
              }}
            >
              เปิดใช้งาน
            </span>
          </div>
          <div>
            <Toggle
              label="Cooldown ระหว่างข้อความ"
              desc="ภายใน N วินาที จะนับ XP เพียง 1 ครั้ง"
              defaultOn
              val="60s"
            />
            <Toggle
              label="ตรวจจับข้อความซ้ำ"
              desc="ไม่นับ XP สำหรับข้อความที่ซ้ำกับครั้งล่าสุด"
              defaultOn
              val="—"
            />
            <Toggle
              label="ความยาวขั้นต่ำ"
              desc="ข้อความต้องมีอย่างน้อย N ตัวอักษร"
              defaultOn
              val="≥ 4 chars"
            />
            <Toggle
              label="ห้องที่ยกเว้น"
              desc="ห้องที่ไม่นับ XP เช่น #spam, #bot-cmd"
              val="3 channels"
            />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <span className="dot" />
              Role Rewards
            </div>
            <button className="btn ghost btn-sm">
              <Icon name="plus" size={11} /> เพิ่ม
            </button>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <RewardRow lvl="Lv.5" role="Listener" hint="เข้าถึง #fan-art" />
            <RewardRow lvl="Lv.15" role="Member" hint="เข้าร่วม giveaway ทั่วไป" tone="cyan" />
            <RewardRow
              lvl="Lv.30"
              role="Stargazer"
              hint="2× XP, giveaway พิเศษ"
              tone="green"
            />
            <RewardRow lvl="Lv.50" role="Constellation" hint="ห้องเฉพาะ #starlight" />
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
   1000 × level
 + 250 × level²
 + base_offset(0)

# example
Lv. 1 →     1,250 XP
Lv. 10 →   35,000 XP
Lv. 30 →  255,000 XP
Lv. 50 →  675,000 XP`}</pre>
            </div>
            <div style={{ marginTop: 14 }}>
              <CurveChart />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <span className="dot" />
              Preview
            </div>
          </div>
          <div className="card-body">
            <div
              style={{
                fontSize: 11,
                color: "var(--fg-3)",
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              หากผู้ใช้พิมพ์ 50 ข้อความ + อยู่ห้องวอย 30 นาที
            </div>
            <PreviewLine>
              <span className="kw">text_xp</span> = <span className="num">50</span> × ~
              <span className="num">5.5</span> = <span className="num">275</span> XP
            </PreviewLine>
            <PreviewLine>
              <span className="kw">voice_xp</span> = <span className="num">30</span> ×{" "}
              <span className="num">1</span> = <span className="num">30</span> XP
            </PreviewLine>
            <PreviewLine>
              <span className="kw">streak_bonus</span> = <span className="num">50</span> XP
            </PreviewLine>
            <PreviewLine>
              <span className="com">// total</span>
            </PreviewLine>
            <PreviewLine>
              <span className="kw">total</span> = <span className="num">355</span> XP{" "}
              <span className="com">/ session</span>
            </PreviewLine>
          </div>
        </div>
      </div>
    </div>
  </>
);

const PreviewLine = ({ children }) => (
  <div className="code-line">
    <span className="ln">›</span>
    <span>{children}</span>
  </div>
);

const RewardRow = ({ lvl, role, hint, tone }) => (
  <div className={"reward-row" + (tone ? " " + tone : "")}>
    <span className="lvl">{lvl}</span>
    <div>
      <span className="role">
        <Sparkle size={9} /> {role}
      </span>
    </div>
    <div className="hint" style={{ fontSize: 11, color: "var(--fg-3)" }}>
      {hint}
    </div>
    <button className="btn ghost btn-sm">
      <Icon name="more" size={11} />
    </button>
  </div>
);
