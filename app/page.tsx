"use client";
import { useState } from "react";
import ChatInterface from "./components/ChatInterface";
import Calculator from "./components/Calculator";

type Tab = "chat" | "manual";

export default function Home() {
  const [tab, setTab] = useState<Tab>("chat");

  return (
    <main className="max-w-lg mx-auto px-4 py-8 min-h-screen">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-800">日本年金计算器</h1>
        <p className="text-sm text-gray-500 mt-1">
          按你的真实经历，精确计算65岁后能领多少
        </p>
        <p className="text-xs text-gray-400 mt-1">
          2026年度最新 | 支持免除细分/产假育休/病休/提前延后领取/加给年金
        </p>
      </header>

      <div className="flex mb-4 bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setTab("chat")}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
            tab === "chat"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          AI 对话
        </button>
        <button
          onClick={() => setTab("manual")}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
            tab === "manual"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          手动计算
        </button>
      </div>

      {tab === "chat" ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <ChatInterface />
        </div>
      ) : (
        <Calculator />
      )}

      <footer className="mt-10 text-center text-xs text-gray-400 space-y-1">
        <p>数据来源：日本年金機構 / 厚生労働省 2026年度</p>
        <p>纯前端计算，不收集任何个人数据</p>
      </footer>
    </main>
  );
}
