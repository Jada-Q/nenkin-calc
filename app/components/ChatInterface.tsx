"use client";
import { useState, useRef, useEffect } from "react";
import {
  calculate,
  formatYen,
  formatCNY,
  type Period,
  type Result,
  type Status,
  STATUS_LABELS,
} from "../lib/pension-engine";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Phase = "idle" | "parsing" | "confirming" | "calculating" | "suggesting" | "done";

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "你好！我是你的日本年金计算助手 🎌\n\n请告诉我你在日本的经历，比如：\n\n「我今年32岁，22岁来日本读了4年书，26岁开始工作到现在，年收450万日元」\n\n我会帮你算出65岁后每月能领多少养老金，并给出优化建议。",
    },
  ]);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [parsedData, setParsedData] = useState<{
    currentAge: number;
    claimAge: number;
    hasSpouse: boolean;
    spouseUnder65: boolean;
    childrenUnder18: number;
    periods: Period[];
  } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phase]);

  async function handleSend() {
    const text = input.trim();
    if (!text || phase === "parsing" || phase === "suggesting") return;
    setInput("");

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    if (phase === "confirming") {
      const isYes = /^(好|是|对|确认|没问题|ok|yes|y|可以|正确|嗯)$/i.test(text);
      if (isYes && parsedData) {
        doCalculate(parsedData, newMessages);
        return;
      }
      const isNo = /^(不|否|错|改|修改|no|n|不对|不是)$/i.test(text);
      if (isNo) {
        setPhase("idle");
        setMessages([
          ...newMessages,
          { role: "assistant", content: "好的，请告诉我哪里需要修改，或者重新描述一下你的情况。" },
        ]);
        return;
      }
    }

    setPhase("parsing");
    try {
      const apiMessages = newMessages
        .filter((m) => m.role === "user" || (m.role === "assistant" && !m.content.startsWith("📊")))
        .slice(-6);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, phase: "parse" }),
      });
      const parsed = await res.json();

      if (parsed.error) {
        setMessages([...newMessages, { role: "assistant", content: "抱歉，处理出错了，请重试。" }]);
        setPhase("idle");
        return;
      }

      if (parsed.complete && parsed.data) {
        const data = parsed.data;
        const periods: Period[] = (data.periods || []).map((p: Period, i: number) => ({
          ...p,
          id: i,
          annualIncome: p.annualIncome || 0,
          hasFuka: p.hasFuka || false,
          追納: p.追納 || false,
        }));
        const fullData = { ...data, periods };

        const summary = buildConfirmSummary(fullData);
        setParsedData(fullData);
        setMessages([...newMessages, { role: "assistant", content: summary }]);
        setPhase("confirming");
      } else {
        setMessages([...newMessages, { role: "assistant", content: parsed.response || "请补充更多信息。" }]);
        setPhase("idle");
      }
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "网络错误，请重试。" }]);
      setPhase("idle");
    }
  }

  function buildConfirmSummary(data: {
    currentAge: number;
    claimAge: number;
    hasSpouse: boolean;
    childrenUnder18: number;
    periods: Period[];
  }): string {
    let s = "我理解的你的情况：\n\n";
    s += `📋 当前 ${data.currentAge} 岁，计划 ${data.claimAge} 岁领取\n`;
    if (data.hasSpouse) s += `👫 有配偶`;
    if (data.childrenUnder18 > 0) s += `，${data.childrenUnder18} 个未成年子女`;
    if (data.hasSpouse || data.childrenUnder18 > 0) s += "\n";
    s += "\n⏱️ 年金经历：\n";
    data.periods.forEach((p: Period) => {
      const label = STATUS_LABELS[p.status as Status]?.label || p.status;
      s += `  • ${p.fromYear}/${p.fromMonth} ~ ${p.toYear}/${p.toMonth}：${label}`;
      if (p.annualIncome > 0) s += `（年收 ${formatYen(p.annualIncome)} 円）`;
      s += "\n";
    });
    s += "\n信息正确吗？回复「确认」开始计算，或告诉我哪里需要修改。";
    return s;
  }

  async function doCalculate(
    data: {
      currentAge: number;
      claimAge: number;
      hasSpouse: boolean;
      spouseUnder65: boolean;
      childrenUnder18: number;
      periods: Period[];
    },
    currentMessages: Message[]
  ) {
    setPhase("calculating");

    const calcResult = calculate(
      data.periods,
      data.currentAge,
      data.claimAge,
      data.hasSpouse,
      data.spouseUnder65,
      data.childrenUnder18
    );
    setResult(calcResult);

    const resultMsg = buildResultMessage(calcResult);
    const withResult = [...currentMessages, { role: "assistant" as const, content: resultMsg }];
    setMessages(withResult);

    setPhase("suggesting");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: currentMessages.filter((m) => m.role === "user").slice(-3),
          phase: "suggest",
          calculationResult: calcResult,
        }),
      });
      const suggestData = await res.json();

      if (suggestData.suggestions) {
        setMessages([
          ...withResult,
          { role: "assistant", content: `💡 **优化建议：**\n\n${suggestData.suggestions}` },
        ]);
      }
    } catch {
      // suggestions are optional, don't show error
    }
    setPhase("done");
  }

  function buildResultMessage(r: Result): string {
    let s = "📊 **计算结果：**\n\n";
    s += r.qualified
      ? `✅ 受给资格：满足（${r.qualifiedMonths} 个月 ≥ 120 个月）\n\n`
      : `❌ 受给资格：不足（${r.qualifiedMonths} 个月 < 120 个月）\n\n`;

    s += `🏛️ 国民年金：${formatYen(r.nationalPart)} 円/月\n`;
    s += `🏢 厚生年金：${formatYen(r.kouseiPart)} 円/月\n`;
    if (r.fukaPart > 0) s += `➕ 付加年金：${formatYen(r.fukaPart)} 円/月\n`;
    if (r.kakyuPart > 0) s += `👨‍👩‍👧 加给年金：${formatYen(r.kakyuPart)} 円/年\n`;

    s += `\n**合计：${formatYen(r.monthlyBenefit)} 円/月**（约 ${formatCNY(r.monthlyBenefit)} 元人民币）\n`;
    s += `年额：${formatYen(r.yearlyBenefit)} 円\n\n`;

    s += `${r.adjustedLabel}：${formatYen(r.adjustedMonthly)} 円/月\n`;
    s += `累计已缴保费：${formatYen(r.totalPaid)} 円`;

    return s;
  }

  function handleReset() {
    setMessages([
      {
        role: "assistant",
        content: "好的，让我们重新开始。请描述你在日本的经历。",
      },
    ]);
    setPhase("idle");
    setParsedData(null);
    setResult(null);
  }

  return (
    <div className="flex flex-col h-[600px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                m.role === "user"
                  ? "bg-blue-600 text-white rounded-br-md"
                  : "bg-white border border-gray-200 text-gray-800 rounded-bl-md"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {(phase === "parsing" || phase === "calculating" || phase === "suggesting") && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm text-gray-400">
              {phase === "parsing" && "正在分析..."}
              {phase === "calculating" && "正在计算..."}
              {phase === "suggesting" && "正在生成建议..."}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gray-200 p-3 bg-white">
        {phase === "done" && (
          <button
            onClick={handleReset}
            className="w-full mb-2 text-sm text-blue-600 hover:text-blue-800 py-1"
          >
            重新计算
          </button>
        )}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder={
              phase === "confirming"
                ? "回复「确认」或修改信息..."
                : phase === "done"
                  ? "可以继续问问题..."
                  : "描述你在日本的经历..."
            }
            className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            disabled={phase === "parsing" || phase === "calculating" || phase === "suggesting"}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || phase === "parsing" || phase === "calculating" || phase === "suggesting"}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
