import type { Metadata } from "next";
import { RouteLoadingIndicator } from "@/components/route-loading-indicator";
import "./globals.css";

export const metadata: Metadata = {
  title: "Your English Coach",
  description: "看剧学英语学习工作台"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <RouteLoadingIndicator />
        {children}
      </body>
    </html>
  );
}
