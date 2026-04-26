import { useState } from "react";

export const Toggle = ({ label, desc, defaultOn, val, range }) => {
  const [on, setOn] = useState(!!defaultOn);
  return (
    <div className="rule-block">
      <div className="rule-info">
        <h4>{label}</h4>
        <p>{desc}</p>
      </div>
      <div className="rule-input">
        {val && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: on ? "var(--accent)" : "var(--fg-3)",
            }}
          >
            {val}
          </span>
        )}
        {range && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--fg-3)",
            }}
          >
            {range}
          </span>
        )}
        <span className={"toggle" + (on ? " on" : "")} onClick={() => setOn(!on)}>
          <span className="track" />
        </span>
      </div>
    </div>
  );
};
