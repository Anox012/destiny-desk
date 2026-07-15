/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  // ปิด Preflight (CSS reset ของ Tailwind) กันไปทับสไตล์ plain-CSS เดิมของทั้งแอป
  // เพราะ Tailwind ใช้เฉพาะใน TarotFan เท่านั้น ส่วนที่เหลือยังใช้ globals.css แบบเดิม
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {},
  },
  plugins: [],
};
