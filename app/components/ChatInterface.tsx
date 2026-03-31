"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  calculate,
  formatYen,
  formatCNY,
  type Period,
  type Result,
  type Status,
  STATUS_LABELS,
} from "../lib/pension-engine";
import { DOMAINS, type DomainId } from "../lib/domains";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Phase = "idle" | "parsing" | "confirming" | "calculating" | "suggesting" | "done";

// Demo script — purely visual, no API calls
const DEMO_STEPS: { type: "chip" | "type" | "send" | "ai" | "btn" | "result" | "pause"; value: string; delay: number }[] = [
  { type: "chip", value: "来日本读过书", delay: 600 },
  { type: "chip", value: "在公司上班", delay: 500 },
  { type: "type", value: "，我今年32岁，22岁来的，26岁开始工作，年收450万", delay: 40 },
  { type: "pause", value: "", delay: 400 },
  { type: "send", value: "", delay: 300 },
  { type: "ai", value: "我理解的你的情况：\n\n当前 32 岁，计划 65 岁领取\n\n年金经历：\n  • 2016/4 ~ 2020/3  留学/读书\n  • 2020/4 ~ 2026/3  上班（年收 4,500,000 円）\n\n正确吗？", delay: 800 },
  { type: "btn", value: "确认", delay: 600 },
  { type: "result", value: "受给资格：满足（288 个月）\n\n国民年金　42,365 円/月\n厚生年金　11,841 円/月\n\n合计　54,206 円/月（约 2,644 元）\n65岁正常领取　54,206 円/月\n累计已缴　2,960,280 円", delay: 1000 },
  { type: "ai", value: "优化建议：\n\n1. 追纳学生期间 — 补缴4年约86万円，月领取额可增加约5,880円\n2. 继续工作到60岁 — 再缴28年厚生年金，合计可达约12万円/月\n3. 考虑延后领取 — 70岁开始领可增加42%", delay: 0 },
];

