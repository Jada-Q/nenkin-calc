"use client";

import { useState } from "react";

// ─── 2026年度 最新データ ───
const NATIONAL_FULL_MONTHLY = 70608;
const NATIONAL_FULL_MONTHS = 480;
const NATIONAL_PREMIUM = 17920;
const KOUSEI_RATE = 0.005481;
const KOUSEI_PREMIUM_RATE = 0.0915;
const MIN_MONTHS = 120;
const FUKA_PREMIUM = 400; // 付加年金保険料
const FUKA_BENEFIT_PER_MONTH = 200; // 付加年金給付（月あたり）
const KAKYU_SPOUSE = 239300; // 加給年金（配偶者）年額
const KAKYU_CHILD = 239300; // 加給年金（子1-2人目）年額
const KAKYU_CHILD3 = 79800; // 加給年金（子3人目以降）年額

// ─── 身份类型 ───
type Status =
  | "employed"
  | "student"
  | "unemployed"
  | "dependent"
  | "maternity"
  | "sickleave"
  | "exempt_full"
  | "exempt_3q"
  | "exempt_half"
  | "exempt_1q"
  | "yuuyo"
  | "unpaid"
  | "overseas"
  | "voluntary60";

const STATUS_LABELS: Record<Status, { label: string; desc: string; group: string }> = {
  employed: { label: "上班", desc: "公司员工，厚生年金", group: "工作" },
  maternity: { label: "产假/育休", desc: "保费全免，年金按休假前工资照算", group: "工作" },
  sickleave: { label: "病休/休职", desc: "继续缴纳，按休职前工资算", group: "工作" },
  student: { label: "留学/读书", desc: "学生特例，仅算资格不算领取额", group: "非工作" },
  unemployed: { label: "无职业（正常缴纳）", desc: "自缴国民年金", group: "非工作" },
  dependent: { label: "主妇/主夫（第3号）", desc: "配偶交厚生年金，自己不用交", group: "非工作" },
  exempt_full: { label: "全额免除", desc: "领取额算满额的1/2", group: "免除" },
  exempt_3q: { label: "3/4免除", desc: "领取额算满额的5/8", group: "免除" },
  exempt_half: { label: "半额免除", desc: "领取额算满额的3/4", group: "免除" },
  exempt_1q: { label: "1/4免除", desc: "领取额算满额的7/8", group: "免除" },
  yuuyo: { label: "纳付猶予", desc: "仅算资格，领取额为0（可追纳）", group: "免除" },
  unpaid: { label: "未纳（滞纳）", desc: "资格和领取都不算", group: "免除" },
  overseas: { label: "海外居住（カラ期間）", desc: "算入资格但不算领取额", group: "特殊" },
  voluntary60: { label: "60-65岁任意加入", desc: "延长缴纳国民年金补足月数", group: "特殊" },
};

const STATUS_GROUPS = ["工作", "非工作", "免除", "特殊"] as const;

// ─── 免除率映射 ───
const EXEMPT_NATIONAL_RATIO: Partial<Record<Status, number>> = {
  exempt_full: 1 / 2,
  exempt_3q: 5 / 8,
  exempt_half: 3 / 4,
  exempt_1q: 7 / 8,
};

type Period = {
  id: number;
  status: Status;
  fromYear: number;
  fromMonth: number;
  toYear: number;
  toMonth: number;
  annualIncome: number;
  hasFuka: boolean; // 是否加入付加年金
  追納: boolean; // 是否追纳了这段免除期间
};

type Result = {
  monthlyBenefit: number;
  yearlyBenefit: number;
  qualified: boolean;
  qualifiedMonths: number;
  nationalPart: number;
  kouseiPart: number;
  fukaPart: number;
  kakyuPart: number;
  totalPaid: number;
  periods: PeriodResult[];
  futureMonths: number;
  adjustedMonthly: number;
  adjustedLabel: string;
};

