import { Icon, Sparkle } from "../components/Icon.jsx";
import { PageHead } from "../components/PageHead.jsx";

export const DiscordMockup = () => (
  <>
    <PageHead
      tag="DISCORD · MOCKUP"
      title="Bot UX Preview"
      desc="หน้าตาที่ผู้ใช้จะเห็นใน Discord — ปุ่มแทนการพิมพ์คำสั่ง"
    />

    <div className="dc-mockup-grid">
      <div className="card dc-stage">
        <div className="card-head" style={{ background: "var(--bg-1)" }}>
          <div className="card-title">
            <span className="dot" />
            RX.Giveaway · Entry Modal Flow
          </div>
          <span className="pill live">interactive</span>
        </div>
        <div className="discord">
          <div className="dc-frame" style={{ position: "relative" }}>
            <div className="dc-srv">
              <div className="dc-srv-icon active" style={{ position: "relative" }}>
                <Sparkle size={16} color="#fff" />
                <span
                  style={{
                    position: "absolute",
                    left: -12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 4,
                    height: 24,
                    background: "white",
                    borderRadius: "0 4px 4px 0",
                  }}
                />
              </div>
              <div className="dc-srv-divider" />
              <div className="dc-srv-icon">JP</div>
              <div className="dc-srv-icon">+</div>
            </div>
            <div className="dc-chan">
              <div className="dc-chan-head">
                RE:CodeX <Icon name="chevDown" size={14} />
              </div>
              <div style={{ flex: 1, overflow: "auto" }}>
                <div className="dc-chan-cat">
                  <Icon name="chevDown" size={9} /> EVENTS
                </div>
                <div className="dc-chan-item active">
                  <span className="h">#</span>giveaway
                </div>
                <div className="dc-chan-item">
                  <span className="h">#</span>announcements
                </div>
                <div className="dc-chan-cat">
                  <Icon name="chevDown" size={9} /> GENERAL
                </div>
                <div className="dc-chan-item">
                  <span className="h">#</span>general-chat
                </div>
                <div className="dc-chan-item">
                  <span className="h">#</span>fan-art
                </div>
                <div className="dc-chan-item">
                  <span className="h">#</span>bot-cmd
                </div>
              </div>
            </div>
            <div className="dc-main">
              <div className="dc-main-head">
                <span className="h">#</span>
                <strong>giveaway</strong>
              </div>
              <div className="dc-main-body">
                <div className="dc-msg">
                  <div
                    className="dc-msg-av"
                    style={{
                      background: "linear-gradient(135deg, #c77dff, #7b2cbf)",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <Sparkle size={18} color="#fff" />
                  </div>
                  <div className="dc-msg-body">
                    <div className="dc-msg-head">
                      <strong>RX.Giveaway</strong>
                      <span className="badge-bot">
                        <Icon name="check" size={8} /> APP
                      </span>
                      <span className="ts">วันนี้ เวลา 14:00</span>
                    </div>
                    <div className="dc-embed">
                      <div className="dc-embed-author">
                        <Sparkle size={11} color="#c77dff" /> NEW GIVEAWAY · gw_0042
                      </div>
                      <div className="dc-embed-title">★ Birthday Pack — REI ★</div>
                      <div className="dc-embed-desc">
                        ฉลองวันเกิดเมมเบอร์ REI! ร่วมลุ้นรับ{" "}
                        <strong style={{ color: "white" }}>Limited Cheki Set ×3</strong>{" "}
                        โดยกดปุ่มด้านล่างและกรอกข้อมูลในแบบฟอร์ม
                      </div>
                      <div className="dc-embed-fields">
                        <div className="dc-embed-field">
                          <span>★ ผู้โชคดี</span>
                          <strong>3 คน</strong>
                        </div>
                        <div className="dc-embed-field">
                          <span>⏰ สิ้นสุด</span>
                          <strong>2 วัน 6 ชม.</strong>
                        </div>
                        <div className="dc-embed-field">
                          <span>🎯 เงื่อนไข</span>
                          <strong>Lv.5+ / Stargazer</strong>
                        </div>
                      </div>
                      <div className="dc-button-row">
                        <button className="dc-btn special">
                          <Sparkle size={12} color="#fff" /> เข้าร่วม Giveaway
                        </button>
                        <button className="dc-btn secondary">ดูรายชื่อ (284)</button>
                      </div>
                      <div className="dc-embed-foot">
                        RE:CodeX Official · ดึงข้อมูลโดย RX.Giveaway v2.4.1
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="dc-modal-overlay">
              <div className="dc-modal">
                <div className="dc-modal-head">
                  <h3>★ Birthday Pack — REI</h3>
                  <p>กรอกข้อมูลเพื่อเข้าร่วมกิจกรรม</p>
                </div>
                <div className="dc-modal-body">
                  <div className="dc-modal-field">
                    <label>
                      ชื่อในวง / DISPLAY NAME <span className="req">*</span>
                    </label>
                    <input defaultValue="Kazuki" />
                  </div>
                  <div className="dc-modal-field">
                    <label>
                      PLATFORM หลัก <span className="req">*</span>
                    </label>
                    <select defaultValue="Twitter">
                      <option>Twitter</option>
                      <option>Bluesky</option>
                      <option>Pixiv</option>
                    </select>
                  </div>
                  <div className="dc-modal-field">
                    <label>PLATFORM HANDLE</label>
                    <input placeholder="@yourname" defaultValue="@kazuki_v" />
                    <div className="hint">ใช้ติดต่อกรณีได้รับรางวัล</div>
                  </div>
                  <div className="dc-modal-field">
                    <label>ข้อความถึงเมมเบอร์</label>
                    <textarea
                      placeholder="(optional)"
                      defaultValue="สุขสันต์วันเกิด REI ครับ! รักวงมากๆ"
                    />
                  </div>
                </div>
                <div className="dc-modal-foot">
                  <button className="dc-btn secondary">ยกเลิก</button>
                  <button className="dc-btn success">ส่ง</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card dc-stage">
        <div className="card-head" style={{ background: "var(--bg-1)" }}>
          <div className="card-title">
            <span className="dot" />
            RX.Level · /rank Card
          </div>
          <span
            className="pill solid"
            style={{
              color: "var(--cyan)",
              background: "rgba(122,224,255,0.06)",
              border: "1px solid rgba(122,224,255,0.18)",
            }}
          >
            embed
          </span>
        </div>
        <div className="discord">
          <div style={{ padding: "20px 18px" }}>
            <div className="dc-msg" style={{ marginBottom: 16 }}>
              <div
                className="dc-msg-av"
                style={{
                  background: "linear-gradient(135deg,#c77dff,#7b2cbf)",
                  display: "grid",
                  placeItems: "center",
                  color: "#fff",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                KZ
              </div>
              <div className="dc-msg-body">
                <div className="dc-msg-head">
                  <strong>kazuki_v</strong>
                  <span className="ts">วันนี้ เวลา 14:30</span>
                </div>
                <div
                  className="dc-msg-text"
                  style={{
                    color: "var(--d-text-muted)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                  }}
                >
                  กดปุ่ม{" "}
                  <span
                    style={{
                      background: "rgba(199,125,255,0.15)",
                      color: "#c77dff",
                      padding: "1px 6px",
                      borderRadius: 3,
                    }}
                  >
                    ★ My Rank
                  </span>{" "}
                  ใน #bot-cmd
                </div>
              </div>
            </div>

            <div className="dc-msg">
              <div
                className="dc-msg-av"
                style={{
                  background: "linear-gradient(135deg, #7ae0ff, #4a90e2)",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Icon name="trophy" size={16} color="#fff" />
              </div>
              <div className="dc-msg-body" style={{ flex: 1 }}>
                <div className="dc-msg-head">
                  <strong>RX.Level</strong>
                  <span className="badge-bot">
                    <Icon name="check" size={8} /> APP
                  </span>
                  <span className="ts">วันนี้ เวลา 14:30</span>
                </div>
                <div
                  className="rank-card-wrap"
                  style={{ padding: 0, marginTop: 6, background: "transparent" }}
                >
                  <div className="rank-card">
                    <svg
                      className="rank-card-stars"
                      viewBox="0 0 400 200"
                      preserveAspectRatio="none"
                    >
                      <g fill="rgba(255,255,255,0.5)">
                        <path d="M50 30 51 38 58 39 51 40 50 48 49 40 42 39 49 38Z" />
                        <path
                          d="M340 60 341 66 348 67 341 68 340 74 339 68 332 67 339 66Z"
                          opacity="0.5"
                        />
                        <path
                          d="M280 150 281 156 288 157 281 158 280 164 279 158 272 157 279 156Z"
                          opacity="0.7"
                        />
                        <path
                          d="M120 160 120.5 164 124 164.5 120.5 165 120 168 119.5 165 116 164.5 119.5 164Z"
                          opacity="0.4"
                        />
                      </g>
                    </svg>
                    <div className="rank-card-row">
                      <div className="rank-av">KZ</div>
                      <div className="rank-meta">
                        <div className="rank-name">
                          Kazuki Asahina{" "}
                          <span
                            className="pill solid"
                            style={{
                              color: "#c77dff",
                              background: "rgba(199,125,255,0.12)",
                              border: "1px solid rgba(199,125,255,0.3)",
                              fontSize: 9,
                            }}
                          >
                            <Sparkle size={8} /> STARGAZER
                          </span>
                        </div>
                        <div className="rank-handle">@kazuki_v · #1 of 1,243</div>
                        <div className="rank-stats-row">
                          <div className="rank-stat accent">
                            LEVEL <strong>62</strong>
                          </div>
                          <div className="rank-stat">
                            XP <strong>184,230</strong>
                          </div>
                          <div className="rank-stat">
                            MSG <strong>4,204</strong>
                          </div>
                          <div className="rank-stat">
                            STREAK <strong>42d</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="rank-progress">
                      <div className="rank-progress-head">
                        <span>Lv.62 → Lv.63</span>
                        <span>184,230 / 225,000 XP</span>
                      </div>
                      <div className="rank-bar">
                        <i style={{ width: "82%" }} />
                      </div>
                      <div
                        style={{
                          marginTop: 8,
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          color: "rgba(255,255,255,0.4)",
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>RE:CodeX · BOT v1.9.3</span>
                        <span>Next reward: Lv.65 → +Constellation</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="dc-button-row" style={{ marginTop: 8 }}>
                  <button className="dc-btn primary">
                    <Icon name="trophy" size={12} /> Leaderboard
                  </button>
                  <button className="dc-btn secondary">My History</button>
                  <button className="dc-btn secondary">Customize Card</button>
                </div>
              </div>
            </div>

            <div className="dc-msg" style={{ marginTop: 18 }}>
              <div
                className="dc-msg-av"
                style={{
                  background: "linear-gradient(135deg, #7ae0ff, #4a90e2)",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Icon name="trophy" size={16} color="#fff" />
              </div>
              <div className="dc-msg-body">
                <div className="dc-msg-head">
                  <strong>RX.Level</strong>
                  <span className="badge-bot">
                    <Icon name="check" size={8} /> APP
                  </span>
                  <span className="ts">เมื่อสักครู่</span>
                </div>
                <div className="dc-embed" style={{ borderLeftColor: "#7ae0ff" }}>
                  <div className="dc-embed-author">
                    <Icon name="zap" size={11} color="#7ae0ff" /> LEVEL UP
                  </div>
                  <div className="dc-embed-title" style={{ fontSize: 14 }}>
                    @aoi_v reached <span style={{ color: "#7ae0ff" }}>Lv.24</span> 🎉
                  </div>
                  <div className="dc-embed-desc" style={{ fontSize: 12 }}>
                    +1,200 XP this week · Top 4 of weekly leaderboard
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </>
);