export default function ChatInterface({ domainId = "pension" }: { domainId?: DomainId }) {
  const domain = DOMAINS[domainId];
  const isStructured = domain.chatMode === "structured";
  const [messages, setMessages] = useState<Message[]>([]);
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
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  // Demo state
  const [demoActive, setDemoActive] = useState(false);
  const [demoMessages, setDemoMessages] = useState<Message[]>([]);
  const [demoInput, setDemoInput] = useState("");
  const [demoHighlightChips, setDemoHighlightChips] = useState<string[]>([]);
  const [demoShowLoading, setDemoShowLoading] = useState(false);
  const [demoShowConfirm, setDemoShowConfirm] = useState(false);
  const demoAbortRef = useRef(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const demoBottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setSpeechSupported(
      typeof window !== "undefined" &&
        ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
    );
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phase]);

  useEffect(() => {
    demoBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [demoMessages, demoShowLoading, demoShowConfirm]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const toggleVoice = useCallback(() => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new Ctor();
    recognition.lang = "zh-CN";
    recognition.interimResults = true;
    recognition.continuous = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r[0].transcript)
        .join("");
      setInput(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening]);

  // ─── Demo runner ───
  async function runDemo() {
    setDemoActive(true);
    setDemoMessages([]);
    setDemoInput("");
    setDemoHighlightChips([]);
    setDemoShowLoading(false);
    setDemoShowConfirm(false);
    demoAbortRef.current = false;

    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

    for (const step of DEMO_STEPS) {
      if (demoAbortRef.current) break;

      if (step.type === "chip") {
        setDemoHighlightChips((prev) => [...prev, step.value]);
        setDemoInput((prev) => (prev ? prev + "，" + step.value : step.value));
        await wait(step.delay);
      } else if (step.type === "type") {
        // Type character by character
        for (const char of step.value) {
          if (demoAbortRef.current) break;
          setDemoInput((prev) => prev + char);
          await wait(step.delay);
        }
      } else if (step.type === "pause") {
        await wait(step.delay);
      } else if (step.type === "send") {
        // Move input to user message
        setDemoMessages((prev) => {
          const inputText = "来日本读过书，在公司上班，我今年32岁，22岁来的，26岁开始工作，年收450万";
          return [...prev, { role: "user", content: inputText }];
        });
        setDemoInput("");
        setDemoHighlightChips([]);
        await wait(step.delay);
        // Show loading
        setDemoShowLoading(true);
        await wait(1200);
        setDemoShowLoading(false);
      } else if (step.type === "ai") {
        setDemoMessages((prev) => [...prev, { role: "assistant", content: step.value }]);
        if (step.value.includes("正确吗？")) {
          setDemoShowConfirm(true);
        }
        await wait(step.delay);
      } else if (step.type === "btn") {
        setDemoShowConfirm(false);
        setDemoMessages((prev) => [...prev, { role: "user", content: "确认" }]);
        await wait(300);
        setDemoShowLoading(true);
        await wait(1000);
        setDemoShowLoading(false);
      } else if (step.type === "result") {
        setDemoMessages((prev) => [...prev, { role: "assistant", content: step.value }]);
        await wait(step.delay);
      }
    }
  }

  function exitDemo() {
    demoAbortRef.current = true;
    setDemoActive(false);
    setDemoMessages([]);
    setDemoInput("");
    setDemoHighlightChips([]);
    setDemoShowLoading(false);
    setDemoShowConfirm(false);
  }

  // ─── Real chat logic ───
  async function handleSend(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || isBusy) return;
    setInput("");

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    // ─── Freeform mode (tax, etc.) ───
    if (!isStructured) {
      setPhase("parsing");
      try {
        const apiMessages = newMessages.slice(-10);
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages, domain: domainId }),
        });
        const data = await res.json();
        if (data.error) {
          setMessages([...newMessages, { role: "assistant", content: "抱歉，出错了，请重试。" }]);
        } else {
          setMessages([...newMessages, { role: "assistant", content: data.response }]);
        }
      } catch {
        setMessages([...newMessages, { role: "assistant", content: "网络错误，请重试。" }]);
      }
      setPhase("idle");
      return;
    }

    // ─── Structured mode (pension) ───
    if (phase === "confirming") {
      if (/^(好|是|对|确认|没问题|ok|yes|y|可以|正确|嗯)$/i.test(text) && parsedData) {
        doCalculate(parsedData, newMessages);
        return;
      }
      if (/^(不|否|错|改|修改|no|n|不对|不是)$/i.test(text)) {
        setPhase("idle");
        setMessages([
          ...newMessages,
          { role: "assistant", content: "好的，请告诉我哪里需要修改。" },
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
        body: JSON.stringify({ messages: apiMessages, phase: "parse", domain: domainId }),
      });
      const parsed = await res.json();

      if (parsed.error) {
        setMessages([...newMessages, { role: "assistant", content: "抱歉，出错了，请重试。" }]);
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
        setParsedData(fullData);
        setMessages([...newMessages, { role: "assistant", content: buildConfirmSummary(fullData) }]);
        setPhase("confirming");
      } else {
        let reply = parsed.response || "请再补充一些信息。";
        if (reply.includes('"complete"') || reply.includes('"data"')) {
          reply = reply.replace(/\{[\s\S]*\}/g, "").trim() || "请再补充一些信息。";
        }
        setMessages([
          ...newMessages,
          { role: "assistant", content: reply },
        ]);
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
    s += `当前 ${data.currentAge} 岁，计划 ${data.claimAge} 岁领取\n`;
    if (data.hasSpouse) s += `有配偶`;
    if (data.childrenUnder18 > 0) s += `，${data.childrenUnder18} 个未成年子女`;
    if (data.hasSpouse || data.childrenUnder18 > 0) s += "\n";
    s += "\n年金经历：\n";
    data.periods.forEach((p: Period) => {
      const label = STATUS_LABELS[p.status as Status]?.label || p.status;
      s += `  • ${p.fromYear}/${p.fromMonth} ~ ${p.toYear}/${p.toMonth}  ${label}`;
      if (p.annualIncome > 0) s += `（年收 ${formatYen(p.annualIncome)} 円）`;
      s += "\n";
    });
    s += "\n正确吗？";
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
          { role: "assistant", content: suggestData.suggestions },
        ]);
      }
    } catch {
      // optional
    }
    setPhase("done");
  }

  function buildResultMessage(r: Result): string {
    let s = "";
    s += r.qualified
      ? `受给资格：满足（${r.qualifiedMonths} 个月）\n\n`
      : `受给资格：不足（${r.qualifiedMonths} / 120 个月）\n\n`;

    s += `国民年金　${formatYen(r.nationalPart)} 円/月\n`;
    if (r.kouseiPart > 0) s += `厚生年金　${formatYen(r.kouseiPart)} 円/月\n`;
    if (r.fukaPart > 0) s += `付加年金　${formatYen(r.fukaPart)} 円/月\n`;
    if (r.kakyuPart > 0) s += `加给年金　${formatYen(r.kakyuPart)} 円/年\n`;

    s += `\n合计　${formatYen(r.monthlyBenefit)} 円/月`;
    s += `（约 ${formatCNY(r.monthlyBenefit)} 元）\n`;
    s += `${r.adjustedLabel}　${formatYen(r.adjustedMonthly)} 円/月\n`;
    s += `累计已缴　${formatYen(r.totalPaid)} 円`;

    return s;
  }

  function handleReset() {
    setMessages([]);
    setPhase("idle");
    setParsedData(null);
    setResult(null);
  }

  const showWelcome = messages.length === 0 && phase === "idle" && !demoActive;
  const isBusy = phase === "parsing" || phase === "calculating" || phase === "suggesting";

  const CHIPS = domain.chips;

  // ─── Demo view ───
  if (demoActive) {
    return (
      <div className="flex flex-col h-[600px]">
        {/* Demo banner */}
        <div className="flex items-center justify-between px-4 py-2 bg-blue-50 border-b border-blue-100">
          <span className="text-xs text-blue-600">演示中</span>
          <button onClick={exitDemo} className="text-xs text-blue-500 hover:text-blue-700">
            退出演示，开始使用
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Demo chips (shown at start) */}
          {demoMessages.length === 0 && (
            <div className="flex flex-col items-center pt-4 pb-2">
              <p className="text-sm text-gray-400 mb-1">告诉我你在日本的经历</p>
              <p className="text-xs text-gray-300 mb-4">我来算你的养老金</p>
              <div className="flex flex-wrap justify-center gap-2 max-w-[320px]">
                {CHIPS.map((chip) => (
                  <span
                    key={chip}
                    className={`px-3 py-1.5 text-xs rounded-full border transition-all duration-300 ${
                      demoHighlightChips.includes(chip)
                        ? "border-blue-400 text-blue-600 bg-blue-50 scale-105"
                        : "border-gray-200 text-gray-400"
                    }`}
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Demo messages */}
          {demoMessages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                  m.role === "user"
                    ? "bg-blue-600 text-white rounded-br-sm"
                    : "bg-gray-50 text-gray-800 rounded-bl-sm"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}

          {/* Demo loading */}
          {demoShowLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-50 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}

          {/* Demo confirm buttons */}
          {demoShowConfirm && (
            <div className="flex gap-2 justify-center">
              <span className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded-full animate-pulse">
                正确，开始计算
              </span>
              <span className="px-4 py-1.5 text-gray-500 text-xs rounded-full border border-gray-200">
                需要修改
              </span>
            </div>
          )}

          <div ref={demoBottomRef} />
        </div>

        {/* Demo input area (visual only) */}
        <div className="border-t border-gray-100 p-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <div className="w-full border border-gray-200 rounded-2xl px-4 py-2.5 text-sm min-h-[42px] leading-relaxed">
                {demoInput ? (
                  <span>{demoInput}<span className="animate-pulse">|</span></span>
                ) : (
                  <span className="text-gray-300">我32岁，22岁来日本读书，26岁开始工作，年收450万...</span>
                )}
              </div>
            </div>
            <div className={`p-2 flex-shrink-0 transition-colors ${demoInput ? "text-blue-600" : "text-gray-300"}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Real view ───
  return (
    <div className="flex flex-col h-[600px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Welcome */}
        {showWelcome && (
          <div className="flex flex-col items-center justify-center h-full px-2">
            <p className="text-sm text-gray-400 mb-1">{domain.welcomeTitle}</p>
            <p className="text-xs text-gray-300 mb-5">{domain.welcomeSubtitle}</p>
            <div className="flex flex-wrap justify-center gap-2 max-w-[320px]">
              {CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => {
                    if (isStructured) {
                      setInput((prev) => (prev ? prev + "，" + chip : chip));
                    } else {
                      setInput(chip);
                    }
                    textareaRef.current?.focus();
                  }}
                  className="px-3 py-1.5 text-xs text-gray-400 border border-gray-200 rounded-full hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/50 transition-all"
                >
                  {chip}
                </button>
              ))}
            </div>
            {isStructured && (
              <button
                onClick={runDemo}
                className="mt-6 px-5 py-2 text-sm text-blue-600 border border-blue-200 rounded-full hover:bg-blue-50 transition-all flex items-center gap-1.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                看演示
              </button>
            )}
          </div>
        )}

        {/* Messages */}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                m.role === "user"
                  ? "bg-blue-600 text-white rounded-br-sm"
                  : "bg-gray-50 text-gray-800 rounded-bl-sm"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {/* Loading */}
        {isBusy && (
          <div className="flex justify-start">
            <div className="bg-gray-50 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
              <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        {/* Confirm actions (structured only) */}
        {isStructured && phase === "confirming" && (
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => handleSend("确认")}
              className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded-full hover:bg-blue-700 transition-colors"
            >
              正确，开始计算
            </button>
            <button
              onClick={() => handleSend("不对")}
              className="px-4 py-1.5 text-gray-500 text-xs rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              需要修改
            </button>
          </div>
        )}

        {/* Done */}
        {phase === "done" && (
          <div className="flex justify-center">
            <button
              onClick={handleReset}
              className="text-xs text-gray-400 hover:text-blue-600 transition-colors py-1"
            >
              重新计算
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 p-3">
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={1}
              placeholder={
                showWelcome
                  ? domain.placeholder
                  : phase === "done"
                    ? "还有什么想问的..."
                    : "继续说..."
              }
              className="w-full border border-gray-200 rounded-2xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:border-gray-300 resize-none leading-relaxed placeholder:text-gray-300"
              disabled={isBusy}
              style={{ minHeight: "42px", maxHeight: "120px" }}
            />
            {speechSupported && (
              <button
                onClick={toggleVoice}
                disabled={isBusy}
                className={`absolute right-2.5 bottom-2.5 p-1 rounded-full transition-all ${
                  isListening
                    ? "text-red-500 animate-pulse"
                    : "text-gray-300 hover:text-gray-500"
                } disabled:opacity-30`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
              </button>
            )}
          </div>
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isBusy}
            className="text-gray-300 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors p-2 flex-shrink-0"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
        {isListening && (
          <p className="text-[11px] text-red-400 mt-1 text-center animate-pulse">正在听...</p>
        )}
      </div>
    </div>
  );
}
