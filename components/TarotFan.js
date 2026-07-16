"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// โหลดหน้าไพ่: ลอง .jpg -> .png -> ถ้าไม่มีให้ใช้สีพื้นแทน
function FaceImg({ id }) {
  const [step, setStep] = useState(0);
  const sources = [`/tarotimages/${id}.jpg`, `/tarotimages/${id}.png`];
  if (step >= sources.length) {
    return <div className="h-full w-full bg-gradient-to-br from-indigo-950 to-purple-950" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={sources[step]}
      alt={`card ${id}`}
      onError={() => setStep((s) => s + 1)}
      className="h-full w-full object-cover"
      draggable={false}
    />
  );
}

function CardBack() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-950 via-purple-900 to-indigo-950">
      <span className="text-3xl text-indigo-200 drop-shadow-[0_0_8px_rgba(165,180,252,0.65)]">✷</span>
    </div>
  );
}

// เส้นโค้งขนาด/ความจาง/ความจม ตามระยะห่างจากใบกลาง (|offset| = 0..4+)
const CURVE = [
  { scale: 1.15, opacity: 1, ty: -18 }, // ใบกลาง: เด่นสุด ลอยขึ้น
  { scale: 0.92, opacity: 0.85, ty: 8 },
  { scale: 0.8, opacity: 0.6, ty: 18 },
  { scale: 0.68, opacity: 0.35, ty: 26 },
  { scale: 0.58, opacity: 0.08, ty: 32 }, // บัฟเฟอร์นอกจอ ให้เข้า/ออกลื่น ไม่โผล่มาแบบสะดุด
];
const ROTATE_STEP = 9; // องศาต่อใบ (คงที่ตามสเปก)
const WINDOW = 4; // เรนเดอร์ล่วงหน้ารอบ ๆ ใบกลาง กันการ enter/exit กระตุก

