"use client";
import { useState } from "react";
import ChatInterface from "./components/ChatInterface";
import Calculator from "./components/Calculator";
import { DOMAINS, type DomainId } from "./lib/domains";

export default function Home() {
  const [selectedDomain, setSelectedDomain] = useState<DomainId | null>(null);
  const [showManual, setShowManual] = useState(false);

  // ─── Domain selector ───
  if (!selectedDomain) {
    return (
      <main className="max-w-lg mx-auto px-4 py-12 min-h-screen">
        <header className="mb-10 text-center">
          <h1 className="text-2xl font-bold text-gray-800">在日FP助手</h1>
          <p className="text-sm text-gray-400 mt-1">FP2級監修 | 2026年度最新</p>
        </header>

        <div className="space-y-3">
          {Object.values(DOMAINS).map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedDomain(d.id)}
              className="w-full flex items-center gap-4 bg-white rounded-2xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all text-left group"
            >
              <span className="text-3xl">{d.icon}</span>
              <div>
                <p className="font-medium text-gray-800 group-hover:text-blue-600 transition-colors">
                  {d.label}
                </p>
                <p className="text-sm text-gray-400">{d.description}</p>
              </div>
              <svg className="ml-auto text-gray-300 group-hover:text-blue-400 transition-colors" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          ))}
        </div>

        <footer className="mt-12 text-center text-xs text-gray-300 space-y-1">
          <p>数据来源：日本年金機構 / 国税庁 2026年度</p>
          <p>纯前端计算，不收集任何个人数据</p>
        </footer>
      </main>
    );
  }

  const domain = DOMAINS[selectedDomain];

  // ─── Domain chat view ───
  return (
    <main className="max-w-lg mx-auto px-4 py-8 min-h-screen">
      <header className="mb-4">
        <button
          onClick={() => { setSelectedDomain(null); setShowManual(false); }}
          className="text-xs text-gray-400 hover:text-blue-600 transition-colors flex items-center gap-1 mb-3"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          返回
        </button>
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-800">
            {domain.icon} {domain.label}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">{domain.description}</p>
        </div>
      </header>

      {/* Tab toggle — only for pension which has a manual calculator */}
      {selectedDomain === "pension" && (
        <div className="flex mb-4 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setShowManual(false)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              !showManual ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"
            }`}
          >
            AI 对话
          </button>
          <button
            onClick={() => setShowManual(true)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              showManual ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"
            }`}
          >
            手动计算
          </button>
        </div>
      )}

      {showManual && selectedDomain === "pension" ? (
        <Calculator />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <ChatInterface domainId={selectedDomain} />
        </div>
      )}

      <footer className="mt-8 text-center text-xs text-gray-300">
        <p>FP2級監修 | 不构成法律或财务建议</p>
      </footer>
    </main>
  );
}