type PeriodResult = {
  status: Status;
  months: number;
  nationalMonths: number;
  nationalRatio: number;
  kouseiMonths: number;
  paid: number;
  kouseiIncome: number;
  fukaMonths: number;
};

function monthsBetween(fy: number, fm: number, ty: number, tm: number): number {
  return Math.max((ty - fy) * 12 + (tm - fm), 0);
}

function calculate(
  periods: Period[],
  currentAge: number,
  claimAge: number,
  hasSpouse: boolean,
  spouseUnder65: boolean,
  childrenUnder18: number
): Result {
  const periodResults: PeriodResult[] = periods.map((p) => {
    const months = monthsBetween(p.fromYear, p.fromMonth, p.toYear, p.toMonth);
    let nationalMonths = 0;
    let nationalRatio = 1;
    let kouseiMonths = 0;
    let paid = 0;
    let kouseiIncome = 0;
    let fukaMonths = 0;

    switch (p.status) {
      case "employed":
        nationalMonths = months;
        kouseiMonths = months;
        kouseiIncome = p.annualIncome;
        paid = Math.round((p.annualIncome / 12) * KOUSEI_PREMIUM_RATE) * months;
        break;
      case "maternity":
        nationalMonths = months;
        kouseiMonths = months;
        kouseiIncome = p.annualIncome;
        paid = 0;
        break;
      case "sickleave":
        nationalMonths = months;
        kouseiMonths = months;
        kouseiIncome = p.annualIncome;
        paid = Math.round((p.annualIncome / 12) * KOUSEI_PREMIUM_RATE) * months;
        break;
      case "student":
        nationalMonths = p.追納 ? months : 0;
        nationalRatio = p.追納 ? 1 : 0;
        paid = p.追納 ? NATIONAL_PREMIUM * months : 0;
        break;
      case "unemployed":
        nationalMonths = months;
        paid = NATIONAL_PREMIUM * months;
        if (p.hasFuka) {
          fukaMonths = months;
          paid += FUKA_PREMIUM * months;
        }
        break;
      case "dependent":
        nationalMonths = months;
        paid = 0;
        break;
      case "exempt_full":
      case "exempt_3q":
      case "exempt_half":
      case "exempt_1q":
        if (p.追納) {
          nationalMonths = months;
          nationalRatio = 1;
          paid = NATIONAL_PREMIUM * months;
        } else {
          nationalMonths = months;
          nationalRatio = EXEMPT_NATIONAL_RATIO[p.status] ?? 0.5;
          paid = 0;
          // 部分免除需缴纳差额
          if (p.status === "exempt_3q") paid = Math.round(NATIONAL_PREMIUM * 0.25) * months;
          if (p.status === "exempt_half") paid = Math.round(NATIONAL_PREMIUM * 0.5) * months;
          if (p.status === "exempt_1q") paid = Math.round(NATIONAL_PREMIUM * 0.75) * months;
        }
        break;
      case "yuuyo":
        nationalMonths = p.追納 ? months : 0;
        nationalRatio = p.追納 ? 1 : 0;
        paid = p.追納 ? NATIONAL_PREMIUM * months : 0;
        break;
      case "unpaid":
        nationalMonths = 0;
        nationalRatio = 0;
        paid = 0;
        break;
      case "overseas":
        nationalMonths = 0;
        nationalRatio = 0;
        paid = 0;
        break;
      case "voluntary60":
        nationalMonths = months;
        paid = NATIONAL_PREMIUM * months;
        if (p.hasFuka) {
          fukaMonths = months;
          paid += FUKA_PREMIUM * months;
        }
        break;
    }

    return { status: p.status, months, nationalMonths, nationalRatio, kouseiMonths, paid, kouseiIncome, fukaMonths };
  });

  const futureMonths = Math.max((60 - currentAge) * 12, 0);

  // 资格判定（含学生特例、猶予、海外期间）
  const qualifyingStatuses: Status[] = [
    "employed", "unemployed", "dependent", "maternity", "sickleave",
    "student", "exempt_full", "exempt_3q", "exempt_half", "exempt_1q",
    "yuuyo", "overseas", "voluntary60",
  ];
  const qualifiedMonths = Math.min(
    periodResults
      .filter((p) => qualifyingStatuses.includes(p.status))
      .reduce((s, p) => s + p.months, 0) + futureMonths,
    NATIONAL_FULL_MONTHS
  );
  const qualified = qualifiedMonths >= MIN_MONTHS;

  // 国民年金（按各段ratio加权）
  const weightedNationalMonths = periodResults.reduce(
    (s, p) => s + p.nationalMonths * p.nationalRatio,
    0
  ) + futureMonths;
  const cappedNational = Math.min(weightedNationalMonths, NATIONAL_FULL_MONTHS);
  const nationalPart = Math.round(
    (NATIONAL_FULL_MONTHLY * cappedNational) / NATIONAL_FULL_MONTHS
  );

  // 厚生年金
  const kouseiPart = periodResults.reduce((sum, p) => {
    if (p.kouseiMonths > 0 && p.kouseiIncome > 0) {
      return sum + Math.round((p.kouseiIncome / 12) * KOUSEI_RATE * p.kouseiMonths);
    }
    return sum;
  }, 0);

  // 付加年金
  const totalFukaMonths = periodResults.reduce((s, p) => s + p.fukaMonths, 0);
  const fukaPart = FUKA_BENEFIT_PER_MONTH * totalFukaMonths;

  // 加给年金
  let kakyuPart = 0;
  const totalKouseiMonths = periodResults.reduce((s, p) => s + p.kouseiMonths, 0);
  if (totalKouseiMonths >= 240 && hasSpouse && spouseUnder65) {
    kakyuPart += KAKYU_SPOUSE;
  }
  if (totalKouseiMonths >= 240) {
    const c = Math.min(childrenUnder18, 2);
    const c3 = Math.max(childrenUnder18 - 2, 0);
    kakyuPart += c * KAKYU_CHILD + c3 * KAKYU_CHILD3;
  }

  const totalPaid = periodResults.reduce((s, p) => s + p.paid, 0);
  const monthlyBase = nationalPart + kouseiPart + fukaPart;

  // 繰上げ/繰下げ
  let adjustRate = 1;
  let adjustedLabel = "65岁正常领取";
  if (claimAge < 65) {
    const earlyMonths = (65 - claimAge) * 12;
    adjustRate = 1 - earlyMonths * 0.004;
    adjustedLabel = `${claimAge}岁提前领取（-${(earlyMonths * 0.4).toFixed(1)}%）`;
  } else if (claimAge > 65) {
    const lateMonths = (claimAge - 65) * 12;
    adjustRate = 1 + lateMonths * 0.007;
    adjustedLabel = `${claimAge}岁延后领取（+${(lateMonths * 0.7).toFixed(1)}%）`;
  }
  const adjustedMonthly = Math.round(monthlyBase * adjustRate);

  return {
    monthlyBenefit: monthlyBase,
    yearlyBenefit: monthlyBase * 12,
    qualified,
    qualifiedMonths,
    nationalPart,
    kouseiPart,
    fukaPart,
    kakyuPart,
    totalPaid,
    periods: periodResults,
    futureMonths,
    adjustedMonthly,
    adjustedLabel,
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
  const [claimAge, setClaimAge] = useState(65);
  const [hasSpouse, setHasSpouse] = useState(false);
  const [spouseUnder65, setSpouseUnder65] = useState(true);
  const [children, setChildren] = useState(0);
  const [periods, setPeriods] = useState<Period[]>([
    {
      id: 1, status: "employed",
      fromYear: 2015, fromMonth: 4, toYear: 2023, toMonth: 3,
      annualIncome: 3500000, hasFuka: false, 追納: false,
    },
  ]);
  const [result, setResult] = useState<Result | null>(null);
  const [showExemptDetail, setShowExemptDetail] = useState(false);

  function addPeriod() {
    const last = periods[periods.length - 1];
    setPeriods([
      ...periods,
      {
        id: nextId++, status: "unemployed",
        fromYear: last?.toYear ?? 2024, fromMonth: last?.toMonth ?? 4,
        toYear: 2026, toMonth: 3,
        annualIncome: 0, hasFuka: false, 追納: false,
      },
    ]);
  }

  function updatePeriod(id: number, patch: Partial<Period>) {
    setPeriods((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function removePeriod(id: number) {
    setPeriods((ps) => ps.filter((p) => p.id !== id));
  }

  function handleCalc() {
    setResult(calculate(periods, currentAge, claimAge, hasSpouse, spouseUnder65, children));
  }

  const needsIncome = (s: Status) =>
    s === "employed" || s === "maternity" || s === "sickleave";
  const isExempt = (s: Status) =>
    ["exempt_full", "exempt_3q", "exempt_half", "exempt_1q", "yuuyo", "student"].includes(s);
  const canFuka = (s: Status) => s === "unemployed" || s === "voluntary60";

  return (
    <main className="max-w-lg mx-auto px-4 py-8 min-h-screen">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-800">日本年金计算器</h1>
        <p className="text-sm text-gray-500 mt-1">
          按你的真实经历，精确计算65岁后能领多少
        </p>
        <p className="text-xs text-gray-400 mt-1">
          2026年度最新 | 支持免除细分/产假育休/病休/提前延后领取/加给年金
        </p>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-5">
        {/* 基本信息 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">现在年龄</label>
          <div className="flex items-center gap-3">
            <input type="range" min={20} max={70} value={currentAge}
              onChange={(e) => setCurrentAge(Number(e.target.value))}
              className="flex-1 accent-blue-500" />
            <span className="text-lg font-semibold w-12 text-right">{currentAge}岁</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            计划领取年龄
          </label>
          <div className="flex items-center gap-3">
            <input type="range" min={60} max={75} value={claimAge}
              onChange={(e) => setClaimAge(Number(e.target.value))}
              className="flex-1 accent-blue-500" />
            <span className="text-lg font-semibold w-12 text-right">{claimAge}岁</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {claimAge < 65
              ? `提前${65 - claimAge}年，每月减少${((65 - claimAge) * 12 * 0.4).toFixed(1)}%`
              : claimAge > 65
              ? `延后${claimAge - 65}年，每月增加${((claimAge - 65) * 12 * 0.7).toFixed(1)}%`
              : "标准领取年龄"}
          </p>
        </div>

        {/* 家庭情况 */}
        <div className="border-t border-gray-100 pt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">家庭情况（影响加给年金）</label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={hasSpouse}
                onChange={(e) => setHasSpouse(e.target.checked)}
                className="accent-blue-500" />
              有配偶
            </label>
            {hasSpouse && (
              <label className="flex items-center gap-2 text-sm text-gray-500 ml-6">
                <input type="checkbox" checked={spouseUnder65}
                  onChange={(e) => setSpouseUnder65(e.target.checked)}
                  className="accent-blue-500" />
                配偶不到65岁
              </label>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>18岁以下子女数</span>
              <select value={children} onChange={(e) => setChildren(Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-2 py-1 text-sm">
                {[0, 1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}人</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 经历时间线 */}
        <div className="border-t border-gray-100 pt-4">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            在日经历（按时间顺序）
          </label>
          <div className="space-y-4">
            {periods.map((p, i) => (
              <div key={p.id} className="border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-400">第{i + 1}段</span>
                  {periods.length > 1 && (
                    <button onClick={() => removePeriod(p.id)}
                      className="text-xs text-red-400 hover:text-red-600">删除</button>
                  )}
                </div>

                {/* 身份选择 - 分组 */}
                {STATUS_GROUPS.map((group) => {
                  const items = (Object.entries(STATUS_LABELS) as [Status, typeof STATUS_LABELS[Status]][])
                    .filter(([, v]) => v.group === group);
                  if (group === "免除" && !showExemptDetail) {
                    return (
                      <div key={group}>
                        {i === 0 && group === "免除" && (
                          <button onClick={() => setShowExemptDetail(true)}
                            className="text-xs text-blue-500 underline mb-1">
                            展开免除细分选项
                          </button>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div key={group} className="flex flex-wrap gap-1.5">
                      {items.map(([key, { label }]) => (
                        <button key={key}
                          onClick={() => updatePeriod(p.id, {
                            status: key,
                            annualIncome: needsIncome(key) ? (p.annualIncome || 3500000) : 0,
                            hasFuka: false, 追納: false,
                          })}
                          className={`py-1 px-2.5 rounded-lg text-xs font-medium border transition-all ${
                            p.status === key
                              ? "bg-blue-50 border-blue-400 text-blue-700"
                              : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                          }`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  );
                })}
                {!showExemptDetail && (
                  <button onClick={() => setShowExemptDetail(true)}
                    className="text-xs text-blue-500 underline">
                    展开免除/未纳/海外等选项
                  </button>
                )}
                <p className="text-xs text-gray-400">{STATUS_LABELS[p.status].desc}</p>

                {/* 时间 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400">从</label>
                    <div className="flex gap-1 mt-1">
                      <input type="number" min={1990} max={2035} value={p.fromYear}
                        onChange={(e) => updatePeriod(p.id, { fromYear: Number(e.target.value) })}
                        className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
                      <select value={p.fromMonth}
                        onChange={(e) => updatePeriod(p.id, { fromMonth: Number(e.target.value) })}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>{i + 1}月</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">到</label>
                    <div className="flex gap-1 mt-1">
                      <input type="number" min={1990} max={2035} value={p.toYear}
                        onChange={(e) => updatePeriod(p.id, { toYear: Number(e.target.value) })}
                        className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
                      <select value={p.toMonth}
                        onChange={(e) => updatePeriod(p.id, { toMonth: Number(e.target.value) })}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>{i + 1}月</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 年收入 */}
                {needsIncome(p.status) && (
                  <div>
                    <label className="text-xs text-gray-400">
                      {p.status === "maternity" ? "休假前的" : p.status === "sickleave" ? "休职前的" : ""}税前年收入
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <input type="range" min={200} max={1500} step={10}
                        value={p.annualIncome / 10000}
                        onChange={(e) => updatePeriod(p.id, { annualIncome: Number(e.target.value) * 10000 })}
                        className="flex-1 accent-blue-500" />
                      <span className="text-sm font-semibold w-16 text-right">
                        {(p.annualIncome / 10000).toFixed(0)}万円
                      </span>
                    </div>
                  </div>
                )}

                {/* 付加年金 */}
                {canFuka(p.status) && (
                  <label className="flex items-center gap-2 text-xs text-gray-500">
                    <input type="checkbox" checked={p.hasFuka}
                      onChange={(e) => updatePeriod(p.id, { hasFuka: e.target.checked })}
                      className="accent-blue-500" />
                    加入付加年金（+400円/月 → 领取时+200円×月数）
                  </label>
                )}

                {/* 追纳 */}
                {isExempt(p.status) && (
                  <label className="flex items-center gap-2 text-xs text-gray-500">
                    <input type="checkbox" checked={p.追納}
                      onChange={(e) => updatePeriod(p.id, { 追納: e.target.checked })}
                      className="accent-blue-500" />
                    已追纳（补缴后领取额恢复满额）
                  </label>
                )}
              </div>
            ))}
          </div>

          <button onClick={addPeriod}
            className="mt-3 w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors">
            + 添加一段经历
          </button>
        </div>

        <button onClick={handleCalc}
          className="w-full py-3 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-medium rounded-xl transition-colors">
          计算我的年金
        </button>
      </div>

      {/* ─── 结果 ─── */}
      {result && (
        <div className="mt-6 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center">
            {result.qualified ? (
              <>
                <p className="text-sm text-gray-500">{result.adjustedLabel}</p>
                <p className="text-4xl font-bold text-blue-600 mt-2">
                  ¥{formatYen(result.adjustedMonthly)}
                  <span className="text-base font-normal text-gray-400">/月</span>
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  约 ￥{formatCNY(result.adjustedMonthly)} 人民币/月
                </p>
                {result.adjustedMonthly !== result.monthlyBenefit && (
                  <p className="text-xs text-gray-400 mt-1">
                    （65岁正常领取：¥{formatYen(result.monthlyBenefit)}/月）
                  </p>
                )}
                <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">年领取额</p>
                    <p className="font-semibold">¥{formatYen(result.adjustedMonthly * 12)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">资格月数</p>
                    <p className="font-semibold">
                      {result.qualifiedMonths}个月（{Math.round(result.qualifiedMonths / 12)}年）
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-amber-600">
                <p className="text-lg font-semibold">未达到领取资格</p>
                <p className="text-sm mt-2">
                  需要至少120个月（10年），目前预计{result.qualifiedMonths}个月，
                  还差{MIN_MONTHS - result.qualifiedMonths}个月
                </p>
              </div>
            )}
          </div>

          {result.qualified && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-600 mb-3">构成明细（月额）</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">国民年金（基础）</span>
                  <span className="font-medium">¥{formatYen(result.nationalPart)}</span>
                </div>
                {result.kouseiPart > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">厚生年金（报酬比例）</span>
                    <span className="font-medium">¥{formatYen(result.kouseiPart)}</span>
                  </div>
                )}
                {result.fukaPart > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">付加年金</span>
                    <span className="font-medium">¥{formatYen(result.fukaPart)}</span>
                  </div>
                )}
                {result.kakyuPart > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>加给年金（年额）</span>
                    <span className="font-medium">¥{formatYen(result.kakyuPart)}/年</span>
                  </div>
                )}
                <div className="border-t border-gray-100 pt-2 flex justify-between">
                  <span className="text-gray-500">已缴纳总额</span>
                  <span className="font-medium">¥{formatYen(result.totalPaid)}</span>
                </div>
              </div>

              <h3 className="text-xs font-semibold text-gray-400 mt-5 mb-2">各段经历</h3>
              <div className="space-y-1.5">
                {result.periods.map((p, i) => (
                  <div key={i}
                    className="flex justify-between text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                    <span>
                      第{i + 1}段 · {STATUS_LABELS[p.status].label} · {p.months}个月
                    </span>
                    <span>{p.paid > 0 ? `缴 ¥${formatYen(p.paid)}` : "无需缴纳"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-gray-50 rounded-2xl p-4 text-xs text-gray-400 space-y-1">
            <p>* 2026年度标准：国民年金满额70,608円/月，保费17,920円/月</p>
            <p>* 提前领取（繰上げ）每月-0.4%，最大-24%；延后（繰下げ）每月+0.7%，最大+84%</p>
            <p>* 免除期间：全额免除→1/2，3/4免除→5/8，半额→3/4，1/4免除→7/8</p>
            <p>* 学生特例/纳付猶予仅算资格不算领取额（追纳后恢复）</p>
            <p>* 产假育休保费全免但年金照算；病休继续缴纳</p>
            <p>* 加给年金条件：厚生年金20年+，有65岁以下配偶或18岁以下子女</p>
            <p>* 海外居住（カラ期間）算入资格但不算领取额</p>
            <p>* 汇率约1日元≈0.049人民币</p>
            <p>* 本工具仅供参考，不构成财务建议</p>
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
