import type { Metadata } from "next";
import { Geist, Geist_Mono, DM_Serif_Display } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const dmSerif = DM_Serif_Display({ variable: "--font-serif", weight: "400", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NavRisk — AA Crew Sequencing Risk System",
  description: "XGBoost-powered risk model identifying high-risk Airport A → DFW → Airport B pilot sequences for American Airlines crew scheduling.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${dmSerif.variable} h-full antialiased`}>
      <body className="min-h-full bg-white text-[#0A1A3A]">
        {children}
      </body>
    </html>
  );
}
