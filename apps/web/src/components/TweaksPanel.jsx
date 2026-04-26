import { useState } from "react";
import { Icon } from "./Icon.jsx";

const Seg = ({ value, options, onChange }) => (
  <div className="tweaks-seg">
    {options.map((o) => (
      <button
        key={o.value}
        className={value === o.value ? "active" : ""}
        onClick={() => onChange(o.value)}
      >
        {o.label}
      </button>
    ))}
  </div>
);

export const TweaksPanel = ({ tweaks, setTweak }) => {
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <button
        className="tweaks-fab"
        title="Open tweaks"
        onClick={() => setOpen(true)}
      >
        <Icon name="sliders" size={18} />
      </button>
    );
  }

  return (
    <div className="tweaks-panel">
      <div className="tweaks-head">
        <b>Tweaks</b>
        <button className="tweaks-toggle" onClick={() => setOpen(false)}>
          ✕
        </button>
      </div>
      <div className="tweaks-body">
        <div className="tweaks-section">
          <div className="tweaks-section-label">Theme</div>
          <div className="tweaks-row">
            <span className="lab">Mode</span>
            <Seg
              value={tweaks.theme}
              onChange={(v) => setTweak("theme", v)}
              options={[
                { value: "dark", label: "Dark" },
                { value: "light", label: "Light" },
              ]}
            />
          </div>
        </div>
        <div className="tweaks-section">
          <div className="tweaks-section-label">Layout</div>
          <div className="tweaks-row">
            <span className="lab">Navigation</span>
            <Seg
              value={tweaks.nav}
              onChange={(v) => setTweak("nav", v)}
              options={[
                { value: "side", label: "Side" },
                { value: "top", label: "Top" },
              ]}
            />
          </div>
          <div className="tweaks-row">
            <span className="lab">Density</span>
            <Seg
              value={tweaks.density}
              onChange={(v) => setTweak("density", v)}
              options={[
                { value: "comfy", label: "Comfy" },
                { value: "compact", label: "Compact" },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
