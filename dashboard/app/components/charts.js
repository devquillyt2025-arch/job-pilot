'use client';
import { useEffect, useRef, useState } from 'react';

// Small hand-rolled chart kit for the analytics page. Colors come from the
// --series-* / --grid tokens in globals.css; text always uses text tokens.

function useTooltip() {
  const ref = useRef(null);
  const [tip, setTip] = useState(null);
  function show(e, content) {
    const box = ref.current.getBoundingClientRect();
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, content });
  }
  return { ref, tip, show, hide: () => setTip(null) };
}

function Tooltip({ tip }) {
  if (!tip) return null;
  return (
    <div className="viz-tooltip" style={{ left: tip.x + 12, top: tip.y + 12 }}>
      {tip.content}
    </div>
  );
}

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

// Round axis: a clean step (1/2/5 × 10^k) giving ~4 ticks, max on a step.
function niceScale(n) {
  if (n <= 4) return { max: 4, step: 1 };
  const pow = 10 ** Math.floor(Math.log10(n / 4));
  const step = [1, 2, 5, 10].find((s) => s * pow >= n / 4) * pow;
  return { max: Math.ceil(n / step) * step, step };
}

// Ranked horizontal bars - one series, value labeled at each bar tip.
export function HBarList({ items, unit = 'jobs', empty = 'No data yet.' }) {
  const { ref, tip, show, hide } = useTooltip();
  if (!items.length) return <div className="empty">{empty}</div>;
  const max = Math.max(...items.map((i) => i.value));
  const total = items.reduce((s, i) => s + i.value, 0);

  return (
    <div className="viz-wrap" ref={ref} onMouseLeave={hide}>
      <div className="hbar-list">
        {items.map((item) => (
          <div
            key={item.label}
            className="hbar-row"
            onMouseMove={(e) =>
              show(
                e,
                <>
                  <strong>{item.label}</strong>
                  <div>
                    {item.value} {unit}
                    {item.share !== false && ` · ${Math.round((item.value / total) * 100)}%`}
                  </div>
                </>
              )
            }
          >
            <div className="hbar-label" title={item.label}>
              {item.label}
            </div>
            <div className="hbar-track">
              <div className="hbar-bar" style={{ width: `${(item.value / max) * 100}%` }} />
              <span className="hbar-value">{item.value}</span>
            </div>
          </div>
        ))}
      </div>
      <Tooltip tip={tip} />
    </div>
  );
}

// Vertical columns over categories; one or more series side by side, one y-axis.
export function ColumnChart({ categories, series, height = 220, valueLabel = (v) => v }) {
  const { ref, tip, show, hide } = useTooltip();
  const [sizeRef, width] = useWidth();
  const [showTable, setShowTable] = useState(false);

  const pad = { top: 16, right: 8, bottom: 28, left: 32 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const { max, step } = niceScale(Math.max(1, ...series.flatMap((s) => s.values)));
  const ticks = Array.from({ length: max / step + 1 }, (_, i) => i * step);
  const band = categories.length ? innerW / categories.length : 0;
  const barW = Math.min(24, Math.max(4, (band * 0.7 - (series.length - 1) * 2) / series.length));
  const groupW = barW * series.length + (series.length - 1) * 2;
  const y = (v) => pad.top + innerH - (v / max) * innerH;

  // Rect with a 4px rounded top and a square baseline.
  function barPath(x, top, w) {
    const h = pad.top + innerH - top;
    if (h <= 0) return '';
    const r = Math.min(4, h, w / 2);
    const bottom = pad.top + innerH;
    return `M${x},${bottom} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${bottom} Z`;
  }

  return (
    <div className="viz-wrap" ref={ref} onMouseLeave={hide}>
      {series.length > 1 && (
        <div className="viz-legend">
          {series.map((s) => (
            <span key={s.name}>
              <i className="swatch" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
      <div ref={sizeRef}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={series.map((s) => s.name).join(', ')}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} className="viz-grid" />
                <text x={pad.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="viz-axis">
                  {t}
                </text>
              </g>
            ))}
            {categories.map((cat, ci) => {
              const gx = pad.left + band * ci + (band - groupW) / 2;
              return (
                <g
                  key={ci}
                  onMouseMove={(e) =>
                    show(
                      e,
                      <>
                        <strong>{cat}</strong>
                        {series.map((s) => (
                          <div key={s.name}>
                            <i className="swatch" style={{ background: s.color }} />
                            {s.name}: {valueLabel(s.values[ci])}
                          </div>
                        ))}
                      </>
                    )
                  }
                >
                  <rect x={pad.left + band * ci} y={pad.top} width={band} height={innerH} fill="transparent" />
                  {series.map((s, si) => (
                    <path key={s.name} d={barPath(gx + si * (barW + 2), y(s.values[ci]), barW)} fill={s.color} />
                  ))}
                  {categories.length <= 12 && (
                    <text x={pad.left + band * ci + band / 2} y={height - 8} textAnchor="middle" className="viz-axis">
                      {cat}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>
      <Tooltip tip={tip} />
      <button className="small viz-table-toggle" onClick={() => setShowTable((v) => !v)}>
        {showTable ? 'Hide table' : 'Show table'}
      </button>
      {showTable && (
        <table className="viz-table">
          <thead>
            <tr>
              <th></th>
              {series.map((s) => (
                <th key={s.name}>{s.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((cat, ci) => (
              <tr key={ci}>
                <td>{cat}</td>
                {series.map((s) => (
                  <td key={s.name}>{valueLabel(s.values[ci])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
