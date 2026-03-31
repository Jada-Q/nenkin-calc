import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

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
7. 年收入用户可能说"年收500万"→ 5000000，"月薪30万"→ 3600000
8. 如果用户没提到付加年金，默认false
9. 如果用户没提到追纳，默认false
10. 如果信息不足，在response字段中用中文追问缺少的信息

返回严格JSON格式（不要markdown代码块）：
{
  "complete": true/false,
  "response": "给用户的中文回复（确认理解或追问）",
  "data": { currentAge, claimAge, hasSpouse, spouseUnder65, childrenUnder18, periods: [...] }
}

如果信息不足以计算，complete设为false，data可以是部分数据或null。`;

const SUGGEST_SYSTEM = `你是日本年金优化顾问，面向在日华人。根据用户的年金计算结果，给出2-4条具体可操作的优化建议。

规则：
1. 用中文回复
2. 每条建议要有具体的金额影响估算
3. 考虑用户的实际情况（年龄、工作状态等）
4. 不要推荐不切实际的方案
5. 优先级从高到低排列
6. 语气亲切专业，像朋友给建议

常见优化方向：
- 追纳（补缴免除/猶予期间）
- 付加年金（每月多交400日元，领取时每月多200×月数）
- 延后领取（每延1个月+0.7%，最多75岁+84%）
- 提前领取的代价（每提前1个月-0.4%）
- 增加厚生年金月数（继续工作）
- 任意加入（60-65岁补缴）
- iDeCo等补充养老方案（简要提及）`;

export async function POST(req: NextRequest) {
  try {
    const { messages, phase, calculationResult } = await req.json();

    if (!messages || !phase) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (phase === "parse") {
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: PARSE_SYSTEM,
        messages: messages.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { complete: false, response: text, data: null };
      }

      return NextResponse.json(parsed);
    }

    if (phase === "suggest") {
      if (!calculationResult) {
        return NextResponse.json({ error: "Missing calculationResult" }, { status: 400 });
      }

      const userContext = messages[messages.length - 1]?.content || "";
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: SUGGEST_SYSTEM,
        messages: [
          {
            role: "user",
            content: `用户描述：${userContext}\n\n计算结果：${JSON.stringify(calculationResult, null, 2)}\n\n请给出优化建议。`,
          },
        ],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      return NextResponse.json({ suggestions: text });
    }

    return NextResponse.json({ error: "Invalid phase" }, { status: 400 });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
