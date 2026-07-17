// ทำนายไพ่ด้วย Google Gemini (free tier) — เรียกฝั่ง server เท่านั้น กัน API key หลุดไปหน้าเว็บ
// จำกัด maxOutputTokens ให้คำตอบสั้นกระชับ ประหยัดโควต้าฟรี
// endpoint นี้เป็น URL สาธารณะ ใครก็ยิงตรงได้ (ไม่ใช่แค่ผ่านหน้าเว็บ) จึงเช็ค origin +
// จำกัดรูปร่าง/ขนาด payload คร่าวๆ กันสแปมยิงรัวๆ จนโควต้าฟรีหมดเร็วเกินไป — ไม่ใช่การยืนยันตัวตนที่รัดกุม

// ลองหลายโมเดลตามลำดับ: ถ้าตัวแรกโดนจำกัดโควต้า (429) ก็ขยับไปตัวถัดไป
// ใช้โมเดลรุ่น 3.x ที่ยังเปิดให้ key ใหม่ + มี free tier (ทดสอบกับ key จริงแล้วใช้ได้)
// รุ่นเก่า (1.5, 2.0, 2.5) ถูกปิดสำหรับผู้ใช้ใหม่/ปลดระวางไปแล้ว
// 3.5-flash คุณภาพดีสุด, 3.1-flash-lite เป็น fallback ที่โควต้าฟรีสูงกว่า
// ref: https://ai.google.dev/gemini-api/docs/pricing
const MODELS = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];
const ALLOWED_CARD_COUNTS = [1, 3, 10];
const MAX_FIELD_LEN = 400;

function clip(str) {
  return typeof str === "string" ? str.slice(0, MAX_FIELD_LEN) : "";
}

