// ===== CATALOG VẬT PHẨM — data-driven =====
// Toàn bộ shop / kho / phòng / mèo đều đọc từ đây. Không hard-code item ở nơi khác.
//
// Hệ tọa độ phòng: 100 × 100 đơn vị (phần trăm chiều rộng / chiều cao của scene 4:3).
// size.w = % chiều rộng scene, size.h = % chiều cao scene. Anchor của item = điểm giữa cạnh dưới.
//
// surfaces: nơi được đặt — 'floor' | 'wall' | 'ceiling' | 'desk' | 'shelf' | 'sofa' | 'bed'
// provides: item này TẠO RA một surface mới (desk, shelf, sofa, bed) cho item khác / cho mèo.
// surfaceTop: vị trí mặt đặt đồ tính từ đỉnh item (0..1) — dùng khi provides.
// catEffect: 'study' | 'rest' | 'sleep' | 'near' | 'light' | null — mèo đọc để quyết định hành vi.
// layer: 'wallDecor' | 'furniture' | 'deskObj' | 'plant' | 'light' | 'cute' | 'rug' — dùng cho depth.

export const CATEGORIES = [
  { id: 'furniture', label: 'Nội thất', icon: '🪑' },
  { id: 'plant', label: 'Cây xanh', icon: '🌱' },
  { id: 'study', label: 'Học tập', icon: '📚' },
  { id: 'lighting', label: 'Ánh sáng', icon: '💡' },
  { id: 'decor', label: 'Trang trí', icon: '🖼️' },
  { id: 'cat', label: 'Cho mèo', icon: '🐱' },
  { id: 'cute', label: 'Đồ xinh', icon: '🧸' },
  { id: 'theme', label: 'Phong cách phòng', icon: '🎨' },
];

export const THEMES = {
  cream: { id: 'cream', name: 'Cream Cozy', wall: '#FBEFDF', wall2: '#F5E3CF', floor: '#E7CDB0', floor2: '#D9BB9A', accent: '#F4C8C5', curtain: '#F4C8C5', desk: '#C9A98A' },
  matcha: { id: 'matcha', name: 'Matcha Room', wall: '#EAF1E4', wall2: '#DDE9D6', floor: '#D9C7A9', floor2: '#C9B58F', accent: '#BFD8B8', curtain: '#BFD8B8', desk: '#B99C7C' },
  sunset: { id: 'sunset', name: 'Sunset Room', wall: '#FBE6D6', wall2: '#F6D3BF', floor: '#DDB99A', floor2: '#CDA482', accent: '#F3D993', curtain: '#F3C6A5', desk: '#B98F6E' },
  night: { id: 'night', name: 'Night Study', wall: '#DED9EA', wall2: '#CFC7E0', floor: '#C8B8A8', floor2: '#B5A390', accent: '#D8CEE8', curtain: '#C9BFE0', desk: '#A88B72' },
};

