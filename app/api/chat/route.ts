import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { PENSION_PARSE_SYSTEM, PENSION_SUGGEST_SYSTEM } from "../../lib/prompts/pension";
import { TAX_SYSTEM } from "../../lib/prompts/tax";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

function buildGeminiHistory(messages: { role: string; content: string }[]) {
  const raw = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  // Merge consecutive same-role messages
  const merged: { role: string; parts: { text: string }[] }[] = [];
  for (const msg of raw) {
    const last = merged[merged.length - 1];
    if (last && last.role === msg.role) {
      last.parts[0].text += "\n" + msg.parts[0].text;
    } else {
      merged.push(msg);
    }
  }
  // Must start with "user"
  while (merged.length > 0 && merged[0].role === "model") {
    merged.shift();
  }
  return merged;
}

function parseJsonResponse(text: string, fallbackMsg: string) {
  try {
    let cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "");
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return JSON.parse(cleaned.trim());
  } catch {
    const cleanText = text
      .replace(/```json\s*/g, "").replace(/```\s*/g, "")
      .replace(/\{[\s\S]*\}/g, "")
      .trim();
    return { complete: false, response: cleanText || fallbackMsg, data: null };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { messages, phase, calculationResult, domain = "pension" } = await req.json();

    if (!messages) {
      return NextResponse.json({ error: "Missing messages" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // ─── Freeform domains (tax, etc.) ───
    if (domain === "tax") {
      const history = buildGeminiHistory(messages.slice(0, -1));
      const chat = model.startChat({
        history,
        systemInstruction: { role: "user", parts: [{ text: TAX_SYSTEM }] },
      });
      const lastMessage = messages[messages.length - 1]?.content || "";
      const result = await chat.sendMessage(lastMessage);
      return NextResponse.json({ response: result.response.text() });
    }

    // ─── Structured domain (pension) ───
    if (phase === "parse") {
      const history = buildGeminiHistory(messages.slice(0, -1));
      const chat = model.startChat({
        history,
        systemInstruction: { role: "user", parts: [{ text: PENSION_PARSE_SYSTEM }] },
      });
      const lastMessage = messages[messages.length - 1]?.content || "";
      const result = await chat.sendMessage(lastMessage);
      const parsed = parseJsonResponse(
        result.response.text(),
        "请再详细描述一下你的情况，包括年龄、在日经历和年收入。"
      );
      if (!parsed.response && !parsed.complete) {
        parsed.response = "请再详细描述一下你的情况。";
      }
      return NextResponse.json(parsed);
    }

    if (phase === "suggest") {
      if (!calculationResult) {
        return NextResponse.json({ error: "Missing calculationResult" }, { status: 400 });
      }
      const userContext = messages[messages.length - 1]?.content || "";
      const result = await model.generateContent({
        contents: [{
          role: "user",
          parts: [{ text: `用户描述：${userContext}\n\n计算结果：${JSON.stringify(calculationResult, null, 2)}\n\n请给出优化建议。` }],
        }],
        systemInstruction: { role: "user", parts: [{ text: PENSION_SUGGEST_SYSTEM }] },
      });
      return NextResponse.json({ suggestions: result.response.text() });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Chat API error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
