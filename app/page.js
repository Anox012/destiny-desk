"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { CARDS, TOTAL_CARDS, getCardById } from "@/lib/cards";
import { SPREADS, PURPOSES, getSpread } from "@/lib/spreads";
import Starfield from "@/components/Starfield";

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

// ลายหลังไพ่ (ตอนยังคว่ำ)
function CardBack() {
  return (
    <div className="card-back">
      <span className="rune">✷</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ไพ่พลิก 3D : revealed=false แสดงหลังไพ่, revealed=true พลิกโชว์หน้าไพ่
// ---------------------------------------------------------------------------
function TarotCard({ id, revealed, className = "", onClick }) {
  return (
    <div className={`flip ${className}`} onClick={onClick}>
      <div className={`flip-inner ${revealed ? "flipped" : ""}`}>
        <div className="flip-face flip-back">
          <CardBack />
        </div>
        <div className="flip-face flip-front">
          <CardFace id={id} />
        </div>
      </div>
    </div>
  );
}

const STORAGE_KEY = "destiny-desk-journal";

export default function Home() {
  const [userName, setUserName] = useState("");
  const [question, setQuestion] = useState("");
  const [purpose, setPurpose] = useState(PURPOSES[0].id);
  const [spreadId, setSpreadId] = useState("single");

  const [drawn, setDrawn] = useState([]);        // [{id, name, th, pos}]
  const [opened, setOpened] = useState({});      // สำหรับ celtic: {index: true}
  const [popup, setPopup] = useState(null);      // ไพ่ที่กำลังแสดง popup
  const [toast, setToast] = useState("");
  const [journal, setJournal] = useState([]);

  const spread = useMemo(() => getSpread(spreadId), [spreadId]);
  const purposeObj = PURPOSES.find((p) => p.id === purpose);

  // เก็บ id ของ timer ไว้เคลียร์ กัน timeout เก่าไปยุ่งกับการสุ่มรอบใหม่
  const revealTimers = useRef([]);
  const toastTimer = useRef(null);

  // โหลดประวัติจาก LocalStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setJournal(JSON.parse(raw));
    } catch (_) {}
  }, []);

  function showToast(msg) {
    clearTimeout(toastTimer.current); // กัน timer ของ toast เก่ามาปิด toast ใหม่ก่อนเวลา
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }

  // ---------- สุ่มไพ่ ----------
  function handleMagicPress() {
    // 1) ลบไพ่ชุดเก่าออกทั้งหมด และยกเลิก timer เปิดไพ่ที่ค้างจากรอบก่อน
    revealTimers.current.forEach(clearTimeout);
    revealTimers.current = [];
    setDrawn([]);
    setOpened({});
    setPopup(null);

    // 2) สุ่มไพ่แบบไม่ซ้ำตามจำนวนของ spread
    const count = spread.count;
    const pool = [...Array(TOTAL_CARDS).keys()]; // 0..79
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const picked = pool.slice(0, count).map((id, idx) => {
      const card = getCardById(id);
      const pos = spread.positions[idx];
      return { ...card, pos };
    });

    setDrawn(picked);

    // สำหรับ single/three ทยอยพลิกเปิดทีละใบ (เอฟเฟกต์แจกไพ่); celtic เริ่มคว่ำไว้
    if (spreadId !== "celtic") {
      picked.forEach((_, i) => {
        const t = setTimeout(() => {
          setOpened((o) => ({ ...o, [i]: true }));
        }, 450 + i * 550);
        revealTimers.current.push(t);
      });
    }

    // บันทึกลงประวัติ
    saveToJournal(picked);
  }

  function saveToJournal(picked) {
    const entry = {
      at: new Date().toISOString(),
      name: userName || "ไม่ระบุชื่อ",
      question: question || "-",
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

  // ---------- คลิกเปิดไพ่ celtic ----------
  function openCelticCard(idx) {
    setOpened((o) => ({ ...o, [idx]: true }));
    setPopup({ ...drawn[idx], idx });
  }

  // ---------- ข้อมูลไพ่ (ส่วนสั้น ใช้ร่วมกันทั้งสองโหมด) ----------
  function buildCardData() {
    const cardNames = drawn
      .map((c, i) => {
        const p = c.pos?.th ? ` (ตำแหน่ง: ${c.pos.th})` : "";
        return `${i + 1}. ${c.name}${p}`;
      })
      .join("\n");

    return `ข้อมูลผู้ถาม:
- ชื่อ: ${userName || "ไม่ระบุ"}
- คำถาม: ${question || "ขอคำแนะนำภาพรวม"}
- วัตถุประสงค์: ${purposeObj?.label} (${purposeObj?.th})
- รูปแบบการวางไพ่: ${spread.label}

ไพ่ที่สุ่มได้:
${cardNames}`;
  }

  // ---------- Prompt เต็ม (มีคำสั่งครบ) ----------
  function buildFullPrompt() {
    return `ในฐานะนักอ่านไพ่แนว Storytelling และ Tarot Therapy และเข้าใจชีวิตมนุษย์ ฉันต้องการให้เธอช่วยทำนายดวงและคำแนะนำเรื่อง ${purposeObj?.label} จากการวางไพ่แบบ ${spread.label}

${buildCardData()}

* สไตล์การเล่าเรื่อง: ช่วยวิเคราะห์ความหมายของไพ่ทั้ง ${spread.count} ใบนี้ โดยเชื่อมโยงกับสถานการณ์ของฉันจริงๆ พร้อมทั้งให้ข้อคิดหรือแนวทางแก้ปัญหาที่จับต้องได้และนำไปใช้ได้จริง ใช้ความหมายไพ่จาก Ethereal vision illuminated โดยไม่ต้องพูดถึงที่มาของไพ่สำรับนี้
* ตอนท้าย: จงสรุปคำแนะนำที่ให้ผู้ใช้เป็นผู้ตัดสินใจด้วยตนเอง และระบุว่าไพ่เป็นเพียงเครื่องมือสะท้อนทางเลือก`;
  }

  // คัดลอกแบบ synchronous (ทำงานเสร็จทันทีก่อนเปิดแท็บใหม่ จึงไม่พลาดเพราะโฟกัสย้าย)
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

  function copyPrompt() {
    const text = buildFullPrompt();
    const ok = copyTextSync(text);
    if (ok) {
      showToast("คัดลอก Prompt แล้ว ✓ นำไปวางใน AI ได้เลย");
    } else {
      // สำรอง: ใช้ clipboard API หรือให้เลือกเอง
      navigator.clipboard
        ?.writeText(text)
        .then(() => showToast("คัดลอก Prompt แล้ว ✓ นำไปวางใน AI ได้เลย"))
        .catch(() => window.prompt("คัดลอกข้อความนี้ไปวางใน AI:", text));
    }
  }

  // ---------- เปิดใน AI แบบคลิกเดียว (ไม่ต้องตั้งค่า / ไม่ต้องก๊อปวาง) ----------
  function openInAI(provider) {
    const text = buildFullPrompt(); // ส่งคำสั่งเต็มไปกับข้อความ เพราะไม่ได้ตั้งค่า AI ไว้ก่อน
    const q = encodeURIComponent(text);
    // ChatGPT/Claude รองรับ prefill ผ่าน ?q= ; Gemini ยังไม่รองรับ จึงเปิดหน้าแล้วให้กดวาง
    const prefillUrls = {
      chatgpt: `https://chatgpt.com/?q=${q}`,
      claude: `https://claude.ai/new?q=${q}`,
    };
    const homeUrls = {
      chatgpt: "https://chatgpt.com/",
      claude: "https://claude.ai/new",
      gemini: "https://gemini.google.com/app",
    };

    // URL ยาวเกิน ~8KB เสี่ยงโดนเซิร์ฟเวอร์ปลายทางตัดทิ้ง/ปฏิเสธ (เช่นสเปรด 10 ใบ)
    // กรณีนั้นเปิดหน้าแชทเปล่าแล้วให้วางจากคลิปบอร์ดแทน
    const MAX_URL = 7500;
    const prefill = prefillUrls[provider];
    const usePrefill = !!prefill && prefill.length <= MAX_URL;

    // ก๊อปแบบ sync ให้เสร็จ "ก่อน" เปิดแท็บใหม่ และตรวจผลจริง ไม่หลอกว่าสำเร็จ
    const copied = copyTextSync(text);
    if (!usePrefill) {
      showToast(
        copied
          ? "คัดลอก Prompt แล้ว ✓ เปิดหน้าแชทแล้วกดวาง (Ctrl/Cmd+V)"
          : "คัดลอกอัตโนมัติไม่สำเร็จ — กรุณากดปุ่ม Copy Prompt แล้ววางเอง"
      );
    }
    window.open(usePrefill ? prefill : homeUrls[provider], "_blank", "noopener");
  }

  const hasDrawn = drawn.length > 0;

  return (
    <main className="app">
      <Starfield />
      <header className="app-header">
        <h1 className="app-title">Destiny Desk</h1>
        <p className="app-subtitle">โต๊ะไพ่ทาโรต์ส่วนตัว · จัดชุดข้อมูลไพ่เพื่อคัดลอกไปให้ AI ทำนาย</p>
      </header>
      <div className="gold-rule" />

      {/* ---------- แผงควบคุม (ด้านบน) ---------- */}
      <section className="panel">
        <div className="field-grid">
          <div className="field">
            <label>ชื่อของคุณ</label>
            <input
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="เช่น มณี"
            />
          </div>

          <div className="field">
            <label>วัตถุประสงค์</label>
            <select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
              {PURPOSES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} — {p.th}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>รูปแบบการวางไพ่</label>
            <select value={spreadId} onChange={(e) => setSpreadId(e.target.value)}>
              {Object.values(SPREADS).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} — {s.th}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>คำถามของคุณ</label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="เช่น ความสัมพันธ์นี้จะเป็นอย่างไรต่อไป"
            />
          </div>
        </div>

        <div className="actions">
          <button className="btn-magic" onClick={handleMagicPress}>
            Magic press
          </button>
        </div>

        {/* เปิดใน AI แบบคลิกเดียว — ไม่ต้องตั้งค่า ไม่ต้องก๊อปวาง */}
        {hasDrawn && (
          <div className="actions">
            <button className="btn-copy" onClick={() => openInAI("chatgpt")}>
              <Sparkles size={16} strokeWidth={2.2} aria-hidden="true" />
              เปิดใน ChatGPT
            </button>
            <button className="btn-copy" onClick={() => openInAI("gemini")}>
              <Sparkles size={16} strokeWidth={2.2} aria-hidden="true" />
              เปิดใน Gemini
            </button>
            <button className="btn-copy" onClick={() => openInAI("claude")}>
              <Sparkles size={16} strokeWidth={2.2} aria-hidden="true" />
              เปิดใน Claude
            </button>
            <button className="btn-ghost" onClick={copyPrompt}>
              Copy Prompt (วางเอง)
            </button>
          </div>
        )}

        {hasDrawn && (
          <p className="ai-hint">
            คลิก “เปิดใน…” เพื่อให้ AI ทำนายให้อัตโนมัติ — สำหรับ Gemini
            แอปจะก๊อป Prompt ไว้ให้ เปิดแล้วกดวางได้เลย
          </p>
        )}
      </section>

      {/* ---------- โซนแสดงไพ่ (ด้านล่าง) ---------- */}
      <section className="board-wrap">
        {!hasDrawn && (
          <p className="empty-hint">
            เลือกวัตถุประสงค์และรูปแบบการวางไพ่ แล้วกด “Magic press” เพื่อเปิดไพ่ ✷
          </p>
        )}

        {hasDrawn && spreadId !== "celtic" && (
          <>
            <h2 className="section-title">{spread.th}</h2>
            <div className="card-row">
              {drawn.map((c, i) => {
                const shown = !!opened[i];
                return (
                  <div className="card-slot dealt" key={i} style={{ animationDelay: `${i * 0.12}s` }}>
                    <div className="pos-label">{c.pos?.th}</div>
                    <TarotCard id={c.id} revealed={shown} className="size-lg" />
                    <div className={`card-caption ${shown ? "show" : ""}`}>
                      <span className="en">{c.name}</span>
                      {c.th}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {hasDrawn && spreadId === "celtic" && (
          <>
            <h2 className="section-title">เซลติกครอส — คลิกที่ไพ่เพื่อเปิด</h2>
            <div className="celtic-scroll">
              <div className="celtic-board">
                {drawn.map((c, i) => {
                  const pos = c.pos;
                  const isOpen = !!opened[i];
                  const label = (
                    <div className="celtic-index">
                      {pos.key}. {pos.th}
                    </div>
                  );
                  return (
                    <div
                      key={i}
                      className={`celtic-cell${pos.rotate ? " rotated" : ""}`}
                      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                    >
                      {/* ป้ายชื่อวางใต้ไพ่สำหรับตำแหน่งไพ่ขวาง กันทับป้ายตำแหน่ง 1 */}
                      {!pos.labelBelow && label}
                      <TarotCard
                        id={c.id}
                        revealed={isOpen}
                        className={`size-sm${isOpen ? " is-open" : ""}`}
                        onClick={() => openCelticCard(i)}
                      />
                      {pos.labelBelow && label}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
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
                {j.name} ถาม: {j.question} — ไพ่: {j.cards.join(", ")}
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
