"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Send, Share2, Volume2, VolumeX } from "lucide-react";
import TarotFan from "./TarotFan";

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
 * DeskMooChat — ทั้งหน้าเป็นแชตดูดวง: DeskMoo ถามทีละอย่าง (เรื่อง → กี่ใบ → คำถาม → เลือกไพ่)
 * แล้วอ่านคำทำนาย + ถามต่อได้ ทุกอย่างอยู่ในแชตเดียว ไม่มีฟอร์ม
 */
export default function DeskMooChat({
  step,
  purposeLabel,
  spreadLabel,
  question,
  purposeOptions = [],
  spreadOptions = [],
  celticLockedUntil = 0,
  deck = [],
  deckVersion = 0,
  spreadCount = 1,
  spreadPositions = [],
  selected = [],
  aiText,
  aiLoading,
  aiError,
  sharing,
  followUps = [],
  followUpLoading,
  followUpsLeft = 0,
  onPickPurpose,
  onPickSpread,
  onSubmitQuestion,
  onSkipQuestion,
  onConfirmCards,
  onAskFollowUp,
  onConfirmFollowCard,
  onRestart,
  onShare,
  onCardClick,
}) {
  const [visible, setVisible] = useState(0);
  const [typing, setTyping] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef(null);
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;

  const questionDone = step === "pick" || step === "reading";

  // ประวัติบทสนทนา (คำนวณจาก state ปัจจุบัน) — ตัวควบคุม (ชิป/กองไพ่/ช่องพิมพ์) เรนเดอร์แยกด้านล่าง
  const messages = useMemo(() => {
    const list = [{ key: "greet", text: "สวัสดี~ เราคือ DeskMoo เพื่อนมูสายมู 🐮✨ วันนี้อยากให้ดูเรื่องอะไรดี", typingMs: 750 }];
    if (purposeLabel) {
      list.push({ key: "u-purpose", who: "user", text: purposeLabel });
      list.push({
        key: "q-count",
        text: "โอเคเลย~ อยากเปิดไพ่กี่ใบดี\n(10 ใบ = ดูภาพรวมช่วง 3 เดือน เปิดได้ 3 เดือนครั้งนะ)",
        typingMs: 900,
      });
    }
    if (spreadLabel) {
      list.push({ key: "u-spread", who: "user", text: spreadLabel });
      list.push({ key: "q-ask", text: "มีอะไรในใจอยากถามเป็นพิเศษไหม พิมพ์มาได้เลย หรือกด “ข้าม” ก็ได้", typingMs: 900 });
    }
    if (questionDone) {
      list.push({ key: "u-question", who: "user", text: (question || "").trim() || "ขอดูภาพรวมเลย" });
      list.push({ key: "q-pick", text: "จัดให้~ แตะไพ่ใบกลางในกองเพื่อเลือกเลย 👇", typingMs: 800 });
    }
    if (selected.length) {
      list.push({ key: "u-cards", who: "user", type: "usercards" });
      if (aiText) {
        aiText
          .split(/\n{2,}/)
          .map((p) => p.trim())
          .filter(Boolean)
          .forEach((p, i) => list.push({ key: `ai${i}`, text: p, accent: true, typingMs: Math.min(1700, 600 + p.length * 4) }));
      }
      if (aiError) list.push({ key: "err", text: aiError, typingMs: 800 });
      followUps.forEach((f, i) => {
        list.push({ key: `fq${i}`, who: "user", text: f.q });
        if (f.card) list.push({ key: `fc${i}`, type: "onecard", card: f.card, typingMs: 650 });
        if (f.a) list.push({ key: `fa${i}`, text: f.a, accent: true, typingMs: Math.min(1400, 500 + f.a.length * 4) });
      });
      // กำลังรอเปิดไพ่ให้คำถามต่อ -> ชวนเปิดไพ่
      if (step === "followpick") {
        list.push({ key: "fpick-prompt", text: "จัดให้~ แตะไพ่ใบกลางเปิดไพ่สำหรับคำถามนี้เลย 👇", typingMs: 750 });
      }
    }
    return list;
  }, [purposeLabel, spreadLabel, questionDone, question, selected, aiText, aiError, followUps, step]);

  // ทยอยเผยข้อความ: ของ DeskMoo โชว์ typing ก่อน, ของผู้ใช้เด้งทันที
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

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visible, typing, aiLoading, followUpLoading, step]);

  const shown = messages.slice(0, visible);
  const ready = visible >= messages.length && !typing; // เผยข้อความล่าสุดครบแล้ว ค่อยโชว์ตัวเลือก
  const showTyping = typing || (visible >= messages.length && !aiError && (aiLoading || followUpLoading));
  const canAskFollowUp = !!aiText && !aiError && followUpsLeft > 0 && !followUpLoading;

  function submitInput() {
    const text = draft.trim();
    if (step === "question") {
      onSubmitQuestion?.(text);
      setDraft("");
    } else if (step === "reading" && canAskFollowUp && text) {
      onAskFollowUp?.(text);
      setDraft("");
    }
  }

  const inputActive = step === "question" || (step === "reading" && !!aiText && !aiError);
  const inputPlaceholder =
    step === "question" ? "พิมพ์คำถามในใจ… (หรือกดข้าม)" : "ถามต่อ / เปลี่ยนเรื่องได้เลย เดี๋ยวเปิดไพ่ใหม่ให้…";

  return (
    <div className="deskmoo">
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

      <div className="deskmoo-body" ref={scrollRef}>
        {shown.map((m) =>
          m.who === "user" ? (
            <div className="deskmoo-row is-user bubble-pop" key={m.key}>
              {m.type === "usercards" ? (
                <div className="deskmoo-bubble user usercards">
                  {selected.map((c, i) => (
                    <div className="deskmoo-card" key={i} onClick={() => onCardClick?.(c, i)}>
                      <ChatCardImg id={c.id} />
                      <span className="deskmoo-card-name">{c.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="deskmoo-bubble user">
                  <RichText text={m.text} />
                </div>
              )}
            </div>
          ) : (
            <div className="deskmoo-row bubble-pop" key={m.key}>
              <div className="deskmoo-av">
                <DeskMooAvatar size={30} />
              </div>
              {m.type === "onecard" ? (
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

        {showTyping && (
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

        {ready && step === "purpose" && (
          <div className="deskmoo-chips">
            {purposeOptions.map((p) => (
              <button key={p.id} className="deskmoo-chip" onClick={() => onPickPurpose?.(p.id)}>
                {p.th}
              </button>
            ))}
          </div>
        )}

        {ready && step === "count" && (
          <div className="deskmoo-chips">
            {spreadOptions.map((s) => {
              const locked = s.id === "celtic" && celticLockedUntil > Date.now();
              return (
                <button
                  key={s.id}
                  className="deskmoo-chip"
                  disabled={locked}
                  onClick={() => !locked && onPickSpread?.(s.id)}
                >
                  {s.count} ใบ · {s.label}
                  {locked
                    ? ` · 🔒 เปิดได้อีก ${new Date(celticLockedUntil).toLocaleDateString("th-TH", {
                        day: "numeric",
                        month: "short",
                      })}`
                    : ""}
                </button>
              );
            })}
          </div>
        )}

        {ready && step === "question" && (
          <div className="deskmoo-chips">
            <button className="deskmoo-chip ghost" onClick={() => onSkipQuestion?.()}>
              ข้าม ดูภาพรวมเลย
            </button>
          </div>
        )}

        {ready && step === "pick" && (
          <div className="deskmoo-bubble fan-bubble">
            <TarotFan
              key={`${spreadLabel}-${deckVersion}`}
              deck={deck}
              maxSelect={spreadCount}
              positions={spreadPositions}
              onConfirm={onConfirmCards}
            />
          </div>
        )}

        {ready && step === "followpick" && (
          <div className="deskmoo-bubble fan-bubble">
            <TarotFan
              key={`follow-${followUps.length}-${deckVersion}`}
              deck={deck}
              maxSelect={1}
              positions={[{ th: "ไพ่สำหรับคำถามนี้" }]}
              onConfirm={onConfirmFollowCard}
            />
          </div>
        )}
      </div>

      {inputActive && (
        <form
          className="deskmoo-ask-bar"
          onSubmit={(e) => {
            e.preventDefault();
            submitInput();
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={inputPlaceholder}
            maxLength={200}
            disabled={followUpLoading}
            aria-label="พิมพ์ข้อความ"
          />
          <button
            type="submit"
            disabled={step === "reading" && (!canAskFollowUp || !draft.trim())}
            aria-label="ส่ง"
          >
            <Send size={16} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </form>
      )}

      {step === "reading" && !!aiText && !aiError && followUpsLeft <= 0 && (
        <span className="deskmoo-ask-left">ถามต่อครบแล้ว — อยากคุยต่อกด “เริ่มใหม่” เปิดรอบใหม่ได้เลย</span>
      )}
      {step === "reading" && followUpLoading && <span className="deskmoo-ask-left">DeskMoo กำลังพิมพ์…</span>}

      {!!aiText && (
        <div className="deskmoo-actions">
          <button className="deskmoo-btn" onClick={onShare} disabled={sharing}>
            <Share2 size={16} strokeWidth={2.2} aria-hidden="true" />
            {sharing ? "กำลังสร้างรูป..." : "แชร์แชต"}
          </button>
          <button className="deskmoo-btn" onClick={onRestart}>
            <RotateCcw size={16} strokeWidth={2.2} aria-hidden="true" />
            เริ่มใหม่
          </button>
        </div>
      )}
    </div>
  );
}
