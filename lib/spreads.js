// ============================================================================
// รูปแบบการวางไพ่ (Spreads)
//  - single : 1 ใบ (Daily Draw)
//  - three  : 3 ใบ (อดีต - ปัจจุบัน - อนาคต)
//  - celtic : 10 ใบ (Celtic Cross)
//
// แต่ละตำแหน่ง (position) มีความหมายกำกับ และมีพิกัด (x, y) หน่วยเป็น %
// สำหรับจัดวางบนกระดาน Celtic Cross ให้ตรงตามผังคลาสสิก
// rotate = true คือไพ่ที่วางขวางทับ (ตำแหน่งที่ 2)
// ============================================================================

export const PURPOSES = [
  { id: "love",   label: "Love & Relationship", th: "ความรักและความสัมพันธ์" },
  { id: "career", label: "Career & Success",    th: "การงานและความสำเร็จ" },
  { id: "self",   label: "Self-Discovery",      th: "สำรวจตัวเอง (Tarot Therapy)" },
];

export const SPREADS = {
  single: {
    id: "single",
    label: "Daily Draw",
    th: "ไพ่รายวัน 1 ใบ",
    count: 1,
    positions: [
      { key: 1, th: "พลังงานของวันนี้ / คำตอบของคุณ" },
    ],
  },

  // สเปรดเฉพาะหัวข้อ 5 ใบ — ตำแหน่งเปลี่ยนตามเรื่องที่ผู้ใช้เลือก (love/career/self)
  loveSpread: {
    id: "loveSpread",
    label: "สเปรดความรัก",
    th: "สเปรดความรัก (5 ใบ)",
    count: 5,
    purpose: "love",
    positions: [
      { key: 1, th: "ตัวเธอในความสัมพันธ์นี้" },
      { key: 2, th: "ใจของอีกฝ่าย" },
      { key: 3, th: "สถานการณ์ระหว่างเราตอนนี้" },
      { key: 4, th: "สิ่งที่ควรทำ / คำแนะนำ" },
      { key: 5, th: "ทิศทางที่ความสัมพันธ์จะไป" },
    ],
  },

  careerSpread: {
    id: "careerSpread",
    label: "สเปรดการงาน",
    th: "สเปรดการงาน (5 ใบ)",
    count: 5,
    purpose: "career",
    positions: [
      { key: 1, th: "สถานการณ์งานตอนนี้" },
      { key: 2, th: "จุดแข็งที่ช่วยเธอได้" },
      { key: 3, th: "อุปสรรค / สิ่งที่ต้องระวัง" },
      { key: 4, th: "สิ่งที่ควรลงมือทำ" },
      { key: 5, th: "ผลลัพธ์ที่กำลังจะมา" },
    ],
  },

  selfSpread: {
    id: "selfSpread",
    label: "สเปรดสำรวจใจ",
    th: "สเปรดสำรวจใจ (5 ใบ)",
    count: 5,
    purpose: "self",
    positions: [
      { key: 1, th: "ตัวตนของเธอตอนนี้" },
      { key: 2, th: "สิ่งที่อยู่ลึกๆ ในใจ" },
      { key: 3, th: "สิ่งที่กำลังฉุดรั้งเธอ" },
      { key: 4, th: "สิ่งที่ควรปล่อยวาง" },
      { key: 5, th: "ทางเติบโต / ก้าวต่อไป" },
    ],
  },

  celtic: {
    id: "celtic",
    label: "Celtic Cross",
    th: "เซลติกครอส (10 ใบ)",
    count: 10,
    // พิกัดเป็นเปอร์เซ็นต์ของกระดาน (0-100)
    positions: [
      { key: 1,  th: "ตัวคุณเป็นเช่นไรในช่วงนี้",              x: 33, y: 45 },
      // labelBelow: ป้ายชื่อวางใต้ไพ่ (กันทับกับป้ายของตำแหน่ง 1 ที่พิกัดเดียวกัน)
      // y ขยับลง ~3.7% (36px ของบอร์ด 980px) ชดเชยป้ายที่ย้ายลงใต้ไพ่ ให้ไพ่ขวางทับกลางใบ 1 พอดี
      { key: 2,  th: "สถานการณ์ในช่วงนี้ สิ่งที่เข้ามากระทบ",   x: 33, y: 48.7, rotate: true, labelBelow: true },
      { key: 3,  th: "อนาคตจะเป็นเช่นไร (เจ้านาย/ผู้ใหญ่)",     x: 33, y: 14 },
      { key: 4,  th: "ความเป็นอยู่ในช่วงที่ผ่านมา",            x: 52, y: 45 },
      { key: 5,  th: "สิ่งที่ผ่านมาในอดีต (ลูกน้อง/บริวาร)",    x: 33, y: 76 },
      { key: 6,  th: "สิ่งที่จะเกิดขึ้นในอนาคต",               x: 14, y: 45 },
      { key: 7,  th: "แนวทางในการแก้ไขปัญหา",                 x: 78, y: 78 },
      { key: 8,  th: "คนที่อยู่รอบ ๆ ตัว เพื่อน ครอบครัว",     x: 78, y: 57 },
      { key: 9,  th: "ความคิดภายในใจ สิ่งที่คาดหวังไว้",       x: 78, y: 36 },
      { key: 10, th: "บทสรุป",                               x: 78, y: 15 },
    ],
  },
};

export function getSpread(id) {
  return SPREADS[id] || SPREADS.single;
}

// สเปรด 5 ใบเฉพาะหัวข้อของแต่ละ purpose
const THEMED_BY_PURPOSE = {
  love: "loveSpread",
  career: "careerSpread",
  self: "selfSpread",
};
export function getThemedSpread(purposeId) {
  return SPREADS[THEMED_BY_PURPOSE[purposeId]] || SPREADS.loveSpread;
}

// เมนูรูปแบบไพ่ตามหัวข้อที่เลือก: รายวัน 1 ใบ · สเปรดเฉพาะหัวข้อ 5 ใบ · ภาพรวมชีวิต 10 ใบ
export function spreadOptionsFor(purposeId) {
  return [SPREADS.single, getThemedSpread(purposeId), SPREADS.celtic];
}
