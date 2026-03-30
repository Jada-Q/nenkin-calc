import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "日本年金计算器 | 在日华人养老金模拟",
  description:
    "输入你的年龄、来日时间、年收入，立即算出65岁后每月能领多少养老金。国民年金+厚生年金，2026年最新数据。",
  openGraph: {
    title: "日本年金计算器 | 在日华人养老金模拟",
    description: "输入3个数字，秒算你的日本养老金",
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
