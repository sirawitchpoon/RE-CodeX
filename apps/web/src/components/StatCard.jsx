import { Sparkle, Icon } from "./Icon.jsx";

export const StatCard = ({ label, value, delta, deltaDir, suffix }) => (
  <div className="stat">
    <div className="stat-label">
      <Sparkle size={9} color="var(--accent)" /> {label}
    </div>
    <div className="stat-value">
      {value}
      {suffix && (
        <span style={{ fontSize: 14, color: "var(--fg-3)", marginLeft: 4 }}>
          {suffix}
        </span>
      )}
    </div>
    {delta && (
      <div className={"stat-delta " + (deltaDir || "flat")}>
        <Icon
          name={
            deltaDir === "up" ? "arrowUp" : deltaDir === "down" ? "arrowDown" : "activity"
          }
          size={11}
        />
        {delta}
      </div>
    )}
  </div>
);
