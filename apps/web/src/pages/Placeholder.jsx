import { Icon } from "../components/Icon.jsx";
import { PageHead } from "../components/PageHead.jsx";

export const Placeholder = ({ tag, title, desc, icon }) => (
  <>
    <PageHead tag={tag} title={title} desc={desc} />
    <div className="card">
      <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center", padding: "60px 20px", textAlign: "center" }}>
        <span
          style={{
            width: 56,
            height: 56,
            borderRadius: 12,
            background: "var(--accent-soft)",
            border: "1px solid var(--accent-glow)",
            color: "var(--accent)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <Icon name={icon || "bot"} size={26} />
        </span>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Module ยังไม่เปิดใช้งาน</div>
        <div style={{ fontSize: 12, color: "var(--fg-3)", maxWidth: 360 }}>
          หน้านี้สำหรับ <code style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>{tag}</code> ยังอยู่ระหว่างการเตรียม config — ดูรายละเอียดบน Dashboard ก่อนได้
        </div>
      </div>
    </div>
  </>
);
