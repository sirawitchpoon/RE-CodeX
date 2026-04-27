import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", height: "100vh", gap: 16,
          background: "var(--bg-0)", color: "var(--fg-1)", fontFamily: "monospace",
        }}>
          <div style={{ color: "var(--red)", fontSize: 14 }}>
            ⚠ Render error: {String(this.state.error?.message ?? this.state.error)}
          </div>
          <button
            style={{ padding: "8px 16px", cursor: "pointer" }}
            onClick={() => { localStorage.clear(); location.reload(); }}
          >
            Clear session &amp; reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
