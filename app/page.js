"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Share2, Sparkles } from "lucide-react";
import { TOTAL_CARDS, getCardById } from "@/lib/cards";
import { SPREADS, PURPOSES, getSpread } from "@/lib/spreads";
import Starfield from "@/components/Starfield";
import TarotFan from "@/components/TarotFan";

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

function shuffleIds() {
  const pool = [...Array(TOTAL_CARDS).keys()];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

export default function Home() {
  const [userName, setUserName] = useState("");
  const [question, setQuestion] = useState("");
  const [purpose, setPurpose] = useState(PURPOSES[0].id);
  const [spreadId, setSpreadId] = useState("single");

  // ---------- กองไพ่ (สำหรับเลื่อนดูใน TarotFan) ----------
  const [deckOrder, setDeckOrder] = useState(() => [...Array(TOTAL_CARDS).keys()]);
  const [deckVersion, setDeckVersion] = useState(0); // เพิ่มค่าเพื่อบังคับ remount TarotFan ตอนเริ่มใหม่

  const [stage, setStage] = useState("select"); // select | result
  const [selected, setSelected] = useState([]); // [{id, name, th, pos}]
  const [popup, setPopup] = useState(null);
  const [toast, setToast] = useState("");
  const [journal, setJournal] = useState([]);

  // ---------- ทำนายด้วย AI (Gemini free tier) ----------
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const spread = useMemo(() => getSpread(spreadId), [spreadId]);
  const purposeObj = PURPOSES.find((p) => p.id === purpose);

  const toastTimer = useRef(null);

  // สับไพ่ครั้งแรกฝั่ง client เท่านั้น (กัน hydration mismatch จาก Math.random)
  useEffect(() => {
    setDeckOrder(shuffleIds());
  }, []);

  // เปลี่ยนรูปแบบการวางไพ่ -> เริ่มเลือกใหม่
  useEffect(() => {
    setSelected([]);
    setStage("select");
    setAiText("");
    setAiError("");
  }, [spreadId]);

  // โหลดประวัติจาก LocalStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setJournal(JSON.parse(raw));
    } catch (_) {}
  }, []);

  // เคลียร์ timer ตอนเลิกใช้หน้า
  useEffect(() => {
    return () => clearTimeout(toastTimer.current);
  }, []);

  function showToast(msg) {
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }

  // ---------- ยืนยันไพ่ที่เลือกจาก TarotFan ----------
  function handleFanConfirm(ids) {
    const picked = ids.map((id, i) => ({ ...getCardById(id), pos: spread.positions[i] }));
    setSelected(picked);
    setStage("result");
    saveToJournal(picked);
  }

  // ---------- เริ่มใหม่: สับไพ่ใหม่ + รีเซ็ต TarotFan ----------
  function handleClearDeck() {
    setPopup(null);
    setStage("select");
    setSelected([]);
    setAiText("");
    setAiError("");
    setAiLoading(false);
    setDeckOrder(shuffleIds());
    setDeckVersion((v) => v + 1);
    showToast("เริ่มใหม่แล้ว ✷ เลือกไพ่ได้เลย");
  }

  function saveToJournal(picked) {
    const entry = {
      at: new Date().toISOString(),
      name: userName || "ไม่ระบุชื่อ",
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

  // ---------- แชร์ผลไพ่ + ความหมายให้เพื่อนดู ----------
  function shareResult() {
    if (selected.length === 0) return;
    const lines = selected
      .map((c, i) => `${i + 1}. ${c.name}${c.pos?.th ? ` — ${c.pos.th}` : ""}\n${c.th}`)
      .join("\n\n");
    const text = `🔮 ผลไพ่ทาโรต์ — ${spread.th}\n\n${lines}\n\n— จาก Destiny Desk`;

    if (navigator.share) {
      navigator.share({ title: "ผลไพ่ทาโรต์ของฉัน", text }).catch(() => {});
      return;
    }
    const ok = copyTextSync(text);
    showToast(ok ? "คัดลอกผลไพ่แล้ว ✓ นำไปวางแชร์ให้เพื่อนได้เลย" : "คัดลอกไม่สำเร็จ ลองอีกครั้ง");
  }

  // ---------- ทำนายด้วย AI (เรียก API route ฝั่ง server ที่ต่อ Gemini free tier) ----------
  // แปลงรหัส error จาก API เป็นข้อความไทยที่บอกสาเหตุเจาะจง ให้ผู้ใช้/คนดูแลแก้ได้ตรงจุด
  function aiErrorMessage(code) {
    switch (code) {
      case "no_api_key":
        return "ยังไม่ได้ตั้งค่า GEMINI_API_KEY — เจ้าของเว็บต้องเพิ่ม API key ใน Vercel (Settings → Environment Variables) แล้ว Redeploy";
      case "quota":
        return "โควต้าฟรีของ Gemini วันนี้เต็มแล้ว ลองใหม่อีกครั้งพรุ่งนี้";
      case "gemini_error":
        return "เรียก Gemini ไม่สำเร็จ (อาจเป็นเพราะ API key ไม่ถูกต้อง หรือชื่อโมเดลเปลี่ยน) ลองตรวจสอบ key อีกครั้ง";
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
          userName,
          purpose: purposeObj?.label,
          question,
          spreadLabel: spread.label,
          cards: selected.map((c) => ({ name: c.name, pos: c.pos?.th, th: c.th })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) throw new Error("quota");
      if (!res.ok || !data.text) throw new Error(data.error || "unknown");
      setAiText(data.text);
    } catch (err) {
      setAiError(aiErrorMessage(err?.message));
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <main className="app">
      <Starfield />
      <header className="app-header">
        <h1 className="app-title">Destiny Desk</h1>
        <p className="app-subtitle">โต๊ะไพ่ทาโรต์ส่วนตัว · หยิบไพ่ด้วยตัวคุณเอง</p>
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
            <label>คำถามของคุณ (ไม่บังคับ)</label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="ใส่ไว้ถ้าอยากให้ AI ทำนายเจาะจงขึ้น เช่น ความสัมพันธ์นี้จะเป็นอย่างไรต่อไป"
            />
          </div>
        </div>
      </section>

      {/* ---------- โซนพัดไพ่ (TarotFan) เลื่อนดูแล้วแตะใบกลางเพื่อเลือก ---------- */}
      {stage === "select" && (
        <section className="deck-zone">
          <p className="deck-hint">เลื่อนดูด้วยลูกศร/ปัดนิ้ว แล้วแตะไพ่ใบกลางเพื่อเลือก — {spread.th}</p>

          <TarotFan
            key={`${spreadId}-${deckVersion}`}
            deck={deckOrder}
            maxSelect={spread.count}
            positions={spread.positions}
            onConfirm={handleFanConfirm}
          />

          <div className="deck-controls">
            <button className="btn-deck" onClick={handleClearDeck}>
              <RotateCcw size={16} strokeWidth={2.2} aria-hidden="true" />
              เริ่มใหม่
            </button>
          </div>
        </section>
      )}

      {/* ---------- โซนแสดงผลไพ่ที่เลือกแล้ว ---------- */}
      {stage === "result" && (
        <section className="board-wrap">
          <h2 className="section-title">{spread.th}</h2>

          {spreadId !== "celtic" && (
            <div className="card-row">
              {selected.map((c, i) => (
                <div className="card-slot dealt" key={i} style={{ animationDelay: `${i * 0.12}s` }}>
                  <div className="pos-label">{c.pos?.th}</div>
                  <TarotCard id={c.id} revealed className="size-lg" />
                  <div className="card-caption show">
                    <span className="en">{c.name}</span>
                    {c.th}
                  </div>
                </div>
              ))}
            </div>
          )}

          {spreadId === "celtic" && (
            <div className="celtic-scroll">
              <div className="celtic-board">
                {selected.map((c, i) => {
                  const pos = c.pos;
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
                      {!pos.labelBelow && label}
                      <TarotCard
                        id={c.id}
                        revealed
                        className="size-sm is-open"
                        onClick={() => setPopup({ ...c, idx: i })}
                      />
                      {pos.labelBelow && label}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="actions result-actions">
            {!aiText && (
              <button className="btn-deck btn-ai" onClick={requestAiReading} disabled={aiLoading}>
                <Sparkles size={16} strokeWidth={2.2} aria-hidden="true" />
                {aiLoading ? "กำลังทำนาย..." : "ทำนายด้วย AI"}
              </button>
            )}
            <button className="btn-deck btn-share" onClick={shareResult}>
              <Share2 size={16} strokeWidth={2.2} aria-hidden="true" />
              แชร์ผลไพ่
            </button>
            <button className="btn-deck" onClick={handleClearDeck}>
              <RotateCcw size={16} strokeWidth={2.2} aria-hidden="true" />
              เลือกไพ่ใหม่
            </button>
          </div>

          {aiError && <p className="ai-error">{aiError}</p>}
          {aiText && (
            <div className="ai-reading">
              <h3 className="ai-reading-title">
                <Sparkles size={18} strokeWidth={2.2} aria-hidden="true" />
                คำทำนายจาก AI
              </h3>
              <p className="ai-reading-text">{aiText}</p>
            </div>
          )}
        </section>
      )}

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
