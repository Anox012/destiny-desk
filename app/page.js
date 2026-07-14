"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Share2, Shuffle } from "lucide-react";
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

  // ---------- กองไพ่ (สำหรับกรีดเลือกทีละใบ) ----------
  const [deckOrder, setDeckOrder] = useState(() => [...Array(TOTAL_CARDS).keys()]);
  const [deckPhase, setDeckPhase] = useState("fan"); // fan | exploding | piled | cutting
  const [cutAt, setCutAt] = useState(null);
  const [compact, setCompact] = useState(false);

  const [stage, setStage] = useState("select"); // select | result
  const [selected, setSelected] = useState([]); // [{id, name, th, pos}]
  const [popup, setPopup] = useState(null);
  const [toast, setToast] = useState("");
  const [journal, setJournal] = useState([]);

  const spread = useMemo(() => getSpread(spreadId), [spreadId]);
  const purposeObj = PURPOSES.find((p) => p.id === purpose);

  const toastTimer = useRef(null);
  const resultTimer = useRef(null);
  const clearTimers = useRef([]);
  const cutTimer = useRef(null);
  const explodeVectors = useRef({});

  // สับไพ่ครั้งแรกฝั่ง client เท่านั้น (กัน hydration mismatch จาก Math.random)
  useEffect(() => {
    setDeckOrder(shuffleIds());
  }, []);

  // จอเล็ก -> ย่อขนาดไพ่ในกอง
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const update = () => setCompact(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // เปลี่ยนรูปแบบการวางไพ่ -> เริ่มเลือกใหม่
  useEffect(() => {
    clearTimeout(resultTimer.current);
    setSelected([]);
    setStage("select");
  }, [spreadId]);

  // โหลดประวัติจาก LocalStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setJournal(JSON.parse(raw));
    } catch (_) {}
  }, []);

  // เคลียร์ timer ทั้งหมดตอนเลิกใช้หน้า
  useEffect(() => {
    return () => {
      clearTimeout(toastTimer.current);
      clearTimeout(resultTimer.current);
      clearTimeout(cutTimer.current);
      clearTimers.current.forEach(clearTimeout);
    };
  }, []);

  function showToast(msg) {
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }

  // ---------- เรขาคณิตของกองไพ่ที่กรีดเป็นแถว ----------
  const CARD_W = compact ? 58 : 78;
  const CARD_H = compact ? 88 : 118;
  const FAN_SPACING = compact ? 7 : 10;
  const FAN_ANGLE = compact ? 2.1 : 2.4;
  const trackWidth = FAN_SPACING * (TOTAL_CARDS - 1) + CARD_W + 80;
  const trackHeight = CARD_H + 70;

  function getCardTransform(id, index, isSelected) {
    if (deckPhase === "piled") {
      return "translateX(0) translateY(0) rotate(0deg) scale(0.9)";
    }
    if (deckPhase === "exploding") {
      const v = explodeVectors.current[id] || { dx: 0, dy: 0, rot: 0 };
      return `translateX(${v.dx}px) translateY(${v.dy}px) rotate(${v.rot}deg) scale(0.85)`;
    }
    const center = (TOTAL_CARDS - 1) / 2;
    const offset = index - center;
    let tx = offset * FAN_SPACING;
    let ty = 0;
    let rot = offset * FAN_ANGLE;
    if (deckPhase === "cutting" && cutAt != null) {
      if (index < cutAt) {
        tx -= 18;
        ty -= 42;
        rot -= 5;
      } else {
        tx += 18;
        ty += 42;
        rot += 5;
      }
    }
    // ใบที่เลือกแล้ว: หดตัวจางหายไปจากกอง (ไปโผล่ที่แถวไพ่ที่เลือกด้านล่างแทน) กันไม่ให้บังใบอื่น
    const scale = isSelected ? 0.25 : 1;
    return `translateX(${tx}px) translateY(${ty}px) rotate(${rot}deg) scale(${scale})`;
  }

  // ---------- เลือกไพ่ทีละใบจากกอง ----------
  function selectCard(id) {
    if (stage !== "select" || deckPhase !== "fan") return;

    setSelected((prev) => {
      if (prev.some((s) => s.id === id)) return prev;
      if (prev.length >= spread.count) return prev;

      const pos = spread.positions[prev.length];
      const card = getCardById(id);
      const next = [...prev, { ...card, pos }];

      if (next.length === spread.count) {
        resultTimer.current = setTimeout(() => {
          setStage("result");
          saveToJournal(next);
        }, 900);
      }
      return next;
    });
  }

  // ---------- ล้างไพ่: ระเบิดออก -> รวมกอง -> กรีดใหม่ ----------
  function handleClearDeck() {
    if (deckPhase !== "fan") return;
    clearTimeout(resultTimer.current);
    setPopup(null);
    setStage("select");
    setSelected([]);

    const vectors = {};
    deckOrder.forEach((id) => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 260 + Math.random() * 260;
      vectors[id] = { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, rot: Math.random() * 520 - 260 };
    });
    explodeVectors.current = vectors;
    setDeckPhase("exploding");

    clearTimers.current.forEach(clearTimeout);
    clearTimers.current = [
      setTimeout(() => {
        setDeckOrder(shuffleIds());
        setDeckPhase("piled");
      }, 620),
      setTimeout(() => {
        setDeckPhase("fan");
      }, 1140),
    ];
    showToast("ล้างไพ่แล้ว ✷ เลือกใหม่ได้เลย");
  }

  // ---------- ตัดไพ่ ----------
  function handleCutDeck() {
    if (deckPhase !== "fan" || selected.length > 0) return;
    const n = deckOrder.length;
    const cut = 15 + Math.floor(Math.random() * (n - 30));
    setCutAt(cut);
    setDeckPhase("cutting");
    cutTimer.current = setTimeout(() => {
      setDeckOrder((d) => [...d.slice(cut), ...d.slice(0, cut)]);
      setDeckPhase("fan");
      setCutAt(null);
    }, 420);
    showToast("ตัดไพ่แล้ว ✷");
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
            <label>คำถามของคุณ</label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="เช่น ความสัมพันธ์นี้จะเป็นอย่างไรต่อไป"
            />
          </div>
        </div>
      </section>

      {/* ---------- โซนกรีดไพ่เลือกทีละใบ ---------- */}
      {stage === "select" && (
        <section className="deck-zone">
          <div className="deck-status">
            <span className="deck-count">
              {selected.length}/{spread.count}
            </span>
            <span className="deck-count-label">ใบที่เลือกแล้ว</span>
          </div>
          <p className="deck-hint">แตะไพ่ในกองเพื่อเลือกทีละใบ — {spread.th}</p>

          <div className="fan-wrap">
            <div className="fan-track" style={{ width: trackWidth, height: trackHeight }}>
              {deckOrder.map((id, index) => {
                const isSelected = selected.some((s) => s.id === id);
                const disabled = isSelected || selected.length >= spread.count || deckPhase !== "fan";
                return (
                  <div
                    key={id}
                    className={`fan-card${isSelected ? " is-picked" : ""}`}
                    style={{
                      width: CARD_W,
                      height: CARD_H,
                      marginLeft: -CARD_W / 2,
                      transform: getCardTransform(id, index, isSelected),
                      zIndex: index,
                    }}
                    onClick={() => !disabled && selectCard(id)}
                  >
                    <TarotCard id={id} revealed={isSelected} className="size-fan" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* ไพ่ที่เลือกแล้ว เรียงเป็นแถวใต้กอง — เห็นชัด ไม่บังกัน */}
          {selected.length > 0 && (
            <div className="picked-row">
              {selected.map((c, i) => (
                <div className="picked-slot" key={i}>
                  <div className="pos-label small">{c.pos?.th}</div>
                  <TarotCard id={c.id} revealed className="size-sm is-open" />
                </div>
              ))}
            </div>
          )}

          <div className="deck-controls">
            <button
              className="btn-deck"
              onClick={handleCutDeck}
              disabled={selected.length > 0 || deckPhase !== "fan"}
            >
              <Shuffle size={16} strokeWidth={2.2} aria-hidden="true" />
              ตัดไพ่
            </button>
            <button className="btn-deck" onClick={handleClearDeck} disabled={deckPhase !== "fan"}>
              <RotateCcw size={16} strokeWidth={2.2} aria-hidden="true" />
              ล้างไพ่
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
            <button className="btn-deck btn-share" onClick={shareResult}>
              <Share2 size={16} strokeWidth={2.2} aria-hidden="true" />
              แชร์ผลไพ่
            </button>
            <button className="btn-deck" onClick={handleClearDeck}>
              <RotateCcw size={16} strokeWidth={2.2} aria-hidden="true" />
              เลือกไพ่ใหม่
            </button>
          </div>
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
