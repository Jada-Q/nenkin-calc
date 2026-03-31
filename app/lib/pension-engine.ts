// ─── 2026年度 最新データ ───
export const NATIONAL_FULL_MONTHLY = 70608;
export const NATIONAL_FULL_MONTHS = 480;
export const NATIONAL_PREMIUM = 17920;
export const KOUSEI_RATE = 0.005481;
export const KOUSEI_PREMIUM_RATE = 0.0915;
export const MIN_MONTHS = 120;
export const FUKA_PREMIUM = 400;
export const FUKA_BENEFIT_PER_MONTH = 200;
export const KAKYU_SPOUSE = 239300;
export const KAKYU_CHILD = 239300;
export const KAKYU_CHILD3 = 79800;

export type Status =
  | "employed" | "student" | "unemployed" | "dependent"
  | "maternity" | "sickleave"
  | "exempt_full" | "exempt_3q" | "exempt_half" | "exempt_1q"
  | "yuuyo" | "unpaid" | "overseas" | "voluntary60";

export const STATUS_LABELS: Record<Status, { label: string; desc: string; group: string }> = {
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
  yuuyo: { label: "纳付猶予", desc: "仅算资格，领取额为0", group: "免除" },
  unpaid: { label: "未纳（滞纳）", desc: "资格和领取都不算", group: "免除" },
  overseas: { label: "海外居住（カラ期間）", desc: "算入资格但不算领取额", group: "特殊" },
  voluntary60: { label: "60-65岁任意加入", desc: "延长缴纳补足月数", group: "特殊" },
};

export const STATUS_GROUPS = ["工作", "非工作", "免除", "特殊"] as const;

const EXEMPT_NATIONAL_RATIO: Partial<Record<Status, number>> = {
  exempt_full: 1 / 2,
  exempt_3q: 5 / 8,
  exempt_half: 3 / 4,
  exempt_1q: 7 / 8,
};

export type Period = {
  id: number;
  status: Status;
  fromYear: number;
  fromMonth: number;
  toYear: number;
  toMonth: number;
  annualIncome: number;
  hasFuka: boolean;
  追納: boolean;
};

export type PeriodResult = {
  status: Status;
  months: number;
  nationalMonths: number;
  nationalRatio: number;
  kouseiMonths: number;
  paid: number;
  kouseiIncome: number;
  fukaMonths: number;
};

