"use client";

import { useState } from "react";

// 2026年度 最新データ
const NATIONAL_FULL_MONTHLY = 70608; // 国民年金満額（月額）
const NATIONAL_FULL_MONTHS = 480; // 40年 = 480ヶ月
const NATIONAL_PREMIUM = 17920; // 2026年度 国民年金保険料（月額）
const KOUSEI_RATE = 0.005481; // 厚生年金計算係数
const KOUSEI_PREMIUM_RATE = 0.0915; // 本人負担 9.15%
const MIN_MONTHS = 120; // 最低加入期間 10年
const RETIRE_AGE = 65;

type PensionType = "national" | "kousei";
type Result = {
  monthlyBenefit: number;
  yearlyBenefit: number;
  totalPaidMonthly: number;
  totalPaid: number;
  enrollMonths: number;
  qualified: boolean;
  nationalPart: number;
  kouseiPart: number;
};

function calculate(
  currentAge: number,
  arrivalAge: number,
  annualIncome: number,
  pensionType: PensionType
): Result {
  const yearsInJapan = currentAge - arrivalAge;
  const enrollMonths = Math.min(
    Math.max(yearsInJapan, 0) * 12,
    NATIONAL_FULL_MONTHS
  );
  const remainMonths = Math.max((60 - currentAge) * 12, 0);
  const totalMonths = Math.min(
    enrollMonths + remainMonths,
    NATIONAL_FULL_MONTHS
  );
  const qualified = totalMonths >= MIN_MONTHS;

  // 国民年金部分
  const nationalPart = Math.round(
    (NATIONAL_FULL_MONTHLY * totalMonths) / NATIONAL_FULL_MONTHS
  );

  // 厚生年金部分
  let kouseiPart = 0;
  let totalPaidMonthly = NATIONAL_PREMIUM;

  if (pensionType === "kousei") {
    const monthlyIncome = annualIncome / 12;
    kouseiPart = Math.round(monthlyIncome * KOUSEI_RATE * totalMonths);
    totalPaidMonthly = Math.round(monthlyIncome * KOUSEI_PREMIUM_RATE);
  }

  const monthlyBenefit = nationalPart + kouseiPart;
  const totalPaid = totalPaidMonthly * totalMonths;

  return {
    monthlyBenefit,
    yearlyBenefit: monthlyBenefit * 12,
    totalPaidMonthly,
    totalPaid,
    enrollMonths: totalMonths,
    qualified,
    nationalPart,
    kouseiPart,
  };
}

function formatYen(n: number) {
  return n.toLocaleString("ja-JP");
}

function formatCNY(yen: number) {
  return Math.round(yen / 20.5).toLocaleString("zh-CN");
}

export default function Home() {
  const [age, setAge] = useState(35);
  const [arrivalAge, setArrivalAge] = useState(22);
  const [income, setIncome] = useState(4000000);
  const [type, setType] = useState<PensionType>("kousei");
  const [result, setResult] = useState<Result | null>(null);

  function handleCalc() {
    setResult(calculate(age, arrivalAge, income, type));
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-8 min-h-screen">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-800">
          日本年金计算器
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          输入3个数字，秒算你65岁后每月能领多少
        </p>
        <p className="text-xs text-gray-400 mt-1">2026年度最新数据</p>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-5">
        {/* 年金类型 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            你的年金类型
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setType("kousei")}
              className={`py-2.5 px-4 rounded-xl text-sm font-medium border transition-all ${
                type === "kousei"
                  ? "bg-blue-50 border-blue-400 text-blue-700"
                  : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              <div>厚生年金</div>
              <div className="text-xs mt-0.5 opacity-70">公司员工</div>
            </button>
            <button
              onClick={() => setType("national")}
              className={`py-2.5 px-4 rounded-xl text-sm font-medium border transition-all ${
                type === "national"
                  ? "bg-blue-50 border-blue-400 text-blue-700"
                  : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              <div>国民年金</div>
              <div className="text-xs mt-0.5 opacity-70">自营/自由职业</div>
            </button>
          </div>
        </div>

        {/* 现在年龄 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            现在年龄
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={20}
              max={60}
              value={age}
              onChange={(e) => setAge(Number(e.target.value))}
              className="flex-1 accent-blue-500"
            />
            <span className="text-lg font-semibold w-12 text-right">
              {age}岁
            </span>
          </div>
        </div>

        {/* 来日年龄 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            来日本时年龄
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={15}
              max={55}
              value={arrivalAge}
              onChange={(e) => setArrivalAge(Number(e.target.value))}
              className="flex-1 accent-blue-500"
            />
            <span className="text-lg font-semibold w-12 text-right">
              {arrivalAge}岁
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            已在日本 {Math.max(age - arrivalAge, 0)} 年
          </p>
        </div>

        {/* 年收入 */}
        {type === "kousei" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              税前年收入（万円）
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={200}
                max={1200}
                step={10}
                value={income / 10000}
                onChange={(e) => setIncome(Number(e.target.value) * 10000)}
                className="flex-1 accent-blue-500"
              />
              <span className="text-lg font-semibold w-20 text-right">
                {(income / 10000).toFixed(0)}万円
              </span>
            </div>
          </div>
        )}

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
          {/* 主结果 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center">
            {result.qualified ? (
              <>
                <p className="text-sm text-gray-500">
                  65岁后每月预计领取
                </p>
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
                    <p className="text-gray-400">预计缴纳总月数</p>
                    <p className="font-semibold">
                      {result.enrollMonths}个月（
                      {Math.round(result.enrollMonths / 12)}年）
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-amber-600">
                <p className="text-lg font-semibold">未达到领取资格</p>
                <p className="text-sm mt-2">
                  需要至少缴纳120个月（10年），目前预计
                  {result.enrollMonths}个月，还差
                  {MIN_MONTHS - result.enrollMonths}个月
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
                  <span className="text-gray-500">
                    国民年金（基础部分）
                  </span>
                  <span className="font-medium">
                    ¥{formatYen(result.nationalPart)}/月
                  </span>
                </div>
                {type === "kousei" && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">
                      厚生年金（报酬比例部分）
                    </span>
                    <span className="font-medium">
                      ¥{formatYen(result.kouseiPart)}/月
                    </span>
                  </div>
                )}
                <div className="border-t border-gray-100 pt-3 flex justify-between text-sm">
                  <span className="text-gray-500">
                    你现在每月缴纳
                  </span>
                  <span className="font-medium">
                    ¥{formatYen(result.totalPaidMonthly)}/月
                    {type === "kousei" && (
                      <span className="text-gray-400 text-xs ml-1">
                        （公司付同额）
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">
                    到60岁预计总缴纳
                  </span>
                  <span className="font-medium">
                    ¥{formatYen(result.totalPaid)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 说明 */}
          <div className="bg-gray-50 rounded-2xl p-4 text-xs text-gray-400 space-y-1">
            <p>* 基于2026年度年金标准计算，实际金额可能因政策调整而变化</p>
            <p>* 厚生年金按平均年收入估算，实际按每月标准报酬月额计算</p>
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