export const ITEMS = [
  // ---------- NỘI THẤT ----------
  { id: 'desk', name: 'Bàn học gỗ', emoji: '🪵', category: 'furniture', price: 260, size: { w: 34, h: 22 }, surfaces: ['floor'], layer: 'furniture', maxQty: 1, provides: 'desk', surfaceTop: 0.08, catEffect: 'study', art: 'desk', starter: true, rotatable: false },
  { id: 'chair', name: 'Ghế êm', emoji: '🪑', category: 'furniture', price: 120, size: { w: 12, h: 20 }, surfaces: ['floor'], layer: 'furniture', maxQty: 2, art: 'chair', starter: true },
  { id: 'bookshelf', name: 'Kệ sách treo', emoji: '📚', category: 'furniture', price: 220, size: { w: 22, h: 16 }, surfaces: ['wall'], layer: 'wallDecor', maxQty: 2, provides: 'shelf', surfaceTop: 0.1, catEffect: 'near', art: 'bookshelf', starter: true, rotatable: false },
  { id: 'sofa', name: 'Sofa kem', emoji: '🛋️', category: 'furniture', price: 300, size: { w: 26, h: 18 }, surfaces: ['floor'], layer: 'furniture', maxQty: 1, provides: 'sofa', surfaceTop: 0.45, catEffect: 'rest', art: 'sofa' },
  { id: 'cabinet', name: 'Tủ nhỏ', emoji: '🗄️', category: 'furniture', price: 240, size: { w: 14, h: 26 }, surfaces: ['floor'], layer: 'furniture', maxQty: 1, provides: 'shelf', surfaceTop: 0.02, art: 'cabinet', rotatable: false },
  { id: 'rug', name: 'Thảm tròn', emoji: '🟤', category: 'furniture', price: 150, size: { w: 36, h: 9 }, surfaces: ['floor'], layer: 'rug', maxQty: 1, art: 'rug', passable: true, rotatable: false },
  { id: 'stool', name: 'Ghế đôn', emoji: '🪑', category: 'furniture', price: 80, size: { w: 9, h: 11 }, surfaces: ['floor'], layer: 'furniture', maxQty: 2, art: 'stool', rotatable: false },

  // ---------- CÂY ----------
  { id: 'plant_small', name: 'Chậu cây nhỏ', emoji: '🌱', category: 'plant', price: 120, size: { w: 6, h: 10 }, surfaces: ['desk', 'floor', 'shelf'], layer: 'plant', maxQty: 3, catEffect: 'near', art: 'plant_small', starter: true, sway: true },
  { id: 'cactus', name: 'Xương rồng bé', emoji: '🌵', category: 'plant', price: 60, size: { w: 5, h: 8 }, surfaces: ['desk', 'shelf'], layer: 'plant', maxQty: 3, art: 'cactus' },
  { id: 'plant_big', name: 'Cây lớn góc phòng', emoji: '🪴', category: 'plant', price: 220, size: { w: 14, h: 30 }, surfaces: ['floor'], layer: 'plant', maxQty: 2, catEffect: 'near', art: 'plant_big', sway: true },
  { id: 'hanging_plant', name: 'Cây treo', emoji: '🌿', category: 'plant', price: 130, size: { w: 8, h: 16 }, surfaces: ['ceiling'], layer: 'plant', maxQty: 2, art: 'hanging_plant', sway: true },
  { id: 'vase', name: 'Bình hoa tulip', emoji: '🌷', category: 'plant', price: 90, size: { w: 5, h: 9 }, surfaces: ['desk', 'shelf'], layer: 'plant', maxQty: 2, art: 'vase' },

  // ---------- HỌC TẬP ----------
  { id: 'laptop', name: 'Laptop', emoji: '💻', category: 'study', price: 240, size: { w: 9, h: 7 }, surfaces: ['desk'], layer: 'deskObj', maxQty: 1, art: 'laptop', glow: true },
  { id: 'books', name: 'Chồng sách', emoji: '📚', category: 'study', price: 60, size: { w: 5, h: 6 }, surfaces: ['desk', 'shelf'], layer: 'deskObj', maxQty: 4, art: 'books', starter: true },
  { id: 'notebook', name: 'Sổ tay', emoji: '📓', category: 'study', price: 40, size: { w: 5, h: 4 }, surfaces: ['desk'], layer: 'deskObj', maxQty: 2, art: 'notebook' },
  { id: 'globe', name: 'Quả địa cầu', emoji: '🌍', category: 'study', price: 110, size: { w: 5, h: 8 }, surfaces: ['desk', 'shelf'], layer: 'deskObj', maxQty: 1, art: 'emoji' },
  { id: 'pencil_cup', name: 'Cốc bút', emoji: '✏️', category: 'study', price: 35, size: { w: 3, h: 6 }, surfaces: ['desk'], layer: 'deskObj', maxQty: 1, art: 'pencil_cup' },

  // ---------- ÁNH SÁNG ----------
  { id: 'desk_lamp', name: 'Đèn bàn vàng', emoji: '💡', category: 'lighting', price: 100, size: { w: 5, h: 11 }, surfaces: ['desk'], layer: 'light', maxQty: 1, catEffect: 'light', art: 'desk_lamp', lamp: true },
  { id: 'floor_lamp', name: 'Đèn cây', emoji: '🪔', category: 'lighting', price: 180, size: { w: 8, h: 32 }, surfaces: ['floor'], layer: 'light', maxQty: 1, catEffect: 'light', art: 'floor_lamp', lamp: true },
  { id: 'string_lights', name: 'Dây đèn nhấp nháy', emoji: '✨', category: 'lighting', price: 140, size: { w: 30, h: 6 }, surfaces: ['wall'], layer: 'wallDecor', maxQty: 1, art: 'string_lights', passable: true },
  { id: 'ceiling_lamp', name: 'Đèn trần', emoji: '🔆', category: 'lighting', price: 200, size: { w: 10, h: 12 }, surfaces: ['ceiling'], layer: 'light', maxQty: 1, art: 'ceiling_lamp', lamp: true },
  { id: 'star_lamp', name: 'Đèn ngôi sao', emoji: '⭐', category: 'lighting', price: 95, size: { w: 4, h: 5 }, surfaces: ['desk', 'shelf'], layer: 'light', maxQty: 2, art: 'emoji', lamp: true },

  // ---------- TRANG TRÍ ----------
  { id: 'poster', name: 'Poster động lực', emoji: '📌', category: 'decor', price: 65, size: { w: 9, h: 13 }, surfaces: ['wall'], layer: 'wallDecor', maxQty: 3, art: 'poster' },
  { id: 'painting', name: 'Tranh phong cảnh', emoji: '🖼️', category: 'decor', price: 120, size: { w: 12, h: 11 }, surfaces: ['wall'], layer: 'wallDecor', maxQty: 2, art: 'painting' },
  { id: 'clock', name: 'Đồng hồ treo', emoji: '🕰️', category: 'decor', price: 70, size: { w: 7, h: 9 }, surfaces: ['wall'], layer: 'wallDecor', maxQty: 1, art: 'clock' },
  { id: 'calendar', name: 'Lịch treo tường', emoji: '📅', category: 'decor', price: 45, size: { w: 7, h: 9 }, surfaces: ['wall'], layer: 'wallDecor', maxQty: 1, art: 'emoji' },
  { id: 'candle', name: 'Nến thơm', emoji: '🕯️', category: 'decor', price: 55, size: { w: 3, h: 6 }, surfaces: ['desk', 'shelf'], layer: 'deskObj', maxQty: 2, art: 'emoji' },

  // ---------- CHO MÈO (phụ kiện đeo + đồ dùng) ----------
  { id: 'cat_bed', name: 'Ổ mèo bông', emoji: '🛏️', category: 'cat', price: 180, size: { w: 14, h: 8 }, surfaces: ['floor'], layer: 'furniture', maxQty: 1, provides: 'bed', surfaceTop: 0.35, catEffect: 'sleep', art: 'cat_bed', rotatable: false },
  { id: 'headphone', name: 'Tai nghe cho mèo', emoji: '🎧', category: 'cat', price: 200, price2: null, accessory: true, maxQty: 1, art: 'emoji' },
  { id: 'bow', name: 'Nơ hồng cho mèo', emoji: '🎀', category: 'cat', price: 120, accessory: true, maxQty: 1, art: 'emoji' },
  { id: 'crown', name: 'Vương miện nhỏ', emoji: '👑', category: 'cat', price: 300, accessory: true, maxQty: 1, art: 'emoji' },
  { id: 'glasses', name: 'Kính học bài', emoji: '👓', category: 'cat', price: 160, accessory: true, maxQty: 1, art: 'emoji' },

  // ---------- ĐỒ XINH ----------
  { id: 'teddy', name: 'Gấu bông', emoji: '🧸', category: 'cute', price: 150, size: { w: 6, h: 9 }, surfaces: ['floor', 'shelf', 'sofa'], layer: 'cute', maxQty: 2, art: 'emoji' },
  { id: 'mug', name: 'Cốc trà ấm', emoji: '☕', category: 'cute', price: 40, size: { w: 3, h: 4 }, surfaces: ['desk'], layer: 'deskObj', maxQty: 2, art: 'mug', steam: true },
  { id: 'cookie', name: 'Đĩa bánh quy', emoji: '🍪', category: 'cute', price: 45, size: { w: 4, h: 3 }, surfaces: ['desk'], layer: 'deskObj', maxQty: 1, art: 'emoji' },
  { id: 'radio', name: 'Radio cổ', emoji: '📻', category: 'cute', price: 130, size: { w: 6, h: 6 }, surfaces: ['shelf', 'desk'], layer: 'deskObj', maxQty: 1, art: 'emoji' },
  { id: 'bunny', name: 'Thỏ bông', emoji: '🐰', category: 'cute', price: 130, size: { w: 5, h: 8 }, surfaces: ['shelf', 'floor', 'sofa'], layer: 'cute', maxQty: 2, art: 'emoji' },

  // ---------- PHONG CÁCH PHÒNG ----------
  { id: 'theme_matcha', name: 'Matcha Room', emoji: '🍵', category: 'theme', price: 250, theme: 'matcha', maxQty: 1 },
  { id: 'theme_sunset', name: 'Sunset Room', emoji: '🌇', category: 'theme', price: 250, theme: 'sunset', maxQty: 1 },
  { id: 'theme_night', name: 'Night Study', emoji: '🌙', category: 'theme', price: 300, theme: 'night', maxQty: 1 },
];

