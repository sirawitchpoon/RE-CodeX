import { useState } from "react";
import { api, API_ENABLED } from "../api.js";
import { setAuth } from "../auth.js";

export const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!username || !password) return;
    setBusy(true);
    setError("");
    try {
      const res = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setAuth({ token: res.token, user: res.user });
    } catch (err) {
      const msg = String(err?.message ?? err);
      if (msg.includes("429")) setError("ลองเข้าระบบบ่อยเกินไป — รอ 15 นาทีแล้วลองใหม่");
      else if (msg.includes("401")) setError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      else setError("เข้าระบบไม่สำเร็จ — ลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-shell">
      <form className="login-card card" onSubmit={submit}>
        <div className="login-brand">
          <div className="login-emoji">✨</div>
          <div>
            <div className="login-title">Re:CodeX</div>
            <div className="login-sub">Backoffice Sign In</div>
          </div>
        </div>

        <label className="login-field">
          <span>USERNAME</span>
          <input
            autoFocus
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={busy}
            required
          />
        </label>

        <label className="login-field">
          <span>PASSWORD</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            required
          />
        </label>

        {error && <div className="login-err">{error}</div>}

        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? "กำลังเข้าระบบ…" : "Sign In"}
        </button>

        {!API_ENABLED && (
          <div className="login-hint">
            VITE_API_BASE ไม่ได้ตั้งค่า — กำลังรันใน mock mode (login จะไม่ทำงาน)
          </div>
        )}
      </form>
    </div>
  );
};