export type Result = {
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

export function monthsBetween(fy: number, fm: number, ty: number, tm: number): number {
  return Math.max((fy !== ty || fm !== tm ? (ty - fy) * 12 + (tm - fm) : 0), 0);
}

export function calculate(
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
        nationalMonths = months; kouseiMonths = months;
        kouseiIncome = p.annualIncome;
        paid = Math.round((p.annualIncome / 12) * KOUSEI_PREMIUM_RATE) * months;
        break;
      case "maternity":
        nationalMonths = months; kouseiMonths = months;
        kouseiIncome = p.annualIncome; paid = 0;
        break;
      case "sickleave":
        nationalMonths = months; kouseiMonths = months;
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
        if (p.hasFuka) { fukaMonths = months; paid += FUKA_PREMIUM * months; }
        break;
      case "dependent":
        nationalMonths = months; paid = 0;
        break;
      case "exempt_full": case "exempt_3q": case "exempt_half": case "exempt_1q":
        if (p.追納) {
          nationalMonths = months; nationalRatio = 1;
          paid = NATIONAL_PREMIUM * months;
        } else {
          nationalMonths = months;
          nationalRatio = EXEMPT_NATIONAL_RATIO[p.status] ?? 0.5;
          paid = 0;
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
        nationalMonths = 0; nationalRatio = 0; paid = 0;
        break;
      case "overseas":
        nationalMonths = 0; nationalRatio = 0; paid = 0;
        break;
      case "voluntary60":
        nationalMonths = months; paid = NATIONAL_PREMIUM * months;
        if (p.hasFuka) { fukaMonths = months; paid += FUKA_PREMIUM * months; }
        break;
    }
    return { status: p.status, months, nationalMonths, nationalRatio, kouseiMonths, paid, kouseiIncome, fukaMonths };
  });

  const futureMonths = Math.max((60 - currentAge) * 12, 0);
  const qualifyingStatuses: Status[] = [
    "employed", "unemployed", "dependent", "maternity", "sickleave",
    "student", "exempt_full", "exempt_3q", "exempt_half", "exempt_1q",
    "yuuyo", "overseas", "voluntary60",
  ];
  const qualifiedMonths = Math.min(
    periodResults.filter((p) => qualifyingStatuses.includes(p.status)).reduce((s, p) => s + p.months, 0) + futureMonths,
    NATIONAL_FULL_MONTHS
  );
  const qualified = qualifiedMonths >= MIN_MONTHS;

  const weightedNationalMonths = periodResults.reduce((s, p) => s + p.nationalMonths * p.nationalRatio, 0) + futureMonths;
  const cappedNational = Math.min(weightedNationalMonths, NATIONAL_FULL_MONTHS);
  const nationalPart = Math.round((NATIONAL_FULL_MONTHLY * cappedNational) / NATIONAL_FULL_MONTHS);

  const kouseiPart = periodResults.reduce((sum, p) => {
    if (p.kouseiMonths > 0 && p.kouseiIncome > 0) {
      return sum + Math.round((p.kouseiIncome / 12) * KOUSEI_RATE * p.kouseiMonths);
    }
    return sum;
  }, 0);

  const totalFukaMonths = periodResults.reduce((s, p) => s + p.fukaMonths, 0);
  const fukaPart = FUKA_BENEFIT_PER_MONTH * totalFukaMonths;

  let kakyuPart = 0;
  const totalKouseiMonths = periodResults.reduce((s, p) => s + p.kouseiMonths, 0);
  if (totalKouseiMonths >= 240 && hasSpouse && spouseUnder65) kakyuPart += KAKYU_SPOUSE;
  if (totalKouseiMonths >= 240) {
    kakyuPart += Math.min(childrenUnder18, 2) * KAKYU_CHILD + Math.max(childrenUnder18 - 2, 0) * KAKYU_CHILD3;
  }

  const totalPaid = periodResults.reduce((s, p) => s + p.paid, 0);
  const monthlyBase = nationalPart + kouseiPart + fukaPart;

  let adjustRate = 1;
  let adjustedLabel = "65岁正常领取";
  if (claimAge < 65) {
    const m = (65 - claimAge) * 12;
    adjustRate = 1 - m * 0.004;
    adjustedLabel = `${claimAge}岁提前领取（-${(m * 0.4).toFixed(1)}%）`;
  } else if (claimAge > 65) {
    const m = (claimAge - 65) * 12;
    adjustRate = 1 + m * 0.007;
    adjustedLabel = `${claimAge}岁延后领取（+${(m * 0.7).toFixed(1)}%）`;
  }

  return {
    monthlyBenefit: monthlyBase,
    yearlyBenefit: monthlyBase * 12,
    qualified, qualifiedMonths,
    nationalPart, kouseiPart, fukaPart, kakyuPart,
    totalPaid,
    periods: periodResults,
    futureMonths,
    adjustedMonthly: Math.round(monthlyBase * adjustRate),
    adjustedLabel,
  };
}

export function formatYen(n: number) { return n.toLocaleString("ja-JP"); }
export function formatCNY(yen: number) { return Math.round(yen / 20.5).toLocaleString("zh-CN"); }
export function needsIncome(s: Status) { return s === "employed" || s === "maternity" || s === "sickleave"; }
export function isExempt(s: Status) { return ["exempt_full", "exempt_3q", "exempt_half", "exempt_1q", "yuuyo", "student"].includes(s); }
export function canFuka(s: Status) { return s === "unemployed" || s === "voluntary60"; }
