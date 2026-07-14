// ============================================================================
// สคริปต์จัดระเบียบรูปไพ่
// อ่านไฟล์รูปเดิม (ชื่อยาว ๆ ที่วางไว้ในโฟลเดอร์โปรเจกต์) แล้วคัดลอกไปไว้ที่
// public/tarotimages/ โดยเปลี่ยนชื่อเป็นเลขไพ่ เช่น 0.png, 24.png ...
//
// วิธีใช้:   npm run organize-images
// ============================================================================

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "public", "tarotimages");

fs.mkdirSync(OUT, { recursive: true });

// ---- ตารางแมป: ชื่อไฟล์ต้นทาง -> เลขไพ่ ----
const map = {};

// รองรับไฟล์ที่ตั้งชื่อเป็นเลขไพ่อยู่แล้ว (0..79) ทั้ง .png / .PNG / .jpg / .jpeg / .webp
for (let n = 0; n <= 79; n++) {
  for (const ext of ["png", "PNG", "jpg", "JPG", "jpeg", "webp"]) {
    map[`${n}.${ext}`] = n;
  }
}

// Major Arcana 0..21 (ไฟล์ .PNG สำหรับ 0-9, .png สำหรับ 10-21)
for (let n = 0; n <= 9; n++) map[`${n}.PNG`] = n;
for (let n = 10; n <= 21; n++) map[`${n}.png`] = n;

// Wands 24..37
Object.assign(map, {
  "ace of wand.png": 24,
  "2ofwand.png": 25,
  "3ofwand.png": 26,
  "4ofwand.png": 27,
  "5ofwand.png": 28,
  "6ofwand.png": 29,
  "7ofwand.png": 30,
  "8ofwand.png": 31,
  "9ofwand.png": 32,
  "10ofwand.png": 33,
  "pageofwand.png": 34,
  "knightofwand.png": 35,
  "queenofwand.png": 36,
  "kingofwand.png": 37,
});

// Cups 38..51
Object.assign(map, {
  "aceof cup.png": 38,
  "2ofcup.png": 39,
  "3ofcup.png": 40,
  "4ofcup.png": 41,
  "5ofcups.png": 42,
  "6of cups.png": 43,
  "7ofcups.png": 44,
  "8ofcups.png": 45,
  "9ofcups.png": 46,
  "10ofcups.png": 47,
  "page of cup.png": 48,
  "knight of cup.png": 49,
  "queenof cup.png": 50,
  "king of cup.png": 51,
});

// Swords 52..62 (ที่มีอยู่)
Object.assign(map, {
  "aceofsword.png": 52,
  "2of sword.png": 53,
  "3of sword.png": 54,
  "4of sword.png": 55,
  "5of sword.png": 56,
  "6of sword.png": 57,
  "7 of sword.png": 58,
  "8 of sword.png": 59,
  "9of sword.png": 60,
  "10 of sword.png": 61,
  "page of sword.png": 62,
});

let copied = 0;
const missing = [];

for (const [src, num] of Object.entries(map)) {
  const from = path.join(ROOT, src);
  if (fs.existsSync(from)) {
    fs.copyFileSync(from, path.join(OUT, `${num}.png`));
    copied++;
  } else {
    missing.push(`${src} -> ${num}`);
  }
}

// ตรวจว่าเลขไพ่ใดยังไม่มีรูป (0..79)
const have = new Set(
  fs
    .readdirSync(OUT)
    .map((f) => parseInt(f, 10))
    .filter((n) => !Number.isNaN(n))
);
const noImage = [];
for (let n = 0; n < 80; n++) if (!have.has(n)) noImage.push(n);

console.log(`\n✓ คัดลอกรูปสำเร็จ ${copied} ไฟล์ ไปที่ public/tarotimages/`);
if (missing.length) {
  console.log(`\n⚠ ไม่พบไฟล์ต้นทาง (${missing.length}):`);
  missing.forEach((m) => console.log("   - " + m));
}
if (noImage.length) {
  console.log(`\nℹ เลขไพ่ที่ยังไม่มีรูป (จะแสดงหลังไพ่แทน): ${noImage.join(", ")}`);
  console.log(
    "  หากมีรูปเพิ่ม ให้ตั้งชื่อเป็น <เลขไพ่>.png หรือ .jpg แล้ววางใน public/tarotimages/"
  );
}
console.log("");
