import { getDealAcceptanceTx } from "@/lib/contract";

export default async function SwapBadge({ dealId, usdcPrice }: { dealId: number; usdcPrice: string }) {
  const info = await getDealAcceptanceTx(dealId);

  return (
    <div className="border border-[#FF007A]/20 bg-[rgba(255,0,122,0.03)]">
      <div className="px-5 py-3 border-b border-[#FF007A]/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Uniswap unicorn-ish mark */}
          <span className="font-mono text-[10px] text-[#FF007A] tracking-widest">
            UNISWAP v3
          </span>
          <span className="font-mono text-[10px] text-[#3A4558]">·</span>
          <span className="font-mono text-[10px] text-[#3A4558] tracking-widest">
            ESCROW SWAP
          </span>
        </div>
        <span className="font-mono text-[10px] font-bold text-[#FF007A]">
          ${usdcPrice} USDC LOCKED
        </span>
      </div>

      <div className="px-5 py-4 space-y-3">
        <p className="font-mono text-[10px] text-[#7B8EA8] leading-relaxed">
          When the client accepted this offer, their payment was auto-swapped to USDC
          via Uniswap v3 SwapRouter and locked in the SynthPact escrow contract.
          USDC releases to the worker upon delivery confirmation.
        </p>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="font-mono text-[10px] text-[#3A4558] tracking-widest mb-1">PROTOCOL</div>
            <div className="font-mono text-xs text-[#FF007A]">Uniswap v3</div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-[#3A4558] tracking-widest mb-1">OUTPUT TOKEN</div>
            <div className="font-mono text-xs text-[#E8EFF8]">USDC</div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-[#3A4558] tracking-widest mb-1">LOCKED</div>
            <div className="font-mono text-xs text-[#E8EFF8]">${usdcPrice}</div>
          </div>
        </div>

        {info?.txHash && (
          <a
            href={`https://sepolia.basescan.org/tx/${info.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between group border border-[#1C2230] px-3 py-2 hover:border-[#FF007A] transition-colors"
          >
            <span className="font-mono text-[10px] text-[#3A4558] tracking-widest group-hover:text-[#FF007A] transition-colors">
              ACCEPTANCE TX
            </span>
            <span className="font-mono text-[10px] text-[#7B8EA8] group-hover:text-[#FF007A] transition-colors">
              {info.txHash.slice(0, 10)}…{info.txHash.slice(-6)} ↗
            </span>
          </a>
        )}

        <a
          href="https://sepolia.basescan.org/address/0x82f618d57E52BFFa84f4Bb4c398465FAe6f9d4B9"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between group border border-[#1C2230] px-3 py-2 hover:border-[#FF007A] transition-colors"
        >
          <span className="font-mono text-[10px] text-[#3A4558] tracking-widest group-hover:text-[#FF007A] transition-colors">
            SYNTHPACT ESCROW CONTRACT
          </span>
          <span className="font-mono text-[10px] text-[#7B8EA8] group-hover:text-[#FF007A] transition-colors">
            0x82f6…d4B9 ↗
          </span>
        </a>
      </div>
    </div>
  );
}
