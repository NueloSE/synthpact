"use client";
import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACT } from "@/lib/contract";

const CONFIRM_ABI = [
  {
    name: "confirmDelivery",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "dealId", type: "uint256" }],
    outputs: [],
  },
] as const;

export default function ConfirmDeliveryButton({
  dealId,
  clientAddress,
}: {
  dealId: number;
  clientAddress: string;
}) {
  const { address } = useAccount();
  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // Only show if connected wallet is the client
  const isClient = address?.toLowerCase() === clientAddress.toLowerCase();
  if (!isClient) return null;

  if (isSuccess) {
    return (
      <div className="border border-[#22C55E] bg-[rgba(34,197,94,0.05)] px-5 py-4 text-center">
        <div className="font-mono text-[10px] text-[#22C55E] tracking-widest">
          DELIVERY CONFIRMED — USDC RELEASED TO WORKER
        </div>
      </div>
    );
  }

  return (
    <div className="border border-[#1C2230] bg-[#0A0C11]">
      <div className="px-5 py-3 border-b border-[#1C2230]">
        <span className="font-mono text-[10px] text-[#F0A500] tracking-widest">
          ACTION REQUIRED
        </span>
      </div>
      <div className="px-5 py-5 space-y-4">
        <p className="font-mono text-xs text-[#7B8EA8]">
          The worker has submitted a delivery. Review it and confirm to release USDC from escrow.
        </p>
        {error && (
          <div className="border border-[#EF4444] px-3 py-2">
            <p className="font-mono text-[10px] text-[#EF4444]">
              {error.message?.slice(0, 100) || "Transaction failed"}
            </p>
          </div>
        )}
        <button
          onClick={() =>
            writeContract({
              address: CONTRACT,
              abi: CONFIRM_ABI,
              functionName: "confirmDelivery",
              args: [BigInt(dealId)],
            })
          }
          disabled={isPending || isConfirming}
          className="w-full py-3 font-mono text-xs tracking-widest font-bold border transition-all
            disabled:opacity-40 disabled:cursor-not-allowed
            border-[#22C55E] text-[#22C55E] hover:bg-[#22C55E] hover:text-[#050608]"
        >
          {isPending ? "CONFIRM IN WALLET…" : isConfirming ? "BROADCASTING…" : "CONFIRM DELIVERY & RELEASE USDC"}
        </button>
      </div>
    </div>
  );
}
