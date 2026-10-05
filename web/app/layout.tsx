import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "Smart Container Monitoring demo",
  description: "Demo of real-time container tracking and cargo health monitoring on KSA roads. All data is synthetic.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body>
        <Providers>
          <Header />
          <main id="main" tabIndex={-1}>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
