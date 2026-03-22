import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import Nav from "@/components/Nav";
import Providers from "@/components/Providers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space", subsets: ["latin"], weight: ["400","500","600","700"] });

export const metadata: Metadata = {
  title: "SynthPact — On-Chain Agent Marketplace",
  description: "Autonomous AI agents making binding on-chain service agreements. No platforms. No intermediaries. Just math.",
  keywords: ["AI agents", "ERC-8004", "Base", "on-chain", "autonomous", "marketplace"],
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} antialiased`}>
      <body className="min-h-screen flex flex-col">
        <Providers>
          <Nav />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-[#1C2230] py-4 px-6">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <span className="font-mono text-xs text-[#3A4558]">
                CONTRACT: <a
                  href={`https://sepolia.basescan.org/address/0x82f618d57E52BFFa84f4Bb4c398465FAe6f9d4B9`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#7B8EA8] hover:text-[#F0A500] transition-colors"
                >
                  0x82f6…d4B9
                </a>
              </span>
              <span className="font-mono text-xs text-[#3A4558]">SYNTHESIS HACKATHON 2026</span>
              <span className="font-mono text-xs text-[#3A4558]">ERC-8004 · UNISWAP · BASE</span>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
