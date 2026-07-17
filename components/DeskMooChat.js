"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Send, Share2, Sparkles, Volume2, VolumeX } from "lucide-react";

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
// มาสคอต DeskMoo — น้องวัวจักรวาล (รูปจริงของแบรนด์ ครอปหัวมาทำ avatar)
// ---------------------------------------------------------------------------
function DeskMooAvatar({ size = 40 }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/deskmoo-avatar.png"
      alt="DeskMoo"
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        objectFit: "cover",
        border: "1.5px solid var(--gold-soft)",
      }}
    />
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
  selected,
  aiText,
  aiLoading,
  aiError,
  sharing,
  followUps = [],
  followUpLoading,
  followUpsLeft = 0,
  onAskFollowUp,
  onRequestAI,
  onShare,
  onRestart,
  onCardClick,
}) {
  const [visible, setVisible] = useState(0);
  const [typing, setTyping] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef(null);
  const rootRef = useRef(null);
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;

  // ตอนแชตโผล่มาครั้งแรก เลื่อนหน้าลงมาให้เห็นแชตพอดี (ครั้งเดียว ไม่กระตุกส่วนเลือกไพ่ด้านบน)
  useEffect(() => {
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // ข้อความชุดแรก (ล็อกไว้ตอน mount — ไพ่/ชื่อไม่เปลี่ยนระหว่างอยู่หน้าผล)
  const baseMessages = useMemo(() => {
    const meaning =
      selected.length === 1
        ? `ไพ่ของเธอคือ **${selected[0].name}** 💫\n${selected[0].th}`
        : `ไพ่ที่เธอเลือกมาทั้งหมด 👇\n${selected
            .map((c, i) => `${i + 1}. **${c.name}**${c.pos?.th ? ` (${c.pos.th})` : ""}`)
            .join("\n")}`;
    return [
      { key: "lead", text: `ขอส่องไพ่ที่เธอเพิ่งเปิดแป๊บนะ 👀🔮`, typingMs: 700 },
      { key: "cards", type: "cards", typingMs: 700 },
      { key: "meaning", text: meaning, typingMs: 1000 },
      { key: "nudge", text: "กำลังอ่านคำทำนายให้แบบเต็มๆ รอแป๊บนะ~ ✨", typingMs: 850 },
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

  // ถามต่อ: คำถามผู้ใช้ (ขวา) → ไพ่ใหม่ที่เปิดให้ (ซ้าย) → คำตอบ DeskMoo (ซ้าย)
  const followUpMessages = useMemo(() => {
    const out = [];
    followUps.forEach((f, i) => {
      out.push({ key: `fq${i}`, who: "user", text: f.q });
      if (f.card) out.push({ key: `fc${i}`, type: "onecard", card: f.card, typingMs: 650 });
      if (f.a) out.push({ key: `fa${i}`, text: f.a, accent: true, typingMs: Math.min(1400, 500 + f.a.length * 4) });
    });
    return out;
  }, [followUps]);

  const messages = useMemo(
    () => [...baseMessages, ...aiMessages, ...errorMessages, ...followUpMessages],
    [baseMessages, aiMessages, aiError, followUpMessages] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // เครื่องทยอยเผยข้อความ: ของ DeskMoo โชว์ typing ก่อน, ของผู้ใช้เด้งทันที (เพราะเพิ่งพิมพ์เอง)
  useEffect(() => {
    if (visible >= messages.length) {
      setTyping(false);
      return;
    }
    const next = messages[visible];
    if (next.who === "user") {
      setTyping(false);
      setVisible((v) => v + 1);
      return;
    }
    setTyping(true);
    const t = setTimeout(() => {
      setTyping(false);
      setVisible((v) => v + 1);
      if (soundRef.current) playPop();
    }, next.typingMs || 900);
    return () => clearTimeout(t);
  }, [visible, messages]);

  // เลื่อน "ภายในกล่องแชต" ลงล่างสุด (ไม่เลื่อนทั้งหน้า ส่วนเลือกไพ่ด้านบนจึงอยู่นิ่ง)
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visible, typing, aiLoading, followUpLoading]);

  const shown = messages.slice(0, visible);
  const showTypingBubble =
    typing || (visible >= messages.length && !aiError && (aiLoading || followUpLoading));
  const canAsk = !!aiText && !aiError && followUpsLeft > 0 && !followUpLoading;

  return (
    <div className="deskmoo" ref={rootRef}>
      {/* หัว: มูน้อย + ชื่อ (ลอย ไม่มีแถบทึบ) */}
      <div className="deskmoo-head">
        <DeskMooAvatar size={42} />
        <div className="deskmoo-head-info">
          <span className="deskmoo-name">DeskMoo</span>
          <span className="deskmoo-status">เพื่อนมูสายมูของเธอ ✨</span>
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
        {shown.map((m) =>
          m.who === "user" ? (
            <div className="deskmoo-row is-user bubble-pop" key={m.key}>
              <div className="deskmoo-bubble user">
                <RichText text={m.text} />
              </div>
            </div>
          ) : (
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
              ) : m.type === "onecard" ? (
                <div className="deskmoo-bubble">
                  <div className="deskmoo-cards">
                    <div className="deskmoo-card">
                      <ChatCardImg id={m.card.id} />
                      <span className="deskmoo-card-name">{m.card.name}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={`deskmoo-bubble${m.accent ? " accent" : ""}`}>
                  <RichText text={m.text} />
                </div>
              )}
            </div>
          )
        )}

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
      </div>

      {/* ช่องถามต่อ — โผล่หลังคำทำนายหลักมาแล้ว จำกัดจำนวนกันโควต้าฟรีหมดเร็ว */}
      {!!aiText && !aiError && (
        <div className="deskmoo-ask">
          {followUpsLeft > 0 ? (
            <>
              <form
                className="deskmoo-ask-bar"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!canAsk) return;
                  onAskFollowUp?.(draft);
                  setDraft("");
                }}
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="ถามต่อ / เปลี่ยนเรื่องได้เลย เดี๋ยวเปิดไพ่ใหม่ให้…"
                  maxLength={200}
                  disabled={followUpLoading}
                  aria-label="พิมพ์คำถามต่อ"
                />
                <button type="submit" disabled={!canAsk || !draft.trim()} aria-label="ส่งคำถาม">
                  <Send size={16} strokeWidth={2.2} aria-hidden="true" />
                </button>
              </form>
              <span className="deskmoo-ask-left">
                {followUpLoading ? "DeskMoo กำลังพิมพ์…" : `ถามต่อได้อีก ${followUpsLeft} คำถาม`}
              </span>
            </>
          ) : (
            <span className="deskmoo-ask-left">ถามต่อครบแล้ว — อยากคุยต่อ กด “เลือกไพ่ใหม่” เปิดรอบใหม่ได้เลย</span>
          )}
        </div>
      )}

      {/* แถบปุ่ม */}
      <div className="deskmoo-actions">
        {/* DeskMoo ทำนายเต็มๆ อัตโนมัติ — โชว์ปุ่มลองใหม่เฉพาะตอนอ่านพลาด (เช่นโควต้าเต็ม) */}
        {aiError && (
          <button className="deskmoo-btn primary" onClick={onRequestAI} disabled={aiLoading}>
            <Sparkles size={16} strokeWidth={2.2} aria-hidden="true" />
            {aiLoading ? "DeskMoo กำลังพิมพ์..." : "ลองอ่านใหม่อีกครั้ง"}
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
