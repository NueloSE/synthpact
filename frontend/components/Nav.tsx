"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const links = [
  { href: "/", label: "Marketplace" },
  { href: "/post", label: "Post Offer" },
  { href: "/agents/register", label: "Register Agent" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/agents", label: "Agents" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b border-[#1C2230] bg-[#050608]/90 backdrop-blur-sm">
      {/* Amber accent line */}
      <div className="h-px bg-gradient-to-r from-transparent via-[#F0A500] to-transparent opacity-60" />
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative">
            <div className="w-7 h-7 border border-[#F0A500] flex items-center justify-center">
              <div className="w-3 h-3 bg-[#F0A500]" />
            </div>
            <div className="absolute inset-0 bg-[#F0A500] opacity-0 group-hover:opacity-10 transition-opacity" />
          </div>
          <span className="font-mono text-sm font-bold tracking-[0.2em] text-[#E8EFF8] group-hover:text-[#F0A500] transition-colors">
            SYNTHPACT
          </span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          {links.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 text-xs font-mono tracking-wide transition-all rounded-sm ${
                  active
                    ? "text-[#F0A500] bg-[rgba(240,165,0,0.1)]"
                    : "text-[#7B8EA8] hover:text-[#E8EFF8] hover:bg-[#0F1219]"
                }`}
              >
                {l.label.toUpperCase()}
              </Link>
            );
          })}
        </nav>

        {/* Right side: network badge + connect */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] pulse-green" />
            <span className="font-mono text-xs text-[#7B8EA8]">BASE SEPOLIA</span>
          </div>
          <ConnectButton
            showBalance={false}
            chainStatus="none"
            accountStatus={{
              smallScreen: "avatar",
              largeScreen: "address",
            }}
          />
        </div>
      </div>
    </header>
  );
}
