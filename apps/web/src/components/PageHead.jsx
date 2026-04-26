export const PageHead = ({ tag, title, desc, actions }) => (
  <div className="page-head">
    <div className="page-title">
      <h1>
        {title}
        {tag && <span className="tag-mono">{tag}</span>}
      </h1>
      {desc && <p>{desc}</p>}
    </div>
    {actions && <div style={{ display: "flex", gap: 8 }}>{actions}</div>}
  </div>
);
