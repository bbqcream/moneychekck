import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "페이플랜 | 월급 시나리오 플래너",
  description: "입금과 지출 계획을 적고 다음 월급에서 남는 잔액을 계산하세요.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="ko"><body>{children}</body></html>;
}
