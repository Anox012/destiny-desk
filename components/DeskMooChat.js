"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Share2, Sparkles, Volume2, VolumeX } from "lucide-react";

// ---------------------------------------------------------------------------
// เสียง "ป๊อป" ตอนข้อความเด้งเข้า (สร้างสดด้วย Web Audio ไม่ต้องมีไฟล์เสียง)
// ---------------------------------------------------------------------------
let audioCtx = null;
function playPop() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = audioCtx || new AC();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const now = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(520, now);
    o.frequency.exponentialRampToValueAtTime(880, now + 0.06);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.1, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(now);
    o.stop(now + 0.16);
  } catch (_) {}
}

// ---------------------------------------------------------------------------
// มาสคอต DeskMoo — หมูมูน้อยสายมู 🐷 (SVG น่ารัก โทนม่วงนีออน)
// ---------------------------------------------------------------------------
function DeskMooAvatar({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="moo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c026d3" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="24" fill="url(#moo-bg)" />
      {/* หูหมู */}
      <path d="M12 15 L18 12 L17 20 Z" fill="#f9a8d4" />
      <path d="M36 15 L30 12 L31 20 Z" fill="#f9a8d4" />
      {/* หน้า */}
      <circle cx="24" cy="26" r="13" fill="#fbcfe8" />
      {/* ตา */}
      <circle cx="19.5" cy="24" r="2.1" fill="#3b0764" />
      <circle cx="28.5" cy="24" r="2.1" fill="#3b0764" />
      <circle cx="20.2" cy="23.3" r="0.7" fill="#fff" />
      <circle cx="29.2" cy="23.3" r="0.7" fill="#fff" />
      {/* จมูกหมู */}
      <ellipse cx="24" cy="30" rx="5" ry="3.4" fill="#f472b6" />
      <circle cx="22.3" cy="30" r="0.9" fill="#9d174d" />
      <circle cx="25.7" cy="30" r="0.9" fill="#9d174d" />
      {/* ดาวมูบนหัว */}
      <text x="24" y="10" fontSize="7" textAnchor="middle" fill="#fde68a">✦</text>
    </svg>
  );
}

// รูปไพ่ในแชต (ลอง jpg -> png)
function ChatCardImg({ id }) {
  const [step, setStep] = useState(0);
  const sources = [`/tarotimages/${id}.jpg`, `/tarotimages/${id}.png`];
  if (step >= sources.length) {
    return (
      <div className="deskmoo-card-img" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "#1a1440", color: "#fcd34d" }}>
        ✷
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={sources[step]} alt={`card ${id}`} onError={() => setStep((s) => s + 1)} className="deskmoo-card-img" />
  );
}

// แปลงข้อความที่มี **ตัวหนา** + ขึ้นบรรทัด ให้เป็น React nodes
function RichText({ text }) {
  return text.split("\n").map((line, li) => (
    <span key={li}>
      {li > 0 && <br />}
      {line.split(/(\*\*[^*]+\*\*)/g).map((seg, si) =>
        seg.startsWith("**") && seg.endsWith("**") ? (
          <strong key={si}>{seg.slice(2, -2)}</strong>
        ) : (
          <span key={si}>{seg}</span>
        )
      )}
    </span>
  ));
}

/**
 * DeskMooChat — แสดงผลไพ่เป็นหน้าต่างแชตที่ DeskMoo ทักมาทำนายให้
 * ทยอยเด้ง bubble ทีละอัน + typing animation + เสียงป๊อป + auto-scroll
 */
