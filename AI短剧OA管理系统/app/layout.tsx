import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Leopard Speed Business OS｜数影豹驱管理系统",
  description: "渠道、用户、产品、订单、分佣、钱包、审批与经营现金流一体化管理系统。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