export async function POST(request) {
  // เช็คว่ายิงมาจากโดเมนเว็บเราเอง (มี Origin header เมื่อไหร่ต้องตรงกับ host เท่านั้น)
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return Response.json({ error: "forbidden" }, { status: 403 });
      }
    } catch (_) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const { userName, purpose, question, spreadLabel, cards } = body || {};

  if (!Array.isArray(cards) || !ALLOWED_CARD_COUNTS.includes(cards.length)) {
    return Response.json({ error: "invalid_cards" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "no_api_key" }, { status: 500 });
  }

  const cardLines = cards
    .map((c, i) => `${i + 1}. ${clip(c.name)}${c.pos ? ` (${clip(c.pos)})` : ""} — ความหมาย: ${clip(c.th)}`)
    .join("\n");

  const prompt = `เธอคือ "DeskMoo" เพื่อนมู (หมอดูไพ่ทาโรต์) วัยรุ่นสุดชิล เป็นกันเอง อบอุ่น และเข้าใจชีวิต
กำลังแชตทักมาทำนายไพ่ให้เพื่อนสนิทอ่านในแอปแชต

โทนการพูด:
- คุยแบบเพื่อนสนิททักไลน์/ไอจี ไม่ทางการ ไม่ใช้ "ค่ะ/ครับ" แทนตัวเองว่า "เรา" เรียกผู้ถามว่า "เธอ"
- สนุก มีพลังบวก ใส่อีโมจิได้บ้างพอประมาณ (อย่าเยอะเกิน) ใช้ภาษาวัยรุ่นได้แต่ยังอ่านง่าย
- ถึงจะกันเอง แต่ต้องให้ข้อคิด/มุมมองที่ลึกและใช้ได้จริง ไม่ใช่แค่ปลอบใจลอยๆ

ข้อมูลผู้ถาม:
- ชื่อ: ${clip(userName) || "ไม่ระบุ"}
- เรื่องที่อยากดู: ${clip(purpose) || "ภาพรวมชีวิต"}
- คำถาม: ${clip(question) || "ขอคำแนะนำภาพรวม"}
- รูปแบบการวางไพ่: ${clip(spreadLabel) || "-"}

ไพ่ที่เธอเปิดได้:
${cardLines}

ช่วยอ่านไพ่ทุกใบให้ โยงกับคำถาม/เรื่องที่เธอสนใจจริงๆ เล่าเป็นเรื่องราวลื่นๆ กระชับ ไม่เกิน 4-5 ย่อหน้าสั้นๆ
สำคัญ: อย่าเกริ่นหรือทักทายเปิดเรื่องเลย (ห้ามขึ้นต้นแบบ "เฮ้ เธอ! วันนี้เราหยิบไพ่..." / "สวัสดี" / "วันนี้เราสับไพ่ให้...")
เพราะเราทักทายเธอไปแล้ว — ให้ย่อหน้าแรกเข้าเรื่องอ่านความหมายไพ่ใบแรกเลยทันที
แล้วปิดท้ายด้วยกำลังใจ + ย้ำเบาๆ ว่าไพ่เป็นแค่เครื่องมือสะท้อนทางเลือก สุดท้ายเธอเป็นคนตัดสินใจเอง
ไม่ใช่คำแนะนำทางกฎหมาย การแพทย์ หรือการเงินนะ
ห้ามแต่งประโยคชวนปิดท้ายอื่นเพิ่มเอง (เช่น "มีอะไรทักมาเมาท์/อัปเดตได้ตลอด") — ให้บรรทัดสุดท้ายสุดเป็นประโยคนี้ประโยคเดียวเป๊ะๆ ห้ามดัดแปลง: "มีข้อกังวลใจมาลองสุ่มไพ่เล่นได้ตลอดเลยนะ!"`;

  const requestBody = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    // thinkingBudget: 0 = ปิดโหมด "คิดในใจ" ของโมเดล 3.x (ไม่งั้นมันกิน token หมดจนคำตอบโดนตัด
    // MAX_TOKENS กลางประโยค) — ปิดแล้วคำตอบจริงเต็ม + ใช้ token น้อยลงด้วย
    // maxOutputTokens 1500 = เผื่อสเปรด 10 ใบที่คำทำนายยาว ให้จบประโยคพอดี
    generationConfig: {
      maxOutputTokens: 1500,
      temperature: 0.85,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  // เก็บ error ของ 429 ไว้เป็นตัวรายงานหลัก (สาเหตุจริงที่ต้องแก้) เพราะ 404 "โมเดลไม่มี"
  // เป็นแค่การข้ามโมเดลที่ใช้ไม่ได้ ไม่ควรมาบังเหตุผล 429 ตอนสุดท้าย
  let quotaDetail = "";
  let fallbackStatus = 502;
  let fallbackDetail = "";

  for (const model of MODELS) {
    let resp;
    try {
      resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: requestBody,
        }
      );
    } catch (_) {
      return Response.json({ error: "network_error" }, { status: 502 });
    }

    if (resp.ok) {
      const data = await resp.json();
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("").trim();
      if (text) return Response.json({ text });
      fallbackStatus = 502;
      fallbackDetail = "empty_response";
      continue; // คำตอบว่าง ลองโมเดลถัดไป
    }

    // ดึงเหตุผลจริงจาก Gemini มาไว้ช่วย debug (message/status ของ 4xx ไม่ใช่ข้อมูลลับ)
    const errBody = await resp.json().catch(() => null);
    const detail = errBody?.error?.message || errBody?.error?.status || `http_${resp.status}`;
    console.error(`[interpret] ${model} -> ${resp.status}: ${detail}`);

    if (resp.status === 429) {
      if (!quotaDetail) quotaDetail = detail; // จำ 429 ตัวแรกไว้ แล้วลองโมเดลถัดไป
      continue;
    }
    // 404 = โมเดลไม่มี/ไม่เปิดให้ key นี้, 5xx = ปัญหาชั่วคราวฝั่ง Google (เช่น high demand)
    // ทั้งคู่ลองโมเดลถัดไปได้ เผื่ออีกตัวว่าง
    if (resp.status === 404 || resp.status >= 500) {
      fallbackStatus = resp.status;
      fallbackDetail = detail;
      continue;
    }
    // error อื่น (400 key ผิด, 403 ยังไม่เปิด API ฯลฯ) เจอเหมือนกันทุกโมเดล รายงานเลย
    return Response.json({ error: "gemini_error", detail }, { status: 502 });
  }

  // ครบทุกโมเดลแล้วยังไม่สำเร็จ: ถ้ามี 429 ให้รายงานว่าโควต้าเต็ม (สาเหตุจริง)
  if (quotaDetail) {
    return Response.json({ error: "gemini_error", detail: quotaDetail }, { status: 429 });
  }
  return Response.json({ error: "gemini_error", detail: fallbackDetail || `http_${fallbackStatus}` }, { status: 502 });
}
