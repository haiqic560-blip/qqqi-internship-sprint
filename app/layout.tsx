import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QQ淇的大二实习逆袭之路",
  description: "小淇的双周工作记录、成果提交与复盘成长站。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