const byId = new Map(ITEMS.map((i) => [i.id, i]));
export function getItemDef(id) { return byId.get(id) || null; }
export function itemsInCategory(cat) { return ITEMS.filter((i) => i.category === cat); }
export function isPlaceable(def) { return !!(def && def.size && def.surfaces); }

/** Cấu hình phòng khởi đầu: đồ starter đã được đặt sẵn (đúng surface) */
export function starterRoom() {
  return {
    theme: 'cream',
    owned: { desk: 1, chair: 1, bookshelf: 1, plant_small: 1, books: 1 },
    placed: [
      { uid: 'st-desk', itemId: 'desk', x: 52, y: 86, surface: 'floor', rot: 0, zOff: 0 },
      { uid: 'st-chair', itemId: 'chair', x: 52, y: 92, surface: 'floor', rot: 0, zOff: 0 },
      { uid: 'st-shelf', itemId: 'bookshelf', x: 82, y: 34, surface: 'wall', rot: 0, zOff: 0 },
      { uid: 'st-plant', itemId: 'plant_small', x: 40, y: 65.8, surface: 'desk', parent: 'st-desk', rot: 0, zOff: 0 },
      { uid: 'st-books', itemId: 'books', x: 76, y: 19.6, surface: 'shelf', parent: 'st-shelf', rot: 0, zOff: 0 },
    ],
    lampOverride: null,   // null = tự động theo giờ, true/false = người dùng bật/tắt
    weather: 'auto',      // auto | sunny | cloudy | rain
    presets: [],
    version: 2,
  };
}
