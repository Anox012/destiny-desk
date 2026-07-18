"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TOTAL_CARDS, getCardById } from "@/lib/cards";
import { SPREADS, PURPOSES, getSpread } from "@/lib/spreads";
import Starfield from "@/components/Starfield";
import DeskMooChat from "@/components/DeskMooChat";

// ---------------------------------------------------------------------------
// หน้าไพ่: ลองโหลด /tarotimages/{id}.jpg -> .png -> ถ้าไม่มีให้แสดงลายหลังไพ่
// ---------------------------------------------------------------------------
function CardFace({ id }) {
  const [step, setStep] = useState(0); // 0=jpg, 1=png, 2=fallback
  const sources = [`/tarotimages/${id}.jpg`, `/tarotimages/${id}.png`];

  if (step >= sources.length) {
    return (
      <div className="card-back">
        <span className="rune">✷</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={sources[step]} alt={`card ${id}`} onError={() => setStep((s) => s + 1)} />
  );
}

const STORAGE_KEY = "destiny-desk-journal";
// ไพ่ 10 ใบ (เซลติกครอส) = ดูภาพรวมชีวิตช่วงนั้น เปิดได้เดือนละครั้ง (1 เดือน)
const CELTIC_KEY = "destiny-desk-celtic-at";
const CELTIC_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

function shuffleIds() {
  const pool = [...Array(TOTAL_CARDS).keys()];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

// ---------------------------------------------------------------------------
// ตัวช่วยสร้างรูปแชร์ (วาดไพ่ + คำทำนายลง canvas แล้วส่งออกเป็นไฟล์ภาพ)
// ---------------------------------------------------------------------------
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("load failed"));
    img.src = src;
  });
}

// โหลดรูปไพ่: ลอง .jpg -> .png -> ถ้าไม่มีคืน null (ไปวาดหลังไพ่แทน)
async function loadCardImage(id) {
  try {
    return await loadImage(`/tarotimages/${id}.jpg`);
  } catch (_) {
    try {
      return await loadImage(`/tarotimages/${id}.png`);
    } catch (_) {
      return null;
    }
  }
}

