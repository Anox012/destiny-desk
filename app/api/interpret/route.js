// ทำนายไพ่ด้วย Google Gemini (free tier) — เรียกฝั่ง server เท่านั้น กัน API key หลุดไปหน้าเว็บ
// จำกัด maxOutputTokens ให้คำตอบสั้นกระชับ ประหยัดโควต้าฟรี
// endpoint นี้เป็น URL สาธารณะ ใครก็ยิงตรงได้ (ไม่ใช่แค่ผ่านหน้าเว็บ) จึงเช็ค origin +
// จำกัดรูปร่าง/ขนาด payload คร่าวๆ กันสแปมยิงรัวๆ จนโควต้าฟรีหมดเร็วเกินไป — ไม่ใช่การยืนยันตัวตนที่รัดกุม

const MODEL = "gemini-2.0-flash";
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

  const prompt = `คุณคือนักอ่านไพ่ทาโรต์แนว Storytelling และ Tarot Therapy ที่เข้าใจชีวิตมนุษย์ ให้คำทำนายที่อบอุ่น จับต้องได้ และนำไปใช้จริงได้

ข้อมูลผู้ถาม:
- ชื่อ: ${clip(userName) || "ไม่ระบุ"}
- วัตถุประสงค์: ${clip(purpose) || "ภาพรวมชีวิต"}
- คำถาม: ${clip(question) || "ขอคำแนะนำภาพรวม"}
- รูปแบบการวางไพ่: ${clip(spreadLabel) || "-"}

ไพ่ที่เลือกได้:
${cardLines}

กรุณาวิเคราะห์ความหมายไพ่ทั้งหมด โดยเชื่อมโยงกับคำถามของผู้ถามจริง ๆ เขียนให้กระชับ ไม่เกิน 5 ย่อหน้าสั้น ๆ
ปิดท้ายด้วยการย้ำว่าไพ่เป็นเพียงเครื่องมือสะท้อนทางเลือก ให้ผู้ใช้เป็นผู้ตัดสินใจเอง ไม่ใช่คำแนะนำทางกฎหมาย การแพทย์ หรือการเงิน`;

  let resp;
  try {
    resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 700, temperature: 0.85 },
        }),
      }
    );
  } catch (_) {
    return Response.json({ error: "network_error" }, { status: 502 });
  }

  if (!resp.ok) {
    const status = resp.status === 429 ? 429 : 502;
    return Response.json({ error: "gemini_error" }, { status });
  }

  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("").trim();

  if (!text) {
    return Response.json({ error: "empty_response" }, { status: 502 });
  }

  return Response.json({ text });
}
