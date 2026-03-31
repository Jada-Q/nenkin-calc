"use client";

import { useState } from "react";

// 2026年度 最新データ
const NATIONAL_FULL_MONTHLY = 70608;
const NATIONAL_FULL_MONTHS = 480;
const NATIONAL_PREMIUM = 17920;
const KOUSEI_RATE = 0.005481;
const KOUSEI_PREMIUM_RATE = 0.0915;
const MIN_MONTHS = 120;

type Status = "student" | "employed" | "unemployed" | "dependent" | "exempt" | "maternity" | "sickleave";

const STATUS_LABELS: Record<Status, { label: string; desc: string }> = {
  employed: { label: "上班", desc: "公司员工，厚生年金，公司付一半" },
  student: { label: "留学/读书", desc: "可申请学生特例免缴" },
  unemployed: { label: "无职业", desc: "应自缴国民年金" },
  dependent: { label: "主妇/主夫", desc: "配偶交厚生年金，自己不用交" },
  maternity: { label: "产假/育休", desc: "保费全免，但年金按休假前工资照算" },
  sickleave: { label: "病休/休职", desc: "继续缴纳厚生年金，按休假前工资算" },
  exempt: { label: "免除/猶予", desc: "申请了免除，领取额减半" },
};

type Period = {
  id: number;
  status: Status;
  fromYear: number;
  fromMonth: number;
  toYear: number;
  toMonth: number;
  annualIncome: number;
};

type Result = {
  monthlyBenefit: number;
  yearlyBenefit: number;
  qualified: boolean;
  qualifiedMonths: number;
  nationalPart: number;
  kouseiPart: number;
  totalPaid: number;
  periods: {
    status: Status;
    months: number;
    nationalMonths: number;
    kouseiMonths: number;
    paid: number;
    kouseiIncome: number;
  }[];
  futureMonths: number;
};

function monthsBetween(
  fy: number, fm: number, ty: number, tm: number
): number {
  return Math.max((ty - fy) * 12 + (tm - fm), 0);
}

function calculate(periods: Period[], currentAge: number): Result {
  const periodResults = periods.map((p) => {
    const months = monthsBetween(p.fromYear, p.fromMonth, p.toYear, p.toMonth);
    let nationalMonths = 0;
    let kouseiMonths = 0;
    let paid = 0;
    let kouseiIncome = 0;

    switch (p.status) {
      case "employed":
        nationalMonths = months;
        kouseiMonths = months;
        kouseiIncome = p.annualIncome;
        paid = Math.round((p.annualIncome / 12) * KOUSEI_PREMIUM_RATE) * months;
        break;
      case "student":
        // 学生特例：算入资格期间，但领取额为0（除非后来追纳）
        nationalMonths = 0;
        paid = 0;
        break;
      case "unemployed":
        // 假设正常缴纳国民年金
        nationalMonths = months;
        paid = NATIONAL_PREMIUM * months;
        break;
      case "dependent":
        // 第3号：不用交钱，但国民年金满额计算
        nationalMonths = months;
        paid = 0;
        break;
      case "maternity":
        // 産休/育休：保费全免，但厚生年金记录照算（按休假前工资）
        nationalMonths = months;
        kouseiMonths = months;
        kouseiIncome = p.annualIncome;
        paid = 0; // 保费全免（公司和个人都免）
        break;
      case "sickleave":
        // 病休/休职：继续缴纳厚生年金（按休假前标准報酬月額）
        nationalMonths = months;
        kouseiMonths = months;
        kouseiIncome = p.annualIncome;
        paid = Math.round((p.annualIncome / 12) * KOUSEI_PREMIUM_RATE) * months;
        break;
      case "exempt":
        // 全額免除：算入资格期间，领取额算一半
        nationalMonths = Math.round(months / 2);
        paid = 0;
        break;
    }

    return {
      status: p.status,
      months,
      nationalMonths,
      kouseiMonths,
      paid,
      kouseiIncome,
    };
  });

  // 未来到60岁的月数（假设维持最后一段的状态，或者单独计算）
  const futureMonths = Math.max((60 - currentAge) * 12, 0);

  // 合计
  const totalNationalMonths = Math.min(
    periodResults.reduce((s, p) => s + p.nationalMonths, 0) + futureMonths,
    NATIONAL_FULL_MONTHS
  );

  // 资格判定月数（学生特例和免除也算资格期间）
  const qualifiedMonths =
    periodResults.reduce((s, p) => s + p.months, 0) + futureMonths;
  const qualified = qualifiedMonths >= MIN_MONTHS;

  // 国民年金部分
  const nationalPart = Math.round(
    (NATIONAL_FULL_MONTHLY * totalNationalMonths) / NATIONAL_FULL_MONTHS
  );

  // 厚生年金部分（各段分别计算后合计）
  const kouseiPart = periodResults.reduce((sum, p) => {
    if (p.kouseiMonths > 0 && p.kouseiIncome > 0) {
      return sum + Math.round(
        (p.kouseiIncome / 12) * KOUSEI_RATE * p.kouseiMonths
      );
    }
    return sum;
  }, 0);

  const totalPaid = periodResults.reduce((s, p) => s + p.paid, 0);
  const monthlyBenefit = nationalPart + kouseiPart;

  return {
    monthlyBenefit,
    yearlyBenefit: monthlyBenefit * 12,
    qualified,
    qualifiedMonths: Math.min(qualifiedMonths, NATIONAL_FULL_MONTHS),
    nationalPart,
    kouseiPart,
    totalPaid,
    periods: periodResults,
    futureMonths,
  };
}

