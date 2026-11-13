// ===== Vòng tròn tiến độ pastel (SVG) =====
export function progressRing(percent, { size = 72, stroke = 7, color = 'var(--matcha-dark)', track = 'rgba(111,85,71,.1)', label = true } = {}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (c * Math.max(0, Math.min(100, percent))) / 100;
  return `
  <div class="ring" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
      <circle class="ring-fill" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
        stroke-linecap="round" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"
        transform="rotate(-90 ${size / 2} ${size / 2})"/>
    </svg>
    ${label ? `<span class="ring-label">${percent}%</span>` : ''}
  </div>`;
}

/** Thanh tiến độ ngang */
export function progressBar(percent, { color = 'var(--matcha-dark)', height = 8 } = {}) {
  return `<div class="bar" style="height:${height}px"><div class="bar-fill" style="width:${Math.max(0, Math.min(100, percent))}%;background:${color}"></div></div>`;
}
