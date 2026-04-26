import { Icon } from "./Icon.jsx";
import { Sparkline } from "./Sparkline.jsx";

export const BotCardRow = ({ bot, onSelect }) => (
  <div className="bot-row" onClick={() => onSelect && onSelect(bot)}>
    <div className="bot-row-head">
      <div className="bot-icon" style={{ background: bot.iconBg }}>
        <Icon name={bot.icon} size={18} />
      </div>
      <div className="bot-meta">
        <div className="bot-name">
          {bot.name}
          <span
            className={
              "pill solid " + (bot.status === "ONLINE" ? "online" : "idle")
            }
            style={{ marginLeft: 8 }}
          >
            {bot.status}
          </span>
        </div>
        <div className="bot-id">
          {bot.id} · v{bot.version}
        </div>
      </div>
      <button className="btn ghost btn-sm">
        <Icon name="more" size={14} />
      </button>
    </div>
    <div className="bot-row-body">
      <div className="bot-stats">
        <div>
          <span>UPTIME</span>
          <strong>{bot.uptime}</strong>
        </div>
        <div>
          <span>CPU</span>
          <strong>{bot.cpu}%</strong>
        </div>
        <div>
          <span>MEM</span>
          <strong>{bot.mem}</strong>
        </div>
        <div>
          <span>EVENTS / 24H</span>
          <strong>{bot.events.toLocaleString()}</strong>
        </div>
      </div>
      <div className="bot-spark">
        <Sparkline data={bot.spark} color={bot.color} />
      </div>
    </div>
    <div className="bot-row-foot">
      <div className="code-line">
        <span className="ln">›</span>
        <span>
          <span className="kw">{bot.lastCmd}</span>{" "}
          <span className="str">"{bot.lastSubject}"</span>{" "}
          <span className="com">— {bot.lastWhen}</span>
        </span>
      </div>
    </div>
  </div>
);