function formatYen(n: number) {
  return n.toLocaleString("ja-JP");
}

function formatCNY(yen: number) {
  return Math.round(yen / 20.5).toLocaleString("zh-CN");
}

let nextId = 2;

export default function Home() {
  const [currentAge, setCurrentAge] = useState(36);
  const [periods, setPeriods] = useState<Period[]>([
    {
      id: 1,
      status: "employed",
      fromYear: 2015,
      fromMonth: 4,
      toYear: 2023,
      toMonth: 3,
      annualIncome: 3500000,
    },
  ]);
  const [result, setResult] = useState<Result | null>(null);

  function addPeriod() {
    const last = periods[periods.length - 1];
    setPeriods([
      ...periods,
      {
        id: nextId++,
        status: "unemployed",
        fromYear: last?.toYear ?? 2024,
        fromMonth: last?.toMonth ?? 4,
        toYear: 2026,
        toMonth: 3,
        annualIncome: 0,
      },
    ]);
  }

  function updatePeriod(id: number, patch: Partial<Period>) {
    setPeriods((ps) =>
      ps.map((p) => (p.id === id ? { ...p, ...patch } : p))
    );
  }

  function removePeriod(id: number) {
    setPeriods((ps) => ps.filter((p) => p.id !== id));
  }

  function handleCalc() {
    setResult(calculate(periods, currentAge));
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-8 min-h-screen">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-800">日本年金计算器</h1>
        <p className="text-sm text-gray-500 mt-1">
          按你的真实经历，算出65岁后每月能领多少
        </p>
        <p className="text-xs text-gray-400 mt-1">2026年度最新数据 | 支持复杂经历</p>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-5">
        {/* 现在年龄 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            现在年龄
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={20}
              max={65}
              value={currentAge}
              onChange={(e) => setCurrentAge(Number(e.target.value))}
              className="flex-1 accent-blue-500"
            />
            <span className="text-lg font-semibold w-12 text-right">
              {currentAge}岁
            </span>
          </div>
        </div>

        {/* 经历时间线 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            在日经历（按时间顺序添加每一段）
          </label>

          <div className="space-y-4">
            {periods.map((p, i) => (
              <div
                key={p.id}
                className="border border-gray-200 rounded-xl p-4 space-y-3 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-400">
                    第{i + 1}段
                  </span>
                  {periods.length > 1 && (
                    <button
                      onClick={() => removePeriod(p.id)}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      删除
                    </button>
                  )}
                </div>

                {/* 身份 */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(Object.entries(STATUS_LABELS) as [Status, { label: string; desc: string }][]).map(
                    ([key, { label }]) => (
                      <button
                        key={key}
                        onClick={() =>
                          updatePeriod(p.id, {
                            status: key,
                            annualIncome:
                              key === "employed" || key === "maternity" || key === "sickleave"
                                ? p.annualIncome || 3500000
                                : 0,
                          })
                        }
                        className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-all ${
                          p.status === key
                            ? "bg-blue-50 border-blue-400 text-blue-700"
                            : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                        }`}
                      >
                        {label}
                      </button>
                    )
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  {STATUS_LABELS[p.status].desc}
                </p>

                {/* 时间 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400">从</label>
                    <div className="flex gap-1 mt-1">
                      <input
                        type="number"
                        min={1990}
                        max={2030}
                        value={p.fromYear}
                        onChange={(e) =>
                          updatePeriod(p.id, {
                            fromYear: Number(e.target.value),
                          })
                        }
                        className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                      />
                      <select
                        value={p.fromMonth}
                        onChange={(e) =>
                          updatePeriod(p.id, {
                            fromMonth: Number(e.target.value),
                          })
                        }
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                      >
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {i + 1}月
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">到</label>
                    <div className="flex gap-1 mt-1">
                      <input
                        type="number"
                        min={1990}
                        max={2030}
                        value={p.toYear}
                        onChange={(e) =>
                          updatePeriod(p.id, {
                            toYear: Number(e.target.value),
                          })
                        }
                        className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                      />
                      <select
                        value={p.toMonth}
                        onChange={(e) =>
                          updatePeriod(p.id, {
                            toMonth: Number(e.target.value),
                          })
                        }
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                      >
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {i + 1}月
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 年收入 */}
                {(p.status === "employed" || p.status === "maternity" || p.status === "sickleave") && (
                  <div>
                    <label className="text-xs text-gray-400">
                      {p.status === "maternity"
                        ? "休假前的税前年收入"
                        : p.status === "sickleave"
                        ? "休职前的税前年收入"
                        : "这段期间的税前年收入"}
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="range"
                        min={200}
                        max={1500}
                        step={10}
                        value={p.annualIncome / 10000}
                        onChange={(e) =>
                          updatePeriod(p.id, {
                            annualIncome: Number(e.target.value) * 10000,
                          })
                        }
                        className="flex-1 accent-blue-500"
                      />
                      <span className="text-sm font-semibold w-16 text-right">
                        {(p.annualIncome / 10000).toFixed(0)}万円
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={addPeriod}
            className="mt-3 w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors"
          >
            + 添加一段经历
          </button>
        </div>

        <button
          onClick={handleCalc}
          className="w-full py-3 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-medium rounded-xl transition-colors"
        >
          计算我的年金
        </button>
      </div>

      {/* 结果 */}
      {result && (
        <div className="mt-6 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center">
            {result.qualified ? (
              <>
                <p className="text-sm text-gray-500">65岁后每月预计领取</p>
                <p className="text-4xl font-bold text-blue-600 mt-2">
                  ¥{formatYen(result.monthlyBenefit)}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  约 ￥{formatCNY(result.monthlyBenefit)} 人民币/月
                </p>
                <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">年领取额</p>
                    <p className="font-semibold">
                      ¥{formatYen(result.yearlyBenefit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">
                      累计缴纳{result.qualifiedMonths}个月
                    </p>
                    <p className="font-semibold">
                      （{Math.round(result.qualifiedMonths / 12)}年）
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-amber-600">
                <p className="text-lg font-semibold">未达到领取资格</p>
                <p className="text-sm mt-2">
                  需要至少120个月（10年），目前预计
                  {result.qualifiedMonths}个月，还差
                  {MIN_MONTHS - result.qualifiedMonths}个月
                </p>
              </div>
            )}
          </div>

          {/* 明细 */}
          {result.qualified && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-600 mb-3">
                构成明细
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">国民年金（基础部分）</span>
                  <span className="font-medium">
                    ¥{formatYen(result.nationalPart)}/月
                  </span>
                </div>
                {result.kouseiPart > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">厚生年金（报酬比例部分）</span>
                    <span className="font-medium">
                      ¥{formatYen(result.kouseiPart)}/月
                    </span>
                  </div>
                )}
                <div className="border-t border-gray-100 pt-3 flex justify-between text-sm">
                  <span className="text-gray-500">已缴纳总额</span>
                  <span className="font-medium">¥{formatYen(result.totalPaid)}</span>
                </div>
                {result.futureMonths > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">到60岁还剩</span>
                    <span className="font-medium text-blue-500">
                      {result.futureMonths}个月（按当前状态继续计算）
                    </span>
                  </div>
                )}
              </div>

              {/* 各段明细 */}
              <h3 className="text-xs font-semibold text-gray-400 mt-5 mb-2">
                各段经历贡献
              </h3>
              <div className="space-y-2">
                {result.periods.map((p, i) => (
                  <div
                    key={i}
                    className="flex justify-between text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2"
                  >
                    <span>
                      第{i + 1}段 · {STATUS_LABELS[p.status].label} · {p.months}个月
                    </span>
                    <span>
                      {p.paid > 0 ? `已缴 ¥${formatYen(p.paid)}` : "无需缴纳"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-gray-50 rounded-2xl p-4 text-xs text-gray-400 space-y-1">
            <p>* 基于2026年度年金标准计算，实际金额可能因政策调整而变化</p>
            <p>* 学生特例期间算入资格但不算入领取额（除非追纳）</p>
            <p>* 免除期间领取额按一半计算（全额免除的情况）</p>
            <p>* 第3号（家庭主妇/主夫）不需缴纳但算入国民年金满额</p>
            <p>* 产假/育休期间保费全免（公司和个人），但年金按休假前工资照算</p>
            <p>* 病休/休职期间继续缴纳厚生年金，按休职前标准报酬月额计算</p>
            <p>* 60岁后到65岁的期间未计入（可选择任意加入）</p>
            <p>* 汇率按1日元≈0.049人民币估算</p>
            <p>* 本工具仅供参考，不构成任何财务建议</p>
          </div>
        </div>
      )}

      <footer className="mt-10 text-center text-xs text-gray-400 space-y-1">
        <p>数据来源：日本年金機構 / 厚生労働省 2026年度</p>
        <p>纯前端计算，不收集任何个人数据</p>
      </footer>
    </main>
  );
}
