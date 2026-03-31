"use client";
import { useState } from "react";
import {
  calculate,
  formatYen,
  formatCNY,
  needsIncome,
  isExempt,
  canFuka,
  MIN_MONTHS,
  STATUS_LABELS,
  STATUS_GROUPS,
  type Status,
  type Period,
  type Result,
} from "../lib/pension-engine";

let nextId = 2;

export default function Calculator() {
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

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-5">
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
          <label className="block text-sm font-medium text-gray-700 mb-1">计划领取年龄</label>
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

                {canFuka(p.status) && (
                  <label className="flex items-center gap-2 text-xs text-gray-500">
                    <input type="checkbox" checked={p.hasFuka}
                      onChange={(e) => updatePeriod(p.id, { hasFuka: e.target.checked })}
                      className="accent-blue-500" />
                    加入付加年金（+400円/月 → 领取时+200円×月数）
                  </label>
                )}

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
    </>
  );
}
