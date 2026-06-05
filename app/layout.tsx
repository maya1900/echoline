import type { Metadata } from "next";
import { RouteLoadingIndicator } from "@/components/route-loading-indicator";
import "./globals.css";

export const metadata: Metadata = {
  title: "追句 EchoLine",
  description: "逐句看剧学英语工作台"
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
