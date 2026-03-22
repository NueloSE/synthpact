"use client";
import { useState } from "react";
import { useAccount } from "wagmi";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { parseEther } from "viem";
import { CONTRACT } from "@/lib/contract";

const ACCEPT_ABI = [
  {
    name: "acceptOffer",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "dealId", type: "uint256" },
      { name: "erc8004Identity", type: "string" },
    ],
    outputs: [],
  },
] as const;

interface HireButtonProps {
  dealId: number;
  priceUsdc: string; // e.g. "10.00"
  worker: string;
}

export default function HireButton({ dealId, priceUsdc, worker }: HireButtonProps) {
  const { address, isConnected } = useAccount();
  const [ethAmount, setEthAmount] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [erc8004Id, setErc8004Id] = useState("");

  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // Don't allow hiring your own deal
  if (address?.toLowerCase() === worker.toLowerCase()) return null;

  if (!isConnected) {
    return (
      <div className="flex flex-col items-end gap-2">
        <ConnectButton label="Connect to Hire" />
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="border border-[#22C55E] bg-[rgba(34,197,94,0.05)] px-4 py-3 text-center">
        <div className="font-mono text-[10px] text-[#22C55E] tracking-widest">DEAL ACCEPTED</div>
        <div className="font-mono text-[10px] text-[#7B8EA8] mt-1">USDC locked in escrow</div>
      </div>
    );
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="px-4 py-2 bg-[#F0A500] text-[#050608] font-mono text-xs font-bold tracking-widest hover:bg-[#D4920A] transition-colors"
      >
        HIRE / ACCEPT
      </button>
    );
  }

  function handleHire(e: React.FormEvent) {
    e.preventDefault();
    const eth = parseFloat(ethAmount);
    if (!eth || eth <= 0) return;
    writeContract({
      address: CONTRACT,
      abi: ACCEPT_ABI,
      functionName: "acceptOffer",
      args: [BigInt(dealId), erc8004Id || ""],
      value: parseEther(ethAmount),
    });
  }

  return (
    <div className="border border-[#F0A500]/30 bg-[rgba(240,165,0,0.03)] p-4 space-y-3">
      <div className="font-mono text-[10px] text-[#F0A500] tracking-widest">ACCEPT DEAL #{dealId}</div>
      <div className="font-mono text-[10px] text-[#7B8EA8]">
        Service price: <span className="text-[#E8EFF8]">${priceUsdc} USDC</span>. Send ETH — contract auto-swaps via Uniswap v3.
      </div>

      <form onSubmit={handleHire} className="space-y-3">
        <div className="border border-[#1C2230] bg-[#0A0C11]">
          <div className="px-4 py-2 border-b border-[#1C2230]">
            <span className="font-mono text-[10px] text-[#3A4558] tracking-widest">ETH AMOUNT TO SEND</span>
          </div>
          <div className="px-4 py-3 flex items-center gap-2">
            <input
              type="number"
              min="0.0001"
              step="0.0001"
              value={ethAmount}
              onChange={(e) => setEthAmount(e.target.value)}
              placeholder="0.01"
              required
              className="flex-1 bg-transparent font-mono text-sm text-[#F0A500] placeholder-[#3A4558] outline-none"
            />
            <span className="font-mono text-[10px] text-[#3A4558]">ETH</span>
          </div>
        </div>

        <div className="border border-[#1C2230] bg-[#0A0C11]">
          <div className="px-4 py-2 border-b border-[#1C2230]">
            <span className="font-mono text-[10px] text-[#3A4558] tracking-widest">YOUR ERC-8004 ID (optional)</span>
          </div>
          <div className="px-4 py-3">
            <input
              type="text"
              value={erc8004Id}
              onChange={(e) => setErc8004Id(e.target.value)}
              placeholder="synthpact:84532:0x8004…:client-001"
              className="w-full bg-transparent font-mono text-xs text-[#E8EFF8] placeholder-[#3A4558] outline-none"
            />
          </div>
        </div>

        {writeError && (
          <div className="border border-[#EF4444] bg-[rgba(239,68,68,0.05)] px-4 py-2">
            <p className="font-mono text-[10px] text-[#EF4444]">
              {writeError.message?.slice(0, 120) || "Transaction failed"}
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="px-4 py-2 border border-[#2A3347] text-[#7B8EA8] font-mono text-xs tracking-widest hover:border-[#3A4558] transition-colors"
          >
            CANCEL
          </button>
          <button
            type="submit"
            disabled={isPending || isConfirming || !ethAmount}
            className="flex-1 py-2 font-mono text-xs tracking-widest font-bold border border-[#F0A500] text-[#F0A500] hover:bg-[#F0A500] hover:text-[#050608] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPending ? "CONFIRM IN WALLET…" : isConfirming ? "BROADCASTING…" : "ACCEPT & LOCK ESCROW"}
          </button>
        </div>
      </form>
    </div>
  );
}
