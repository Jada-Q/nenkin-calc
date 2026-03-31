export type DomainId = "pension" | "tax" | "insurance";

export type Domain = {
  id: DomainId;
  label: string;
  icon: string;
  description: string;
  chatMode: "structured" | "freeform";
  chips: string[];
  welcomeTitle: string;
  welcomeSubtitle: string;
  placeholder: string;
};

export const DOMAINS: Record<DomainId, Domain> = {
  insurance: {
    id: "insurance",
    label: "保险相谈",
    icon: "🛡️",
    description: "公的保険・民間保険・外国人注意点",
    chatMode: "freeform",
    chips: [
      "国保和健保有什么区别",
      "高額療養費是什么",
      "失业了保险怎么办",
      "需要买医疗保险吗",
      "生命保险需要吗",
      "帰国前に保険解約",
      "育休中的保险",
      "保险料可以减税吗",
    ],
    welcomeTitle: "问我任何保险问题",
    welcomeSubtitle: "公的保険・民間保険・外国人注意点 — FP2級監修",
    placeholder: "我刚换工作，健保和国保怎么选，民间医疗保险还需要买吗...",
  },
  pension: {
    id: "pension",
    label: "年金计算",
    icon: "🏛️",
    description: "算出你65岁后每月能领多少养老金",
    chatMode: "structured",
    chips: [
      "来日本读过书",
      "在公司上班",
      "辞职/无职业",
      "全职主妇",
      "休过产假育休",
      "有免除期间",
      "打算提前领取",
      "想延后到70岁",
    ],
    welcomeTitle: "告诉我你在日本的经历",
    welcomeSubtitle: "我来算你的养老金",
    placeholder: "我32岁，22岁来日本读书，26岁开始工作，年收450万...",
  },
  tax: {
    id: "tax",
    label: "税金相谈",
    icon: "📋",
    description: "所得税、确定申告、节税对策",
    chatMode: "freeform",
    chips: [
      "所得税怎么算",
      "需要确定申告吗",
      "ふるさと納税",
      "医療費控除",
      "副业的税金",
      "外国人退职时的税",
      "住民税怎么算",
      "年末調整是什么",
    ],
    welcomeTitle: "问我任何税务问题",
    welcomeSubtitle: "确定申告、节税、外国人税务 — FP2級監修",
    placeholder: "我是会社员有副业收入，需要确定申告吗...",
  },
};
