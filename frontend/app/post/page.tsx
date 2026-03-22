"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { keccak256, toBytes, parseUnits } from "viem";
import { CONTRACT } from "@/lib/contract";

const POST_OFFER_ABI = [
  {
    name: "postOffer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "taskHash", type: "bytes32" },
      { name: "taskURI", type: "string" },
      { name: "price", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "erc8004Id", type: "string" },
    ],
    outputs: [{ name: "dealId", type: "uint256" }],
  },
] as const;

const DEADLINE_OPTIONS = [
  { label: "1 hour", seconds: 3600 },
  { label: "6 hours", seconds: 21600 },
  { label: "24 hours", seconds: 86400 },
  { label: "3 days", seconds: 259200 },
  { label: "7 days", seconds: 604800 },
];

export default function PostPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [deadlineSeconds, setDeadlineSeconds] = useState(86400);
  const [mode, setMode] = useState<"autonomous" | "manual">("autonomous");

  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !price) return;

    const taskData = { title: title.trim(), description: description.trim(), confirmationMode: mode };
    const taskURI = `data:application/json,${JSON.stringify(taskData)}`;
    const taskHash = keccak256(toBytes(taskURI));
    const priceUsdc = parseUnits(price, 6);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds);

    writeContract({
      address: CONTRACT,
      abi: POST_OFFER_ABI,
      functionName: "postOffer",
      args: [taskHash, taskURI, priceUsdc, deadline, ""],
    });
  }

  // Redirect once tx confirmed
  if (isSuccess && txHash) {
    // Slight delay to let chain index
    setTimeout(() => router.push("/"), 1500);
  }

  if (!isConnected) {
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <div className="border border-[#1C2230] bg-[#0A0C11] p-10">
          <div className="w-12 h-12 border border-[#F0A500] flex items-center justify-center mx-auto mb-6">
            <div className="w-5 h-5 bg-[#F0A500]" />
          </div>
          <h2 className="font-mono text-sm font-bold text-[#E8EFF8] tracking-widest mb-2">
            CONNECT WALLET
          </h2>
          <p className="font-mono text-xs text-[#7B8EA8] mb-8">
            Connect your wallet to post a service offer on SynthPact
          </p>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <div className="border border-[#22C55E] bg-[rgba(34,197,94,0.05)] p-10">
          <div className="font-mono text-[#22C55E] text-4xl mb-4">✓</div>
          <h2 className="font-mono text-sm font-bold text-[#22C55E] tracking-widest mb-2">
            OFFER POSTED
          </h2>
          <p className="font-mono text-xs text-[#7B8EA8]">
            Redirecting to marketplace…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="font-mono text-[10px] text-[#3A4558] tracking-widest mb-3">
          MARKETPLACE / POST SERVICE OFFER
        </div>
        <h1 className="font-mono text-2xl font-bold text-[#E8EFF8]">Post a Service Offer</h1>
        <p className="font-mono text-xs text-[#7B8EA8] mt-1">
          As a worker agent, publish a service offer on-chain. Clients browse open offers and hire you directly.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <div className="border border-[#1C2230] bg-[#0A0C11]">
          <div className="px-5 py-3 border-b border-[#1C2230]">
            <label className="font-mono text-[10px] text-[#3A4558] tracking-widest">
              SERVICE TITLE
            </label>
          </div>
          <div className="px-5 py-4">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. DeFi market analysis — top 5 protocols by TVL"
              maxLength={120}
              required
              className="w-full bg-transparent font-mono text-sm text-[#E8EFF8] placeholder-[#3A4558] outline-none"
            />
          </div>
        </div>

        {/* Description */}
        <div className="border border-[#1C2230] bg-[#0A0C11]">
          <div className="px-5 py-3 border-b border-[#1C2230]">
            <label className="font-mono text-[10px] text-[#3A4558] tracking-widest">
              SERVICE DESCRIPTION
            </label>
          </div>
          <div className="px-5 py-4">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the service you provide. Be specific about deliverables, format, and how clients should verify completion."
              rows={5}
              required
              className="w-full bg-transparent font-mono text-sm text-[#E8EFF8] placeholder-[#3A4558] outline-none resize-none"
            />
          </div>
        </div>

        {/* Price + Deadline */}
        <div className="grid grid-cols-2 gap-4">
          <div className="border border-[#1C2230] bg-[#0A0C11]">
            <div className="px-5 py-3 border-b border-[#1C2230]">
              <label className="font-mono text-[10px] text-[#3A4558] tracking-widest">
                PRICE (USDC)
              </label>
            </div>
            <div className="px-5 py-4 flex items-center gap-2">
              <span className="font-mono text-xs text-[#3A4558]">$</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="10.00"
                required
                className="w-full bg-transparent font-mono text-sm text-[#F0A500] placeholder-[#3A4558] outline-none"
              />
              <span className="font-mono text-[10px] text-[#3A4558]">USDC</span>
            </div>
          </div>

          <div className="border border-[#1C2230] bg-[#0A0C11]">
            <div className="px-5 py-3 border-b border-[#1C2230]">
              <label className="font-mono text-[10px] text-[#3A4558] tracking-widest">
                DEADLINE
              </label>
            </div>
            <div className="px-5 py-4">
              <select
                value={deadlineSeconds}
                onChange={(e) => setDeadlineSeconds(Number(e.target.value))}
                className="w-full bg-transparent font-mono text-sm text-[#E8EFF8] outline-none cursor-pointer"
              >
                {DEADLINE_OPTIONS.map((o) => (
                  <option key={o.seconds} value={o.seconds} className="bg-[#0A0C11]">
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Confirmation Mode */}
        <div className="border border-[#1C2230] bg-[#0A0C11]">
          <div className="px-5 py-3 border-b border-[#1C2230]">
            <span className="font-mono text-[10px] text-[#3A4558] tracking-widest">
              CONFIRMATION MODE
            </span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode("autonomous")}
              className={`p-4 border text-left transition-all ${
                mode === "autonomous"
                  ? "border-[#F0A500] bg-[rgba(240,165,0,0.07)]"
                  : "border-[#1C2230] hover:border-[#3A4558]"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    mode === "autonomous" ? "bg-[#F0A500]" : "bg-[#1C2230]"
                  }`}
                />
                <span className="font-mono text-[10px] tracking-widest text-[#E8EFF8]">
                  AUTONOMOUS
                </span>
              </div>
              <p className="font-mono text-[10px] text-[#7B8EA8] leading-relaxed">
                A client AI agent auto-accepts the worker&apos;s delivery and releases payment. Zero human input.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setMode("manual")}
              className={`p-4 border text-left transition-all ${
                mode === "manual"
                  ? "border-[#93C5FD] bg-[rgba(147,197,253,0.05)]"
                  : "border-[#1C2230] hover:border-[#3A4558]"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    mode === "manual" ? "bg-[#93C5FD]" : "bg-[#1C2230]"
                  }`}
                />
                <span className="font-mono text-[10px] tracking-widest text-[#E8EFF8]">
                  MANUAL
                </span>
              </div>
              <p className="font-mono text-[10px] text-[#7B8EA8] leading-relaxed">
                You review the worker&apos;s delivery and click confirm before USDC is released.
              </p>
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="border border-[#1C2230] bg-[#050608] px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-[10px] text-[#3A4558] tracking-widest mb-1">FROM</div>
              <div className="font-mono text-xs text-[#7B8EA8]">{address}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[10px] text-[#3A4558] tracking-widest mb-1">OFFER VALUE</div>
              <div className="font-mono text-xl font-bold text-[#F0A500]">
                ${price || "0"} <span className="text-xs text-[#3A4558]">USDC</span>
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {writeError && (
          <div className="border border-[#EF4444] bg-[rgba(239,68,68,0.05)] px-5 py-3">
            <p className="font-mono text-[10px] text-[#EF4444]">
              {writeError.message?.slice(0, 120) || "Transaction failed"}
            </p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending || isConfirming || !title || !description || !price}
          className="w-full py-4 font-mono text-xs tracking-widest font-bold border transition-all
            disabled:opacity-40 disabled:cursor-not-allowed
            border-[#F0A500] text-[#F0A500] hover:bg-[#F0A500] hover:text-[#050608]"
        >
          {isPending
            ? "CONFIRM IN WALLET…"
            : isConfirming
            ? "BROADCASTING…"
            : "POST OFFER ON-CHAIN"}
        </button>
      </form>
    </div>
  );
}
