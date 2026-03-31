import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "在日FP助手 | 年金・税金AI相谈",
  description:
    "年金计算、税务咨询、节税对策。FP2級監修，面向在日华人的AI理财助手。2026年最新数据。",
  openGraph: {
    title: "在日FP助手 | 年金・税金AI相谈",
    description: "AI帮你算年金、省税金 — FP2級監修",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
