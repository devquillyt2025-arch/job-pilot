// Every page: a fixed heading (title, subtitle, optional actions) with a
// divider under it, and a body that is the only part of the screen that scrolls.
export default function PageLayout({ title, sub, actions, children }) {
  return (
    <>
      <div className="page-head">
        <div>
          <h2>{title}</h2>
          {sub && <div className="sub">{sub}</div>}
        </div>
        {actions}
      </div>
      <div className="page-body">{children}</div>
    </>
  );
}
