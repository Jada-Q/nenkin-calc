import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const PARSE_SYSTEM = `你是日本年金计算助手。用户会用中文描述自己在日本的工作和生活经历，你需要提取结构化数据。

需要提取的字段：
- currentAge: 当前年龄（整数）
- claimAge: 计划领取年龄（默认65）
- hasSpouse: 是否有配偶（boolean）
- spouseUnder65: 配偶是否65岁以下（boolean，无配偶则false）
- childrenUnder18: 18岁以下子女数（整数，默认0）
- periods: 年金缴纳期间数组

每个period包含：
- status: 以下之一：employed（上班）, student（留学/读书）, unemployed（无职业正常缴纳）, dependent（主妇/主夫第3号）, maternity（产假/育休）, sickleave（病休/休职）, exempt_full（全额免除）, exempt_3q（3/4免除）, exempt_half（半额免除）, exempt_1q（1/4免除）, yuuyo（纳付猶予）, unpaid（未纳/滞纳）, overseas（海外居住カラ期間）, voluntary60（60-65岁任意加入）
- fromYear, fromMonth: 开始年月
- toYear, toMonth: 结束年月
- annualIncome: 年收入（日元，仅employed/maternity/sickleave需要，其他为0）
- hasFuka: 是否缴纳付加年金（boolean，仅unemployed/voluntary60可为true）
- 追納: 是否追纳（boolean，仅student/exempt*/yuuyo相关）

规则：
1. 用户说"来日本读书"→ student
2. 用户说"开始工作/上班"→ employed
3. 用户说"辞职/无职"→ unemployed
4. 用户说"全职主妇/主夫"→ dependent
5. 用户说"产假/育休"→ maternity
6. 用户说"病休/休职"→ sickleave
7. 用户说"拇指职业"或"拇指/主妇/主夫"→ dependent
8. 年收入用户可能说"年收500万"→ 5000000，"月薪30万"→ 3600000
9. 如果用户没提到付加年金，默认false
10. 如果用户没提到追纳，默认false
11. 如果信息不足，在response字段中用中文追问缺少的信息
12. 如果用户没有提到年收入但提到在公司上班，设年收入为0并在response中追问

重要：你的回复必须是且仅是一个JSON对象，不要有任何其他文字、不要代码块、不要反引号。格式：
{"complete":true或false,"response":"给用户的中文回复","data":{"currentAge":数字,"claimAge":数字,"hasSpouse":布尔,"spouseUnder65":布尔,"childrenUnder18":数字,"periods":[...]}}

如果信息不足，complete设为false，在response中追问，data可以为null。
如果用户输入不正经或无关内容，response中礼貌引导回年金话题。`;

const SUGGEST_SYSTEM = `你是日本年金优化顾问，面向在日华人。根据用户的年金计算结果，给出2-4条具体可操作的优化建议。

规则：
1. 用中文回复
2. 每条建议要有具体的金额影响估算
3. 考虑用户的实际情况（年龄、工作状态等）
4. 不要推荐不切实际的方案
5. 优先级从高到低排列
6. 语气亲切专业，像朋友给建议`;

export async function POST(req: NextRequest) {
  try {
    const { messages, phase, calculationResult } = await req.json();

    if (!messages || !phase) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    if (phase === "parse") {
      // Gemini requires strictly alternating user/model turns
      // Merge consecutive same-role messages and ensure it starts with user
      const rawHistory = messages.slice(0, -1).map((m: { role: string; content: string }) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      const chatHistory: { role: string; parts: { text: string }[] }[] = [];
      for (const msg of rawHistory) {
        const last = chatHistory[chatHistory.length - 1];
        if (last && last.role === msg.role) {
          // Merge consecutive same-role messages
          last.parts[0].text += "\n" + msg.parts[0].text;
        } else {
          chatHistory.push(msg);
        }
      }
      // Gemini history must start with "user" — drop leading "model" messages
      while (chatHistory.length > 0 && chatHistory[0].role === "model") {
        chatHistory.shift();
      }

      const chat = model.startChat({
        history: chatHistory,
        systemInstruction: { role: "user", parts: [{ text: PARSE_SYSTEM }] },
      });

      const lastMessage = messages[messages.length - 1]?.content || "";
      const result = await chat.sendMessage(lastMessage);
      const text = result.response.text();

      let parsed;
      try {
        // Extract JSON from response - handle mixed text+JSON, code fences, etc.
        let cleaned = text;
        // Remove markdown code fences
        cleaned = cleaned.replace(/```json\s*/g, "").replace(/```\s*/g, "");
        // Try to find JSON object in the text
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          parsed = JSON.parse(cleaned.trim());
        }
      } catch {
        // If JSON parsing fails completely, extract any useful text for the user
        // but never show raw JSON
        const cleanText = text
          .replace(/```json\s*/g, "").replace(/```\s*/g, "")
          .replace(/\{[\s\S]*\}/g, "") // remove any JSON fragments
          .trim();
        parsed = {
          complete: false,
          response: cleanText || "请再详细描述一下你的情况，包括年龄、在日经历和年收入。",
          data: null,
        };
      }

      // Validate parsed response has required fields
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
        contents: [
          {
            role: "user",
            parts: [{ text: `用户描述：${userContext}\n\n计算结果：${JSON.stringify(calculationResult, null, 2)}\n\n请给出优化建议。` }],
          },
        ],
        systemInstruction: { role: "user", parts: [{ text: SUGGEST_SYSTEM }] },
      });

      const text = result.response.text();
      return NextResponse.json({ suggestions: text });
    }

    return NextResponse.json({ error: "Invalid phase" }, { status: 400 });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Chat API error:", errMsg, error);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