export default function DeskMooChat({
  userName,
  spread,
  selected,
  aiText,
  aiLoading,
  aiError,
  sharing,
  onRequestAI,
  onShare,
  onRestart,
  onCardClick,
}) {
  const [visible, setVisible] = useState(0);
  const [typing, setTyping] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const scrollRef = useRef(null);
  const endRef = useRef(null);
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;

  // ข้อความชุดแรก (ล็อกไว้ตอน mount — ไพ่/ชื่อไม่เปลี่ยนระหว่างอยู่หน้าผล)
  const baseMessages = useMemo(() => {
    const name = (userName || "").trim() || "เธอ";
    const meaning =
      selected.length === 1
        ? `ไพ่ของเธอคือ **${selected[0].name}** 💫\n${selected[0].th}`
        : `ไพ่ที่เธอเลือกมาทั้งหมด 👇\n${selected
            .map((c, i) => `${i + 1}. **${c.name}**${c.pos?.th ? ` (${c.pos.th})` : ""}`)
            .join("\n")}`;
    return [
      { key: "g1", text: `เฮ้ ${name}! 🔮✨`, typingMs: 650 },
      { key: "g2", text: "เราคือ DeskMoo เอง~ เพื่อนมูประจำตัวเธอ 🐷 ขอส่องไพ่ที่เพิ่งหยิบแป๊บนะ 👀", typingMs: 950 },
      { key: "cards", type: "cards", typingMs: 700 },
      { key: "meaning", text: meaning, typingMs: 1100 },
      { key: "nudge", text: "อยากรู้ลึกกว่านี้? กดปุ่ม “ให้ DeskMoo ทำนายเต็มๆ” ข้างล่างเลย เดี๋ยวจัดให้! 💜", typingMs: 950 },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ข้อความคำทำนาย AI (แตกเป็นย่อหน้า ทีละ bubble)
  const aiMessages = useMemo(() => {
    if (!aiText) return [];
    return aiText
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p, i) => ({ key: `ai${i}`, text: p, accent: true, typingMs: Math.min(1700, 600 + p.length * 4) }));
  }, [aiText]);

  const errorMessages = aiError ? [{ key: "err", text: aiError, typingMs: 800 }] : [];
  const messages = useMemo(
    () => [...baseMessages, ...aiMessages, ...errorMessages],
    [baseMessages, aiMessages, aiError] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // เครื่องทยอยเผยข้อความ: โชว์ typing ค้างช่วงหนึ่ง แล้วเด้ง bubble + เสียง
  useEffect(() => {
    if (visible >= messages.length) {
      setTyping(false);
      return;
    }
    setTyping(true);
    const t = setTimeout(() => {
      setTyping(false);
      setVisible((v) => v + 1);
      if (soundRef.current) playPop();
    }, messages[visible].typingMs || 900);
    return () => clearTimeout(t);
  }, [visible, messages]);

  // เลื่อนลงล่างสุดทุกครั้งที่มี bubble/typing ใหม่ (ดันข้อความเก่าขึ้นแบบแชตจริง)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [visible, typing, aiLoading]);

  const shown = messages.slice(0, visible);
  const showTypingBubble = typing || (aiLoading && visible >= messages.length && !aiError);
  const allBaseShown = visible >= baseMessages.length;

  return (
    <div className="deskmoo">
      {/* แถบหัวแชต */}
      <div className="deskmoo-head">
        <DeskMooAvatar size={42} />
        <div className="deskmoo-head-info">
          <span className="deskmoo-name">DeskMoo</span>
          <span className="deskmoo-status">
            <i className="deskmoo-dot" /> กำลังใช้งาน
          </span>
        </div>
        <button
          type="button"
          className="deskmoo-mute"
          onClick={() => setSoundOn((s) => !s)}
          aria-label={soundOn ? "ปิดเสียง" : "เปิดเสียง"}
        >
          {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
      </div>

      {/* พื้นที่ข้อความ */}
      <div className="deskmoo-body" ref={scrollRef}>
        {shown.map((m) => (
          <div className="deskmoo-row bubble-pop" key={m.key}>
            <div className="deskmoo-av">
              <DeskMooAvatar size={30} />
            </div>
            {m.type === "cards" ? (
              <div className={`deskmoo-bubble${m.accent ? " accent" : ""}`}>
                <div className="deskmoo-cards">
                  {selected.map((c, i) => (
                    <div className="deskmoo-card" key={i} onClick={() => onCardClick?.(c, i)}>
                      <ChatCardImg id={c.id} />
                      <span className="deskmoo-card-name">{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className={`deskmoo-bubble${m.accent ? " accent" : ""}`}>
                <RichText text={m.text} />
              </div>
            )}
          </div>
        ))}

        {showTypingBubble && (
          <div className="deskmoo-row">
            <div className="deskmoo-av">
              <DeskMooAvatar size={30} />
            </div>
            <div className="deskmoo-bubble typing">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* แถบปุ่ม (คล้ายช่องพิมพ์ของแชต) */}
      <div className="deskmoo-actions">
        {!aiText && allBaseShown && (
          <button className="deskmoo-btn primary" onClick={onRequestAI} disabled={aiLoading}>
            <Sparkles size={16} strokeWidth={2.2} aria-hidden="true" />
            {aiLoading ? "DeskMoo กำลังพิมพ์..." : "ให้ DeskMoo ทำนายเต็มๆ"}
          </button>
        )}
        <button className="deskmoo-btn" onClick={onShare} disabled={sharing}>
          <Share2 size={16} strokeWidth={2.2} aria-hidden="true" />
          {sharing ? "กำลังสร้างรูป..." : "แชร์แชต"}
        </button>
        <button className="deskmoo-btn" onClick={onRestart}>
          <RotateCcw size={16} strokeWidth={2.2} aria-hidden="true" />
          เลือกไพ่ใหม่
        </button>
      </div>
    </div>
  );
}
