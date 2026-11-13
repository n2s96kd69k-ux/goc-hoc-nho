// ===== ARTWORK VẬT PHẨM — SVG vẽ riêng cho project (không dùng ảnh ngoài) =====
// Mỗi hàm trả về SVG với viewBox chuẩn hóa; kích thước thật do CSS (size.w/h) quyết định.
// Item không có art riêng dùng emoji sticker (art: 'emoji').

const svg = (vb, inner) => `<svg class="item-svg" viewBox="${vb}" preserveAspectRatio="none" aria-hidden="true">${inner}</svg>`;

const ART = {
  desk: (t) => svg('0 0 100 64', `
    <rect x="0" y="0" width="100" height="10" rx="4" fill="${t.desk}"/>
    <rect x="0" y="8" width="100" height="4" fill="rgba(0,0,0,.08)"/>
    <rect x="6" y="12" width="7" height="52" rx="2" fill="${t.desk}" style="filter:brightness(.92)"/>
    <rect x="87" y="12" width="7" height="52" rx="2" fill="${t.desk}" style="filter:brightness(.92)"/>
    <rect x="13" y="16" width="22" height="24" rx="3" fill="${t.desk}" style="filter:brightness(.96)"/>
    <rect x="21" y="26" width="6" height="2" rx="1" fill="rgba(0,0,0,.15)"/>
    <rect x="0" y="2" width="100" height="2" fill="rgba(255,255,255,.35)"/>`),
  chair: (t) => svg('0 0 60 100', `
    <rect x="12" y="0" width="36" height="46" rx="12" fill="${t.accent}"/>
    <rect x="16" y="6" width="28" height="34" rx="9" fill="rgba(255,255,255,.25)"/>
    <rect x="6" y="46" width="48" height="14" rx="6" fill="${t.accent}" style="filter:brightness(.95)"/>
    <rect x="12" y="60" width="5" height="40" rx="2" fill="#B8987A"/><rect x="43" y="60" width="5" height="40" rx="2" fill="#B8987A"/>`),
  stool: (t) => svg('0 0 60 70', `
    <ellipse cx="30" cy="10" rx="28" ry="10" fill="${t.accent}"/>
    <rect x="8" y="14" width="44" height="8" rx="4" fill="${t.accent}" style="filter:brightness(.93)"/>
    <rect x="12" y="22" width="5" height="48" rx="2" fill="#B8987A"/><rect x="43" y="22" width="5" height="48" rx="2" fill="#B8987A"/>`),
  bookshelf: (t) => svg('0 0 100 72', `
    <rect x="0" y="0" width="100" height="7" rx="3" fill="${t.desk}"/>
    <rect x="0" y="34" width="100" height="6" rx="3" fill="${t.desk}"/>
    <rect x="0" y="66" width="100" height="6" rx="3" fill="${t.desk}"/>
    <rect x="0" y="0" width="6" height="72" rx="2" fill="${t.desk}" style="filter:brightness(.9)"/>
    <rect x="94" y="0" width="6" height="72" rx="2" fill="${t.desk}" style="filter:brightness(.9)"/>
    <g><rect x="10" y="10" width="7" height="24" rx="1.5" fill="#E3A29E"/><rect x="18" y="14" width="6" height="20" rx="1.5" fill="#93B7D6"/><rect x="25" y="9" width="8" height="25" rx="1.5" fill="#91B58A"/><rect x="34" y="16" width="5" height="18" rx="1.5" fill="#DCBD65"/></g>
    <g><rect x="60" y="44" width="6" height="22" rx="1.5" fill="#AF9FCC"/><rect x="67" y="40" width="7" height="26" rx="1.5" fill="#E3A29E"/><rect x="75" y="47" width="6" height="19" rx="1.5" fill="#93B7D6"/></g>`),
  sofa: (t) => svg('0 0 100 70', `
    <rect x="6" y="0" width="88" height="40" rx="16" fill="${t.accent}"/>
    <rect x="0" y="26" width="100" height="32" rx="14" fill="${t.accent}" style="filter:brightness(.96)"/>
    <rect x="12" y="30" width="36" height="22" rx="10" fill="rgba(255,255,255,.28)"/>
    <rect x="52" y="30" width="36" height="22" rx="10" fill="rgba(255,255,255,.28)"/>
    <rect x="10" y="58" width="8" height="12" rx="3" fill="#B8987A"/><rect x="82" y="58" width="8" height="12" rx="3" fill="#B8987A"/>`),
  cabinet: (t) => svg('0 0 60 110', `
    <rect x="0" y="0" width="60" height="104" rx="6" fill="${t.desk}"/>
    <rect x="6" y="8" width="48" height="26" rx="3" fill="rgba(255,255,255,.22)"/>
    <rect x="6" y="40" width="48" height="26" rx="3" fill="rgba(255,255,255,.22)"/>
    <rect x="6" y="72" width="48" height="26" rx="3" fill="rgba(255,255,255,.22)"/>
    <circle cx="30" cy="21" r="2.5" fill="#F3D993"/><circle cx="30" cy="53" r="2.5" fill="#F3D993"/><circle cx="30" cy="85" r="2.5" fill="#F3D993"/>
    <rect x="4" y="104" width="6" height="6" fill="#B8987A"/><rect x="50" y="104" width="6" height="6" fill="#B8987A"/>`),
  rug: (t) => svg('0 0 200 50', `
    <ellipse cx="100" cy="25" rx="100" ry="25" fill="${t.accent}" opacity=".85"/>
    <ellipse cx="100" cy="25" rx="78" ry="18" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="3"/>
    <ellipse cx="100" cy="25" rx="40" ry="9" fill="rgba(255,255,255,.35)"/>`),
  plant_small: () => svg('0 0 60 100', `
    <g class="art-sway"><path d="M30 60 C10 50 8 26 22 18 C30 30 30 46 30 60Z" fill="#91B58A"/><path d="M30 60 C50 50 52 26 38 18 C30 30 30 46 30 60Z" fill="#A9C79F"/><path d="M30 58 C28 40 24 30 30 10 C36 30 32 40 30 58Z" fill="#7FA877"/></g>
    <path d="M12 62 H48 L44 100 H16 Z" fill="#E3A29E"/><rect x="10" y="58" width="40" height="8" rx="3" fill="#EDB6B2"/>`),
  plant_big: () => svg('0 0 70 150', `
    <g class="art-sway"><ellipse cx="35" cy="40" rx="30" ry="34" fill="#91B58A"/><ellipse cx="20" cy="56" rx="18" ry="20" fill="#A9C79F"/><ellipse cx="52" cy="58" rx="18" ry="22" fill="#7FA877"/><ellipse cx="35" cy="24" rx="16" ry="16" fill="#A9C79F"/></g>
    <rect x="31" y="70" width="8" height="40" rx="3" fill="#B8987A"/>
    <path d="M12 108 H58 L52 150 H18 Z" fill="#C9A98A"/><rect x="10" y="104" width="50" height="9" rx="4" fill="#D9BB9A"/>`),
  cactus: () => svg('0 0 50 80', `
    <rect x="18" y="8" width="14" height="46" rx="7" fill="#7FA877"/><rect x="6" y="22" width="10" height="20" rx="5" fill="#91B58A"/><rect x="34" y="16" width="10" height="22" rx="5" fill="#91B58A"/>
    <circle cx="25" cy="8" r="4" fill="#F4A9B8"/>
    <path d="M10 54 H40 L37 80 H13 Z" fill="#DCBD65"/><rect x="8" y="50" width="34" height="7" rx="3" fill="#F3D993"/>`),
  hanging_plant: () => svg('0 0 50 100', `
    <path d="M25 0 V18" stroke="#B8987A" stroke-width="2"/><path d="M12 24 H38 L34 44 H16 Z" fill="#E3A29E"/><rect x="10" y="20" width="30" height="6" rx="3" fill="#EDB6B2"/>
    <g class="art-sway"><path d="M16 44 C8 60 12 80 6 96" stroke="#91B58A" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M25 44 C26 62 22 80 26 100" stroke="#7FA877" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M34 44 C42 60 38 80 44 94" stroke="#A9C79F" stroke-width="4" fill="none" stroke-linecap="round"/></g>`),
  vase: () => svg('0 0 50 90', `
    <g class="art-sway"><path d="M25 44 V14" stroke="#7FA877" stroke-width="2.5"/><path d="M17 12 q8 -14 16 0 q0 12 -8 14 q-8 -2 -8 -14z" fill="#F4A9B8"/><path d="M12 42 V22" stroke="#7FA877" stroke-width="2"/><path d="M6 20 q6 -10 12 0 q0 9 -6 10 q-6 -1 -6 -10z" fill="#F3D993"/><path d="M38 42 V24" stroke="#7FA877" stroke-width="2"/><path d="M32 22 q6 -10 12 0 q0 9 -6 10 q-6 -1 -6 -10z" fill="#D8CEE8"/></g>
    <path d="M15 44 H35 L38 62 Q25 92 12 62Z" fill="#C8DDEE"/><rect x="13" y="42" width="24" height="6" rx="3" fill="#DDEBF7"/>`),
  laptop: () => svg('0 0 90 70', `
    <rect x="8" y="0" width="74" height="50" rx="5" fill="#7A6A80"/>
    <rect class="art-screen" x="13" y="5" width="64" height="40" rx="3" fill="#C8DDEE"/>
    <rect x="22" y="14" width="30" height="3" rx="1.5" fill="rgba(255,255,255,.7)"/><rect x="22" y="22" width="44" height="3" rx="1.5" fill="rgba(255,255,255,.55)"/><rect x="22" y="30" width="36" height="3" rx="1.5" fill="rgba(255,255,255,.55)"/>
    <rect x="0" y="50" width="90" height="12" rx="4" fill="#9A8AA0"/><rect x="30" y="54" width="30" height="4" rx="2" fill="rgba(0,0,0,.15)"/>`),
  books: () => svg('0 0 50 60', `
    <rect x="4" y="42" width="42" height="12" rx="2" fill="#E3A29E"/><rect x="8" y="30" width="36" height="12" rx="2" fill="#93B7D6"/><rect x="6" y="18" width="38" height="12" rx="2" fill="#91B58A"/><rect x="10" y="6" width="32" height="12" rx="2" fill="#F3D993"/>
    <rect x="12" y="10" width="20" height="2" fill="rgba(255,255,255,.6)"/><rect x="10" y="22" width="22" height="2" fill="rgba(255,255,255,.6)"/>`),
  notebook: () => svg('0 0 50 40', `
    <rect x="2" y="4" width="46" height="34" rx="4" fill="#D8CEE8"/><rect x="2" y="4" width="8" height="34" rx="3" fill="#AF9FCC"/>
    <rect x="16" y="12" width="24" height="2.5" rx="1" fill="rgba(255,255,255,.7)"/><rect x="16" y="19" width="20" height="2.5" rx="1" fill="rgba(255,255,255,.7)"/><rect x="16" y="26" width="24" height="2.5" rx="1" fill="rgba(255,255,255,.7)"/>`),
  pencil_cup: () => svg('0 -10 30 70', `
    <path d="M8 6 L10 -4" stroke="#E3A29E" stroke-width="3" stroke-linecap="round"/><path d="M15 4 L15 -8" stroke="#93B7D6" stroke-width="3" stroke-linecap="round"/><path d="M22 6 L20 -4" stroke="#DCBD65" stroke-width="3" stroke-linecap="round"/>
    <path d="M4 20 H26 L23 60 H7 Z" fill="#F4C8C5"/><rect x="2" y="16" width="26" height="7" rx="3" fill="#F7D6E8"/>`),
  desk_lamp: () => svg('-20 0 90 110', `
    <ellipse class="art-lamp-glow" cx="34" cy="48" rx="40" ry="30" fill="#F3D993" opacity="0"/>
    <path d="M14 104 L14 40 Q14 30 24 30 L34 30" stroke="#7A6A80" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M22 26 L46 26 L50 44 L18 44 Z" class="art-lamp-shade" fill="#F3D993"/>
    <ellipse cx="34" cy="44" rx="16" ry="3" class="art-lamp-bulb" fill="#FFF3C4"/>
    <ellipse cx="14" cy="104" rx="12" ry="5" fill="#7A6A80"/>`),
  floor_lamp: () => svg('-20 0 80 160', `
    <ellipse class="art-lamp-glow" cx="20" cy="30" rx="38" ry="30" fill="#F3D993" opacity="0"/>
    <path d="M6 6 H34 L38 34 H2 Z" class="art-lamp-shade" fill="#F4C8C5"/><ellipse cx="20" cy="34" rx="18" ry="3" class="art-lamp-bulb" fill="#FFF3C4"/>
    <rect x="18" y="34" width="4" height="118" fill="#7A6A80"/><ellipse cx="20" cy="154" rx="14" ry="5" fill="#7A6A80"/>`),
  ceiling_lamp: () => svg('-20 0 100 70', `
    <path d="M30 0 V22" stroke="#7A6A80" stroke-width="2.5"/>
    <path d="M10 22 H50 L58 50 H2 Z" class="art-lamp-shade" fill="#F4C8C5"/>
    <ellipse cx="30" cy="50" rx="28" ry="4" class="art-lamp-bulb" fill="#FFF3C4"/>
    <ellipse class="art-lamp-glow" cx="30" cy="56" rx="48" ry="14" fill="#F3D993" opacity="0"/>`),
  string_lights: () => svg('0 0 200 40', `
    <path d="M0 8 Q50 30 100 8 T200 8" stroke="#7A6A80" stroke-width="1.5" fill="none"/>
    ${[12, 37, 62, 87, 112, 137, 162, 187].map((x, i) => `<circle class="art-bulb b${i % 4}" cx="${x}" cy="${i % 2 ? 24 : 18}" r="4" fill="${['#F3D993', '#F4A9B8', '#A9C7E8', '#BFD8B8'][i % 4]}"/>`).join('')}`),
  poster: () => svg('0 0 60 90', `
    <rect x="0" y="0" width="60" height="90" rx="3" fill="#FFF8EC" stroke="#E3A29E" stroke-width="2"/>
    <circle cx="30" cy="34" r="16" fill="#F4C8C5"/><path d="M22 34 q8 10 16 0" stroke="#6F5547" stroke-width="2" fill="none" stroke-linecap="round"/>
    <rect x="12" y="60" width="36" height="4" rx="2" fill="#6F5547" opacity=".6"/><rect x="18" y="70" width="24" height="4" rx="2" fill="#6F5547" opacity=".4"/>
    <circle cx="30" cy="4" r="3" fill="#E3A29E"/>`),
  painting: () => svg('0 0 80 70', `
    <rect x="0" y="0" width="80" height="70" rx="3" fill="#C9A98A"/><rect x="6" y="6" width="68" height="58" rx="2" fill="#C8DDEE"/>
    <circle cx="58" cy="22" r="7" fill="#F3D993"/><path d="M6 50 L26 30 L40 46 L52 36 L74 56 V64 H6 Z" fill="#91B58A"/><path d="M6 56 L20 44 L34 58 L46 50 L74 64 H6Z" fill="#7FA877"/>`),
  clock: () => svg('0 0 60 70', `
    <circle cx="30" cy="30" r="28" fill="#FFF8EC" stroke="#C9A98A" stroke-width="4"/>
    <circle cx="30" cy="30" r="2" fill="#6F5547"/>
    <line class="art-hand-h" x1="30" y1="30" x2="30" y2="16" stroke="#6F5547" stroke-width="3" stroke-linecap="round"/>
    <line class="art-hand-m" x1="30" y1="30" x2="42" y2="30" stroke="#6F5547" stroke-width="2" stroke-linecap="round"/>
    <line class="art-hand-s" x1="30" y1="30" x2="30" y2="10" stroke="#E3A29E" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M18 60 L30 68 L42 60" stroke="#C9A98A" stroke-width="3" fill="none"/>`),
  cat_bed: (t) => svg('0 0 100 50', `
    <ellipse cx="50" cy="30" rx="48" ry="18" fill="${t.accent}"/>
    <ellipse cx="50" cy="26" rx="36" ry="11" fill="rgba(255,255,255,.45)"/>
    <ellipse cx="50" cy="42" rx="46" ry="6" fill="rgba(0,0,0,.06)"/>`),
  mug: () => svg('0 -10 40 50', `
    <g class="art-steam"><path d="M14 10 q3 -5 0 -10" stroke="#fff" stroke-width="2" fill="none" opacity=".7"/><path d="M22 12 q3 -5 0 -10" stroke="#fff" stroke-width="2" fill="none" opacity=".5"/></g>
    <rect x="6" y="12" width="24" height="26" rx="5" fill="#F4C8C5"/><path d="M30 18 q9 0 9 7 t-9 7" stroke="#F4C8C5" stroke-width="4" fill="none"/><rect x="6" y="12" width="24" height="6" rx="3" fill="#8B5E3C"/>`),
};

export function itemArt(def, theme) {
  const fn = ART[def.art];
  if (fn) return fn(theme);
  return `<span class="item-emoji" aria-hidden="true">${def.emoji}</span>`;
}

export function hasCustomArt(def) { return !!ART[def.art]; }