// ตัดข้อความขึ้นบรรทัดใหม่ให้พอดีความกว้าง — ไล่ทีละอักขระ (รองรับไทยที่ไม่มีเว้นวรรคระหว่างคำ)
function wrapLines(ctx, text, maxWidth) {
  const out = [];
  for (const para of text.split("\n")) {
    if (para === "") {
      out.push("");
      continue;
    }
    let line = "";
    for (const ch of para) {
      if (line && ctx.measureText(line + ch).width > maxWidth) {
        out.push(line);
        line = ch;
      } else {
        line += ch;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export default function Home() {
  // ---------- แชตดูดวง: ถามทีละอย่าง (purpose -> count -> question -> pick -> reading) ----------
  const [step, setStep] = useState("purpose");
  const [question, setQuestion] = useState("");
  const [purpose, setPurpose] = useState(null); // null = ยังไม่เลือก
  const [spreadId, setSpreadId] = useState(null);

  // ---------- กองไพ่ (สำหรับเลื่อนดูใน TarotFan) ----------
  const [deckOrder, setDeckOrder] = useState(() => [...Array(TOTAL_CARDS).keys()]);
  const [deckVersion, setDeckVersion] = useState(0); // เพิ่มค่าเพื่อบังคับ remount TarotFan ตอนเริ่มใหม่

  const [selected, setSelected] = useState([]); // [{id, name, th, pos}]
  const [popup, setPopup] = useState(null);
  const [toast, setToast] = useState("");
  const [journal, setJournal] = useState([]);

  // ---------- เสียง: คุมทั้งเสียงป๊อปในแชต + เสียงจากคลิปพื้นหลัง ----------
  const [soundOn, setSoundOn] = useState(true);
  const videoRef = useRef(null);

  // ---------- ทำนายด้วย AI (Gemini free tier) ----------
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [sharing, setSharing] = useState(false);

  // ---------- ถามต่อในแชต (จำกัดจำนวน กันโควต้าฟรีหมดเร็ว) ----------
  const MAX_FOLLOW_UPS = 5;
  const [followUps, setFollowUps] = useState([]); // [{ q, cards, a }]
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followSpread, setFollowSpread] = useState(null); // รูปแบบไพ่ที่เลือกสำหรับคำถามต่อ

  // ---------- ล็อกไพ่ 10 ใบ (ดูภาพรวมช่วง 3 เดือน เปิดได้ครั้งเดียวต่อ 3 เดือน) ----------
  const [celticLockedUntil, setCelticLockedUntil] = useState(0);

  const spread = useMemo(() => (spreadId ? getSpread(spreadId) : null), [spreadId]);
  const purposeObj = purpose ? PURPOSES.find((p) => p.id === purpose) : null;

  const toastTimer = useRef(null);

  // สับไพ่ครั้งแรกฝั่ง client เท่านั้น (กัน hydration mismatch จาก Math.random)
  useEffect(() => {
    setDeckOrder(shuffleIds());
  }, []);

  // โหลดประวัติ + เวลาที่เปิดไพ่ 10 ใบล่าสุด จาก LocalStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setJournal(JSON.parse(raw));
      const at = Number(localStorage.getItem(CELTIC_KEY));
      if (at) setCelticLockedUntil(at + CELTIC_COOLDOWN_MS);
    } catch (_) {}
  }, []);

  // เคลียร์ timer ตอนเลิกใช้หน้า
  useEffect(() => {
    return () => clearTimeout(toastTimer.current);
  }, []);

  // เสียงคลิปพื้นหลัง: เบราว์เซอร์บล็อกเสียงจนกว่าจะมี user gesture
  // -> เริ่มเล่นแบบเงียบ (autoplay ได้) แล้วค่อยเปิดเสียงตอนผู้ใช้แตะครั้งแรก (ถ้าเปิดเสียงอยู่)
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.muted = true; // เริ่มเงียบเสมอ ให้ autoplay ผ่านก่อน
    function unlock() {
      const vid = videoRef.current;
      if (vid) {
        vid.muted = !soundOn;
        vid.play().catch(() => {});
      }
      window.removeEventListener("pointerdown", unlock);
    }
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // กดปุ่มเปิด/ปิดเสียง -> ปรับทั้งคลิปพื้นหลัง (การกดปุ่มถือเป็น gesture เปิดเสียงได้)
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !soundOn;
    if (soundOn) v.play().catch(() => {});
  }, [soundOn]);

  // เข้าขั้นอ่านผล -> ให้ DeskMoo ทำนายเต็มๆ อัตโนมัติ (ไม่ต้องกดปุ่ม)
  useEffect(() => {
    if (step === "reading" && selected.length > 0 && !aiText && !aiLoading && !aiError) {
      requestAiReading();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function showToast(msg) {
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }

  // ---------- ตอบทีละขั้นในแชต ----------
  function pickPurpose(id) {
    setPurpose(id);
    setStep("count");
  }
  function pickSpread(id) {
    if (id === "celtic" && Date.now() < celticLockedUntil) return; // 10 ใบยังล็อกอยู่
    setSpreadId(id);
    // ไพ่ 10 ใบ = ดูภาพรวมชีวิตอย่างเดียว ไม่ต้องพิมพ์คำถาม เข้าเลือกไพ่เลย
    if (id === "celtic") {
      setQuestion("");
      setStep("pick");
    } else {
      setStep("question");
    }
  }
  function submitQuestion(text) {
    setQuestion(text || "");
    setStep("pick");
  }

  // ---------- ยืนยันไพ่ที่เลือกจาก TarotFan ----------
  function handleFanConfirm(ids) {
    if (step === "reading") return; // กันกดยืนยันซ้ำ
    const picked = ids.map((id, i) => ({ ...getCardById(id), pos: spread.positions[i] }));
    // ไพ่ 10 ใบ = เริ่มนับคูลดาวน์ 1 เดือน
    if (spreadId === "celtic") {
      const now = Date.now();
      try {
        localStorage.setItem(CELTIC_KEY, String(now));
      } catch (_) {}
      setCelticLockedUntil(now + CELTIC_COOLDOWN_MS);
    }
    setSelected(picked);
    setStep("reading");
    saveToJournal(picked);
  }

  // ---------- เริ่มใหม่: เริ่มบทสนทนาใหม่ทั้งหมด ----------
  function handleClearDeck() {
    setPopup(null);
    setStep("purpose");
    setPurpose(null);
    setSpreadId(null);
    setQuestion("");
    setSelected([]);
    setAiText("");
    setAiError("");
    setAiLoading(false);
    setFollowUps([]);
    setFollowUpLoading(false);
    setFollowSpread(null);
    setDeckOrder(shuffleIds());
    setDeckVersion((v) => v + 1);
  }

  function saveToJournal(picked) {
    const entry = {
      at: new Date().toISOString(),
      name: "",
      purpose: purposeObj?.label,
      spread: spread.label,
      cards: picked.map((c) => c.name),
    };
    const next = [entry, ...journal].slice(0, 30);
    setJournal(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (_) {}
  }

  function clearJournal() {
    setJournal([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
    showToast("ล้างประวัติแล้ว");
  }

  // คัดลอกแบบ synchronous (กันปัญหา clipboard โดน cancel ตอนโฟกัสย้าย)
  function copyTextSync(text) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (_) {
      return false;
    }
  }

  // เนื้อความสำหรับแชร์: ถ้ากดทำนาย AI แล้วใช้คำทำนาย AI, ไม่งั้นใช้ความหมายไพ่
  function shareBodyText() {
    if (aiText) return aiText.replace(/\*\*/g, "").replace(/\*/g, "");
    return selected
      .map((c, i) => `${i + 1}. ${c.name}${c.pos?.th ? ` — ${c.pos.th}` : ""}\n${c.th}`)
      .join("\n\n");
  }

  // ---------- วาดรูปแชร์ (ไพ่ + คำทำนาย) ลง canvas แล้วคืนเป็น Blob ----------
  async function buildShareImage() {
    const W = 1080;
    const pad = 64;
    const contentW = W - pad * 2;
    const heading = aiText ? "คำทำนายจาก AI" : "ความหมายไพ่";
    const body = shareBodyText();

    const imgs = await Promise.all(selected.map((c) => loadCardImage(c.id)));

    // จัดไพ่เป็นแถว (1–3 ใบ = แถวเดียว, มากกว่านั้นแบ่ง 3–5 ใบต่อแถว)
    const n = selected.length;
    const perRow = n <= 3 ? n : n <= 6 ? 3 : 5;
    const cgap = 20;
    const cardW = Math.min(300, Math.floor((contentW - (perRow - 1) * cgap) / perRow));
    const cardH = Math.round(cardW * 1.5);
    const rows = Math.ceil(n / perRow);

    const canvas = document.createElement("canvas");
    canvas.width = W;
    let ctx = canvas.getContext("2d");

    const BODY_FONT = '30px "Noto Sans Thai", "Noto Sans", sans-serif';
    const bodyLineH = 46;
    ctx.font = BODY_FONT;
    const bodyLines = wrapLines(ctx, body, contentW);

    // คำนวณความสูงรวมก่อนตั้งขนาดจริง
    let h = pad;
    h += 66; // ชื่อแอป
    h += 44; // รูปแบบการวางไพ่
    h += 24; // เว้น
    h += rows * (cardH + 44); // ไพ่ + ชื่อไพ่ใต้ใบ
    h += 24; // เว้น
    h += 2 + 34; // เส้นคั่น + เว้น
    h += 46; // หัวข้อคำทำนาย
    h += bodyLines.length * bodyLineH;
    h += 40; // เว้นก่อน footer
    h += 34; // footer
    const H = Math.round(h + pad);

    canvas.height = H;
    ctx = canvas.getContext("2d"); // เปลี่ยน height ล้าง context ต้องตั้งใหม่

    // พื้นหลังม่วงคราม ขลังๆ
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#251b57");
    grad.addColorStop(1, "#3c1a63");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    let y = pad;
    ctx.textAlign = "center";

    // ชื่อแอป
    ctx.fillStyle = "#f3e3b0";
    ctx.font = 'bold 46px Georgia, "Noto Sans Thai", serif';
    ctx.fillText("✷ Destiny Desk ✷", W / 2, y + 46);
    y += 66;

    // รูปแบบการวางไพ่
    ctx.fillStyle = "#d9cff0";
    ctx.font = '28px "Noto Sans Thai", sans-serif';
    ctx.fillText(spread.th, W / 2, y + 30);
    y += 44 + 24;

    // ไพ่
    for (let r = 0; r < rows; r++) {
      const rowCards = selected.slice(r * perRow, (r + 1) * perRow);
      const rowW = rowCards.length * cardW + (rowCards.length - 1) * cgap;
      let x = (W - rowW) / 2;
      for (let k = 0; k < rowCards.length; k++) {
        const idx = r * perRow + k;
        const img = imgs[idx];
        ctx.save();
        roundRectPath(ctx, x, y, cardW, cardH, 14);
        ctx.clip();
        if (img) {
          ctx.drawImage(img, x, y, cardW, cardH);
        } else {
          ctx.fillStyle = "#1a1440";
          ctx.fillRect(x, y, cardW, cardH);
        }
        ctx.restore();
        roundRectPath(ctx, x, y, cardW, cardH, 14);
        ctx.strokeStyle = "#d4af37";
        ctx.lineWidth = 3;
        ctx.stroke();
        // ชื่อไพ่ใต้ใบ
        ctx.fillStyle = "#f3e3b0";
        ctx.font = '20px "Noto Sans Thai", sans-serif';
        ctx.fillText(selected[idx].name, x + cardW / 2, y + cardH + 28, cardW + 10);
        x += cardW + cgap;
      }
      y += cardH + 44;
    }
    y += 24;

    // เส้นคั่นทอง
    ctx.strokeStyle = "rgba(212,175,55,0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(W - pad, y);
    ctx.stroke();
    y += 2 + 34;

    // หัวข้อคำทำนาย
    ctx.fillStyle = "#f3e3b0";
    ctx.font = 'bold 34px "Noto Sans Thai", serif';
    ctx.fillText(heading, W / 2, y + 32);
    y += 46;

    // เนื้อคำทำนาย (ชิดซ้าย)
    ctx.textAlign = "left";
    ctx.fillStyle = "#f4f0ff";
    ctx.font = BODY_FONT;
    for (const line of bodyLines) {
      ctx.fillText(line, pad, y + 32);
      y += bodyLineH;
    }
    y += 40;

    // footer
    ctx.textAlign = "center";
    ctx.fillStyle = "#b7a9dd";
    ctx.font = '22px "Noto Sans Thai", sans-serif';
    ctx.fillText("คำทำนายเพื่อความบันเทิงและการสำรวจตัวเอง · Destiny Desk", W / 2, y + 22);

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/png");
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---------- แชร์ผลไพ่เป็นรูปภาพ (มีข้อความ/ดาวน์โหลดเป็น fallback) ----------
  async function shareResult() {
    if (selected.length === 0 || sharing) return;
    setSharing(true);
    try {
      const blob = await buildShareImage();
      const file = new File([blob], "destiny-desk-tarot.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "ผลไพ่ทาโรต์ของฉัน" });
      } else {
        downloadBlob(blob, "destiny-desk-tarot.png");
        showToast("บันทึกรูปคำทำนายแล้ว 📷 นำไปแชร์ให้เพื่อนได้เลย");
      }
    } catch (err) {
      if (err?.name === "AbortError") return; // ผู้ใช้กดยกเลิกเอง ไม่ต้องแจ้ง
      // สำรอง: แชร์/คัดลอกเป็นข้อความ ถ้าสร้างรูปหรือแชร์ไฟล์ไม่ได้
      const text = `🔮 ผลไพ่ทาโรต์ — ${spread.th}\n\n${shareBodyText()}\n\n— จาก Destiny Desk`;
      if (navigator.share) {
        navigator.share({ title: "ผลไพ่ทาโรต์ของฉัน", text }).catch(() => {});
      } else {
        const ok = copyTextSync(text);
        showToast(ok ? "คัดลอกผลไพ่แล้ว ✓ นำไปวางแชร์ได้เลย" : "แชร์ไม่สำเร็จ ลองใหม่อีกครั้ง");
      }
    } finally {
      setSharing(false);
    }
  }

  // ---------- ทำนายด้วย AI (เรียก API route ฝั่ง server ที่ต่อ Gemini free tier) ----------
  // แปลงรหัส error จาก API เป็นข้อความไทยที่บอกสาเหตุเจาะจง ให้ผู้ใช้/คนดูแลแก้ได้ตรงจุด
  function aiErrorMessage(code, detail) {
    // แนบเหตุผลจริงจาก Gemini (ถ้ามี) ต่อท้าย ช่วย debug เวลาปัญหาไม่ตรงกับที่คาด
    const suffix = detail ? ` [${detail}]` : "";
    switch (code) {
      case "no_api_key":
        return "ยังไม่ได้ตั้งค่า GEMINI_API_KEY — เจ้าของเว็บต้องเพิ่ม API key ใน Vercel (Settings → Environment Variables) แล้ว Redeploy";
      case "quota":
        // โควต้าเต็ม = ผู้ใช้ทั่วไปเจอได้ ใช้ข้อความอบอุ่นในโทนหมอดู ไม่โชว์ detail เทคนิค
        return "ตอนนี้มีคนขอคำทำนายเข้ามาเยอะมากค่ะ 🌙 ขอพักรับพลังสักครู่ เดี๋ยวค่อยกลับมาคุยกันใหม่นะคะ";
      case "gemini_error":
        return "เรียก Gemini ไม่สำเร็จ (อาจเพราะ API key ไม่ถูกต้อง/ยังไม่เปิดใช้ Generative Language API)" + suffix;
      default:
        return "ทำนายไม่สำเร็จตอนนี้ ลองใหม่อีกครั้งภายหลัง";
    }
  }

  async function requestAiReading() {
    if (selected.length === 0 || aiLoading) return;
    setAiLoading(true);
    setAiError("");
    try {
      const res = await fetch("/api/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: purposeObj?.label,
          question,
          spreadLabel: spread.label,
          cards: selected.map((c) => ({ name: c.name, pos: c.pos?.th, th: c.th })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.text) {
        setAiText(data.text);
        return;
      }
      const code = res.status === 429 ? "quota" : data.error || "unknown";
      setAiError(aiErrorMessage(code, data.detail));
    } catch (_) {
      setAiError(aiErrorMessage("unknown"));
    } finally {
      setAiLoading(false);
    }
  }

  // ---------- ถามต่อในแชต: เปลี่ยนเรื่องได้ เลือกจำนวนไพ่เอง แล้วเปิดไพ่ใหม่ให้คำถามนั้น ----------
  // พิมพ์คำถามต่อ -> ให้เลือกก่อนว่าจะเปิดกี่ใบ (ชิป 1/3/10 เหมือนตอนเริ่ม)
  function askFollowUp(q) {
    const text = (q || "").trim();
    if (!text || followUpLoading || followUps.length >= MAX_FOLLOW_UPS || !aiText) return;
    setFollowUps((prev) => [...prev, { q: text }]); // ยังไม่มีไพ่/คำตอบ รอเลือกจำนวน + เปิดไพ่
    setFollowSpread(null);
    setStep("followcount");
  }

  // เลือกจำนวนไพ่สำหรับคำถามต่อ -> สับกองใหม่ให้เปิดเอง
  function pickFollowSpread(id) {
    if (id === "celtic" && Date.now() < celticLockedUntil) return; // 10 ใบยังล็อกอยู่
    setFollowSpread(getSpread(id));
    setDeckOrder(shuffleIds());
    setDeckVersion((v) => v + 1);
    setStep("followpick");
  }

  // เปิดไพ่สำหรับคำถามต่อเสร็จ -> อ่านไพ่ที่เลือกตอบ
  async function confirmFollowCard(ids) {
    const sp = followSpread || getSpread("single");
    const cards = ids.map((id, i) => ({ ...getCardById(id), pos: sp.positions[i] }));
    const q = followUps[followUps.length - 1]?.q || "";
    // ถ้าถามต่อด้วยไพ่ 10 ใบ = เริ่มนับคูลดาวน์ 1 เดือนเหมือนกัน
    if (sp.id === "celtic") {
      const now = Date.now();
      try {
        localStorage.setItem(CELTIC_KEY, String(now));
      } catch (_) {}
      setCelticLockedUntil(now + CELTIC_COOLDOWN_MS);
    }
    setFollowUps((prev) => prev.map((f, i) => (i === prev.length - 1 ? { ...f, cards } : f)));
    setStep("reading");
    setFollowUpLoading(true);
    try {
      const res = await fetch("/api/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "followup",
          followUpQuestion: q,
          purpose: purposeObj?.label,
          spreadLabel: sp.th,
          cards: cards.map((c) => ({ name: c.name, pos: c.pos?.th, th: c.th })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      const answer =
        res.ok && data.text
          ? data.text
          : aiErrorMessage(res.status === 429 ? "quota" : data.error || "unknown", data.detail);
      setFollowUps((prev) => prev.map((f, i) => (i === prev.length - 1 ? { ...f, a: answer } : f)));
    } catch (_) {
      setFollowUps((prev) =>
        prev.map((f, i) => (i === prev.length - 1 ? { ...f, a: aiErrorMessage("unknown") } : f))
      );
    } finally {
      setFollowUpLoading(false);
    }
  }

  return (
    <main className="app">
      {/* ---------- วิดีโอพื้นหลัง (เล่นวน มีเสียงคลิป) + ม่านครีมบางๆ ให้อ่านง่าย ---------- */}
      {/* เริ่มเล่นแบบ muted ให้ autoplay ผ่าน แล้ว unlock เสียงตอนแตะครั้งแรก (ดู useEffect ด้านบน) */}
      <video ref={videoRef} className="bg-video" autoPlay loop muted playsInline aria-hidden="true">
        <source src="/video.mp4" type="video/mp4" />
      </video>
      <div className="bg-video-veil" aria-hidden="true" />
      <Starfield />
      <header className="app-header">
        <h1 className="app-title">Destiny Desk</h1>
        <p className="app-subtitle">โต๊ะไพ่ทาโรต์ส่วนตัว · หยิบไพ่ด้วยตัวคุณเอง</p>
      </header>
      <div className="gold-rule" />

      {/* ---------- แชตดูดวง DeskMoo ทั้งหน้า ---------- */}
      <section className="board-wrap">
        <DeskMooChat
          step={step}
          purposeLabel={purposeObj ? purposeObj.th : null}
          spreadLabel={spread ? spread.th : null}
          question={question}
          purposeOptions={PURPOSES}
          spreadOptions={Object.values(SPREADS)}
          celticLockedUntil={celticLockedUntil}
          deck={deckOrder}
          deckVersion={deckVersion}
          spreadCount={spread ? spread.count : 1}
          spreadPositions={spread ? spread.positions : []}
          followSpreadCount={followSpread ? followSpread.count : 1}
          followSpreadPositions={followSpread ? followSpread.positions : []}
          selected={selected}
          aiText={aiText}
          aiLoading={aiLoading}
          aiError={aiError}
          sharing={sharing}
          followUps={followUps}
          followUpLoading={followUpLoading}
          followUpsLeft={MAX_FOLLOW_UPS - followUps.length}
          soundOn={soundOn}
          onToggleSound={() => setSoundOn((s) => !s)}
          onPickPurpose={pickPurpose}
          onPickSpread={pickSpread}
          onSubmitQuestion={submitQuestion}
          onSkipQuestion={() => submitQuestion("")}
          onConfirmCards={handleFanConfirm}
          onAskFollowUp={askFollowUp}
          onPickFollowSpread={pickFollowSpread}
          onConfirmFollowCard={confirmFollowCard}
          onShare={shareResult}
          onRestart={handleClearDeck}
          onCardClick={(c, i) => c.pos?.key != null && setPopup({ ...c, idx: i })}
        />
      </section>

      {/* ---------- ประวัติการดูดวง (Tarot Journal) ---------- */}
      {journal.length > 0 && (
        <section className="journal">
          <h2 className="section-title">Tarot Journal (บันทึกในเครื่องคุณเท่านั้น)</h2>
          {journal.slice(0, 8).map((j, i) => (
            <div className="journal-item" key={i}>
              <div className="meta">
                {new Date(j.at).toLocaleString("th-TH")} · {j.spread} · {j.purpose}
              </div>
              <div className="cards">
                {j.name} — ไพ่: {j.cards.join(", ")}
              </div>
            </div>
          ))}
          <div className="actions">
            <button className="btn-ghost" onClick={clearJournal}>
              ล้างประวัติทั้งหมด
            </button>
          </div>
        </section>
      )}

      {/* ---------- คำเตือน ---------- */}
      <footer className="disclaimer">
        คำทำนายและความหมายของไพ่เป็นเพียงแนวทางเพื่อความบันเทิงและการสำรวจตัวเองเท่านั้น
        ไม่ใช่คำแนะนำทางกฎหมาย การแพทย์ การเงิน หรือการตัดสินใจสำคัญในชีวิต
        โปรดใช้วิจารณญาณและตัดสินใจด้วยตัวคุณเอง · ข้อมูลทั้งหมดถูกบันทึกไว้ในเครื่องของคุณเท่านั้น
      </footer>

      {/* ---------- Popup ความหมายไพ่ (celtic) ---------- */}
      {popup && (
        <div className="overlay" onClick={() => setPopup(null)}>
          <div className="popup" onClick={(e) => e.stopPropagation()}>
            <div className="popup-frame">
              <CardFace id={popup.id} />
            </div>
            <div className="popup-pos">
              {popup.pos.key}. {popup.pos.th}
            </div>
            <h3 className="popup-en">{popup.name}</h3>
            <p className="popup-th">{popup.th}</p>
            <button className="btn-copy" onClick={() => setPopup(null)}>
              ปิด
            </button>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