// แปลงเลข 1–10 เป็นเลขโรมัน (ใช้บอกลำดับที่เลือก ไม่เกี่ยวกับหมายเลขไพ่)
function toRoman(n) {
  const map = [
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let out = "";
  for (const [v, s] of map) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out;
}

/**
 * TarotFan — พัดไพ่ทาโรต์ ใบกลางเด่นสุด เลื่อนด้วยลูกศร/ปัดนิ้ว แตะใบกลางเพื่อเลือก
 *
 * props:
 *  - deck: number[] รายชื่อ id ไพ่ทั้งกอง (ลำดับที่จะเลื่อนดู)
 *  - maxSelect: จำนวนใบที่ต้องเลือกให้ครบ
 *  - positions: (optional) ป้ายชื่อแต่ละช่อง เช่น spread.positions [{th}]
 *  - onConfirm: (selectedIds: number[]) => void — เรียกตอนกดยืนยัน
 */
export default function TarotFan({ deck, maxSelect, positions, onConfirm }) {
  const [centerIndex, setCenterIndex] = useState(Math.floor(deck.length / 2));
  const [selectedIds, setSelectedIds] = useState([]);
  const [boxW, setBoxW] = useState(360); // ความกว้างจริงของกล่องพัดไพ่ (วัดเอง ให้พอดีจอเสมอ)
  const wrapRef = useRef(null);
  const touchStartX = useRef(null);
  const prevSelectedLen = useRef(0);

  // เลื่อนไปใบถัดไปอัตโนมัติทุกครั้งที่จำนวนที่เลือกเพิ่มขึ้น (ไม่ใช่ตอนลดเพราะกดยกเลิก)
  // ผูกกับ selectedIds.length โดยตรงแทนอ่านค่าจาก closure ใน handler กันปัญหา stale state ตอนกดรัว ๆ
  useEffect(() => {
    if (selectedIds.length > prevSelectedLen.current && selectedIds.length < maxSelect) {
      setCenterIndex((ci) => Math.min(ci + 1, deck.length - 1));
    }
    prevSelectedLen.current = selectedIds.length;
  }, [selectedIds, maxSelect, deck.length]);

  // วัดความกว้างจริงของกล่อง แล้วคำนวณขนาดไพ่/ระยะห่างให้พัดพอดีจอเสมอ (มือถือ/เดสก์ท็อป)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setBoxW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("orientationchange", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  // ลูกศรซ้าย/ขวาบนคีย์บอร์ด (เดสก์ท็อป)
  useEffect(() => {
    function onKey(e) {
      if (e.key === "ArrowLeft") setCenterIndex((ci) => Math.max(0, ci - 1));
      if (e.key === "ArrowRight") setCenterIndex((ci) => Math.min(deck.length - 1, ci + 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deck.length]);

  // ไพ่ใบกลาง = ~30% ของความกว้างกล่อง (จำกัด 70–132px), UNIT คำนวณให้ใบนอกสุด (offset ±WINDOW)
  // ไม่ล้นขอบกล่อง: WINDOW*UNIT + CARD_W/2 <= boxW/2 - margin → พัดพอดีจอ ปัดซ้ายขวาได้ลื่น
  const CARD_W = Math.round(Math.max(70, Math.min(132, boxW * 0.3)));
  const CARD_H = Math.round(CARD_W * 1.5);
  const UNIT = Math.max(16, Math.min(51, Math.floor((boxW / 2 - CARD_W / 2 - 10) / WINDOW)));
  const containerHeight = CARD_H + 90;

  function goPrev() {
    setCenterIndex((ci) => Math.max(0, ci - 1));
  }
  function goNext() {
    setCenterIndex((ci) => Math.min(deck.length - 1, ci + 1));
  }

  function onTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e) {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    const THRESHOLD = 40;
    if (dx > THRESHOLD) goPrev();
    else if (dx < -THRESHOLD) goNext();
  }

  function handleCenterTap(id) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev; // เลือกแล้วกดปิดกลับ/เลือกซ้ำไม่ได้
      if (prev.length >= maxSelect) return prev;
      return [...prev, id];
    });
  }

  const items = [];
  for (let offset = -WINDOW; offset <= WINDOW; offset++) {
    const idx = centerIndex + offset;
    if (idx < 0 || idx >= deck.length) continue;
    items.push({ offset, id: deck[idx] });
  }

  const canConfirm = selectedIds.length === maxSelect;

  return (
    <div ref={wrapRef} className="mx-auto w-full max-w-3xl select-none">
      {/* overflow-hidden = ไพ่ที่ล้นขอบถูกตัด ไม่ดันให้จอเลื่อนแนวนอน;
          touch-pan-y = เบราว์เซอร์จับเฉพาะการเลื่อนแนวตั้ง ปล่อยการปัดซ้ายขวาให้ handler เราจัดการ */}
      <div
        className="relative mx-auto overflow-hidden touch-pan-y"
        style={{ height: containerHeight }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <button
          type="button"
          onClick={goPrev}
          disabled={centerIndex <= 0}
          aria-label="ไพ่ใบก่อนหน้า"
          className="absolute left-0 top-1/2 z-[60] -translate-y-1/2 rounded-full border border-indigo-300/40 bg-indigo-950/70 p-2 text-indigo-100 backdrop-blur transition hover:bg-indigo-900 disabled:opacity-20 disabled:pointer-events-none"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={centerIndex >= deck.length - 1}
          aria-label="ไพ่ใบถัดไป"
          className="absolute right-0 top-1/2 z-[60] -translate-y-1/2 rounded-full border border-indigo-300/40 bg-indigo-950/70 p-2 text-indigo-100 backdrop-blur transition hover:bg-indigo-900 disabled:opacity-20 disabled:pointer-events-none"
        >
          <ChevronRight size={20} />
        </button>

        {items.map(({ offset, id }) => {
          const abs = Math.abs(offset);
          const { scale, opacity, ty } = CURVE[Math.min(abs, CURVE.length - 1)];
          const tx = offset * UNIT;
          const rot = offset * ROTATE_STEP;
          const isCenter = offset === 0;
          const isRevealed = selectedIds.includes(id);
          const order = isRevealed ? selectedIds.indexOf(id) + 1 : 0; // ลำดับที่เลือก (1-based)
          return (
            <div
              key={id}
              className="absolute bottom-0 left-1/2 transition-transform duration-[350ms] ease-out"
              style={{
                width: CARD_W,
                height: CARD_H,
                transform: `translateX(calc(-50% + ${tx}px)) translateY(${ty}px) rotate(${rot}deg) scale(${scale})`,
                transformOrigin: "50% 100%",
                opacity,
                zIndex: 50 - abs,
                transitionProperty: "transform, opacity",
                cursor: isCenter && !isRevealed ? "pointer" : "default",
              }}
              onClick={() => isCenter && handleCenterTap(id)}
            >
              <div
                className={`h-full w-full overflow-hidden rounded-xl border-2 shadow-xl transition-colors duration-300 ${
                  isRevealed
                    ? "border-amber-300 shadow-amber-400/30"
                    : "border-indigo-300/50 shadow-indigo-950/40"
                }`}
              >
                {isRevealed ? <FaceImg id={id} /> : <CardBack />}
              </div>
              {/* ป้ายเลขโรมันบอกลำดับที่เลือก (I, II, III...) ไม่เกี่ยวกับหมายเลขไพ่ */}
              {isRevealed && (
                <div className="pointer-events-none absolute left-1/2 top-0 z-20 flex h-9 min-w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-amber-100 bg-gradient-to-br from-amber-400 to-yellow-600 px-2 text-sm font-bold text-white shadow-md shadow-black/40">
                  {toRoman(order)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-start justify-center gap-4">
        {Array.from({ length: maxSelect }).map((_, i) => {
          const id = selectedIds[i];
          return (
            <div key={i} className="flex w-20 flex-col items-center gap-1.5">
              <span className="line-clamp-2 text-center text-[11px] font-semibold leading-tight text-indigo-900/70">
                <span className="text-amber-600">{toRoman(i + 1)}</span>{" "}
                {positions?.[i]?.th || `ใบที่ ${i + 1}`}
              </span>
              <div
                className={`flex h-28 w-20 items-center justify-center overflow-hidden rounded-lg border-2 bg-indigo-950/10 ${
                  id != null ? "border-indigo-400" : "border-dashed border-indigo-400/40"
                }`}
              >
                {id != null ? <FaceImg id={id} /> : <span className="text-lg font-bold text-indigo-400/50">{toRoman(i + 1)}</span>}
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        disabled={!canConfirm}
        onClick={() => canConfirm && onConfirm(selectedIds)}
        className="mx-auto mt-7 block rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-9 py-3 font-bold text-white shadow-lg shadow-purple-900/30 transition enabled:hover:scale-105 disabled:cursor-not-allowed disabled:opacity-30"
      >
        ยืนยันไพ่ที่เลือก ({selectedIds.length}/{maxSelect})
      </button>
    </div>
  );
}
