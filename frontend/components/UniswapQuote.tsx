"use client";
import { useEffect, useState } from "react";

interface Quote {
  ethPriceUSD: string;
  route: string;
  quoteId: string;
  gasFeeUSD: string;
  priceImpact: number;
}

export default function UniswapQuote() {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number>(0);

  async function fetchQuote() {
    try {
      const res = await fetch("/api/quote", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setQuote(data);
      setLastUpdated(Date.now());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchQuote();
    const id = setInterval(fetchQuote, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="border border-[#FF007A]/20 bg-[rgba(255,0,122,0.03)]">
      <div className="px-5 py-3 border-b border-[#FF007A]/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-[#FF007A] tracking-widest">UNISWAP API</span>
          <span className="font-mono text-[10px] text-[#3A4558]">·</span>
          <span className="font-mono text-[10px] text-[#3A4558] tracking-widest">LIVE PRICE</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF007A]" />
          <span className="font-mono text-[10px] text-[#3A4558]">30s REFRESH</span>
        </div>
      </div>

      <div className="px-5 py-4">
        {loading ? (
          <div className="font-mono text-[10px] text-[#3A4558]">FETCHING QUOTE…</div>
        ) : !quote ? (
          <div className="font-mono text-[10px] text-[#3A4558]">QUOTE UNAVAILABLE</div>
        ) : (
          <div className="space-y-3">
            {/* Main price */}
            <div className="flex items-end gap-3">
              <div>
                <div className="font-mono text-[10px] text-[#3A4558] tracking-widest mb-1">ETH PRICE</div>
                <div className="font-mono text-2xl font-bold text-[#FF007A]">
                  ${Number(quote.ethPriceUSD).toLocaleString()}
                </div>
                <div className="font-mono text-[10px] text-[#3A4558] mt-0.5">1 ETH → USDC</div>
              </div>
              <div className="mb-1 flex flex-col gap-1">
                <div className="flex gap-2">
                  <span className="font-mono text-[10px] text-[#3A4558]">ROUTE</span>
                  <span className="font-mono text-[10px] text-[#E8EFF8]">{quote.route.toUpperCase()}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-mono text-[10px] text-[#3A4558]">GAS</span>
                  <span className="font-mono text-[10px] text-[#E8EFF8]">${quote.gasFeeUSD}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-mono text-[10px] text-[#3A4558]">IMPACT</span>
                  <span className="font-mono text-[10px] text-[#22C55E]">{quote.priceImpact}%</span>
                </div>
              </div>
            </div>

            {/* Quote ID */}
            <div className="border border-[#1C2230] px-3 py-2">
              <div className="font-mono text-[10px] text-[#3A4558] tracking-widest mb-0.5">QUOTE ID</div>
              <div className="font-mono text-[10px] text-[#7B8EA8] break-all">{quote.quoteId}</div>
            </div>

            <div className="font-mono text-[10px] text-[#3A4558] leading-relaxed">
              Powered by{" "}
              <a
                href="https://developers.uniswap.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#FF007A] hover:underline"
              >
                Uniswap Developer Platform API
              </a>
              . SynthPact escrow uses Uniswap v3 SwapRouter to auto-convert client payments to USDC on deal acceptance.
              {lastUpdated > 0 && (
                <span className="text-[#3A4558]"> Updated {Math.round((Date.now() - lastUpdated) / 1000)}s ago.</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
