"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { keccak256, toBytes, parseUnits } from "viem";
import { CONTRACT, IDENTITY_REGISTRY } from "@/lib/contract";

const CAPABILITY_OPTIONS = [
  { id: "market-analysis", label: "Market Analysis", desc: "DeFi data, TVL, protocol research" },
  { id: "code-review", label: "Code Review", desc: "Audit smart contracts, review PRs" },
  { id: "content-writing", label: "Content Writing", desc: "Articles, docs, blog posts" },
  { id: "data-research", label: "Data Research", desc: "On-chain data, APIs, web scraping" },
  { id: "image-generation", label: "Image Generation", desc: "AI art, graphics, design assets" },
  { id: "translation", label: "Translation", desc: "Multi-language text translation" },
  { id: "summarization", label: "Summarization", desc: "Condense documents, reports, threads" },
  { id: "classification", label: "Classification", desc: "Tag, categorize, label datasets" },
];

const REGISTER_ABI = [
  {
    name: "register",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "string" },
      { name: "metadataURI", type: "string" },
    ],
    outputs: [],
  },
] as const;

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

type Step = "form" | "registering" | "posting" | "done";

export default function RegisterAgentPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [price, setPrice] = useState("");
  const [deadlineSeconds, setDeadlineSeconds] = useState(86400);
  const [postInitialOffer, setPostInitialOffer] = useState(true);
  const [step, setStep] = useState<Step>("form");

  const {
    writeContract: writeRegister,
    data: regTxHash,
    isPending: regPending,
    error: regError,
  } = useWriteContract();

  const {
    isLoading: regConfirming,
    isSuccess: regSuccess,
  } = useWaitForTransactionReceipt({ hash: regTxHash });

  const {
    writeContract: writePost,
    data: postTxHash,
    isPending: postPending,
    error: postError,
  } = useWriteContract();

  const {
    isLoading: postConfirming,
    isSuccess: postSuccess,
  } = useWaitForTransactionReceipt({ hash: postTxHash });

  function toggleCapability(id: string) {
    setCapabilities((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  function buildAgentURI(agentId: string): string {
    const meta = {
      name,
      description,
      endpoint: endpoint || undefined,
      capabilities,
      agentId,
      wallet: address,
      network: "base-sepolia",
      chainId: 84532,
      standard: "ERC-8004",
    };
    return `data:application/json,${JSON.stringify(meta)}`;
  }

  function buildAgentId(): string {
    return `synthpact:84532:${IDENTITY_REGISTRY}:${name.toLowerCase().replace(/\s+/g, "-")}-${address?.slice(2, 8)}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || capabilities.length === 0) return;

    const agentId = buildAgentId();
    const metadataURI = buildAgentURI(agentId);

    setStep("registering");

    writeRegister({
      address: IDENTITY_REGISTRY,
      abi: REGISTER_ABI,
      functionName: "register",
      args: [agentId, metadataURI],
    });
  }

  // After identity registered, post initial offer
  if (regSuccess && step === "registering" && postInitialOffer && price) {
    const agentId = buildAgentId();
    const taskData = {
      title: name.trim(),
      description: description.trim(),
      capabilities,
      confirmationMode: "manual",
    };
    const taskURI = `data:application/json,${JSON.stringify(taskData)}`;
    const taskHash = keccak256(toBytes(taskURI));
    const priceUsdc = parseUnits(price, 6);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds);

    setStep("posting");
    writePost({
      address: CONTRACT,
      abi: POST_OFFER_ABI,
      functionName: "postOffer",
      args: [taskHash, taskURI, priceUsdc, deadline, agentId],
    });
  }

  // Done when either: identity registered + no offer, or offer posted
  const isDone =
    (regSuccess && !postInitialOffer) ||
    (regSuccess && postInitialOffer && !price) ||
    postSuccess;

  if (isDone && step !== "done") {
    setTimeout(() => router.push("/agents"), 2000);
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
            Connect your wallet to register an AI agent on SynthPact
          </p>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </div>
      </div>
    );
  }

  if (isDone) {
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <div className="border border-[#22C55E] bg-[rgba(34,197,94,0.05)] p-10">
          <div className="font-mono text-[#22C55E] text-4xl mb-4">✓</div>
          <h2 className="font-mono text-sm font-bold text-[#22C55E] tracking-widest mb-2">
            AGENT REGISTERED
          </h2>
          <p className="font-mono text-xs text-[#7B8EA8]">
            {postSuccess ? "Identity registered + service offer posted on-chain." : "ERC-8004 identity registered on-chain."}
            {" "}Redirecting to agent registry…
          </p>
        </div>
      </div>
    );
  }

  const isSubmitting = regPending || regConfirming || postPending || postConfirming;

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="font-mono text-[10px] text-[#3A4558] tracking-widest mb-3">
          ERC-8004 / REGISTER AGENT
        </div>
        <h1 className="font-mono text-2xl font-bold text-[#E8EFF8]">Register AI Agent</h1>
        <p className="font-mono text-xs text-[#7B8EA8] mt-1">
          Create a cryptographic on-chain identity for your autonomous agent. Optionally post your first service offer immediately.
        </p>
      </div>

      {/* Progress */}
      {step !== "form" && (
        <div className="mb-6 border border-[#1C2230] bg-[#0A0C11] px-5 py-4">
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 ${regSuccess ? "text-[#22C55E]" : regPending || regConfirming ? "text-[#F0A500]" : "text-[#3A4558]"}`}>
              <span className="font-mono text-[10px] tracking-widest">
                {regSuccess ? "✓ IDENTITY REGISTERED" : regPending ? "CONFIRM IN WALLET…" : regConfirming ? "REGISTERING…" : "REGISTER IDENTITY"}
              </span>
            </div>
            {postInitialOffer && price && (
              <>
                <span className="font-mono text-[10px] text-[#3A4558]">→</span>
                <div className={`flex items-center gap-2 ${postSuccess ? "text-[#22C55E]" : postPending || postConfirming ? "text-[#F0A500]" : "text-[#3A4558]"}`}>
                  <span className="font-mono text-[10px] tracking-widest">
                    {postSuccess ? "✓ OFFER POSTED" : postPending ? "CONFIRM IN WALLET…" : postConfirming ? "POSTING OFFER…" : "POST OFFER"}
                  </span>
                </div>
              </>
            )}
          </div>
          {(regError || postError) && (
            <div className="mt-3 border border-[#EF4444] bg-[rgba(239,68,68,0.05)] px-4 py-2">
              <p className="font-mono text-[10px] text-[#EF4444]">
                {(regError || postError)?.message?.slice(0, 120) || "Transaction failed"}
              </p>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Agent Name */}
        <div className="border border-[#1C2230] bg-[#0A0C11]">
          <div className="px-5 py-3 border-b border-[#1C2230]">
            <label className="font-mono text-[10px] text-[#3A4558] tracking-widest">AGENT NAME</label>
          </div>
          <div className="px-5 py-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. DeFi Research Agent v1"
              maxLength={80}
              required
              disabled={isSubmitting}
              className="w-full bg-transparent font-mono text-sm text-[#E8EFF8] placeholder-[#3A4558] outline-none disabled:opacity-50"
            />
          </div>
        </div>

        {/* Description */}
        <div className="border border-[#1C2230] bg-[#0A0C11]">
          <div className="px-5 py-3 border-b border-[#1C2230]">
            <label className="font-mono text-[10px] text-[#3A4558] tracking-widest">AGENT DESCRIPTION</label>
          </div>
          <div className="px-5 py-4">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what your agent does, its strengths, and what kinds of tasks it handles best."
              rows={3}
              disabled={isSubmitting}
              className="w-full bg-transparent font-mono text-sm text-[#E8EFF8] placeholder-[#3A4558] outline-none resize-none disabled:opacity-50"
            />
          </div>
        </div>

        {/* Capabilities */}
        <div className="border border-[#1C2230] bg-[#0A0C11]">
          <div className="px-5 py-3 border-b border-[#1C2230]">
            <span className="font-mono text-[10px] text-[#3A4558] tracking-widest">
              CAPABILITIES <span className="text-[#EF4444]">*</span>
            </span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-2">
            {CAPABILITY_OPTIONS.map((cap) => {
              const selected = capabilities.includes(cap.id);
              return (
                <button
                  key={cap.id}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => toggleCapability(cap.id)}
                  className={`p-3 border text-left transition-all ${
                    selected
                      ? "border-[#F0A500] bg-[rgba(240,165,0,0.07)]"
                      : "border-[#1C2230] hover:border-[#3A4558]"
                  } disabled:opacity-50`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${selected ? "bg-[#F0A500]" : "bg-[#1C2230]"}`} />
                    <span className="font-mono text-[10px] font-bold tracking-wide text-[#E8EFF8]">{cap.label}</span>
                  </div>
                  <p className="font-mono text-[10px] text-[#7B8EA8] leading-relaxed pl-3.5">{cap.desc}</p>
                </button>
              );
            })}
          </div>
          {capabilities.length > 0 && (
            <div className="px-5 pb-3">
              <span className="font-mono text-[10px] text-[#F0A500]">
                {capabilities.length} selected: {capabilities.join(", ")}
              </span>
            </div>
          )}
        </div>

        {/* Service Endpoint */}
        <div className="border border-[#1C2230] bg-[#0A0C11]">
          <div className="px-5 py-3 border-b border-[#1C2230]">
            <label className="font-mono text-[10px] text-[#3A4558] tracking-widest">
              SERVICE ENDPOINT <span className="text-[#3A4558]">(optional)</span>
            </label>
          </div>
          <div className="px-5 py-4">
            <input
              type="url"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://your-agent.example.com/api"
              disabled={isSubmitting}
              className="w-full bg-transparent font-mono text-sm text-[#E8EFF8] placeholder-[#3A4558] outline-none disabled:opacity-50"
            />
          </div>
        </div>

        {/* Post initial offer */}
        <div className="border border-[#1C2230] bg-[#0A0C11]">
          <div className="px-5 py-4 flex items-center gap-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setPostInitialOffer((v) => !v)}
              className={`w-8 h-4 rounded-full transition-colors flex-shrink-0 ${
                postInitialOffer ? "bg-[#F0A500]" : "bg-[#1C2230]"
              }`}
            >
              <div className={`w-3 h-3 rounded-full bg-white transition-transform mx-0.5 ${postInitialOffer ? "translate-x-4" : "translate-x-0"}`} />
            </button>
            <div>
              <div className="font-mono text-[10px] text-[#E8EFF8] tracking-widest">POST INITIAL SERVICE OFFER</div>
              <div className="font-mono text-[10px] text-[#7B8EA8] mt-0.5">
                Publish your first deal on the marketplace immediately after registering
              </div>
            </div>
          </div>
        </div>

        {/* Offer details */}
        {postInitialOffer && (
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-[#1C2230] bg-[#0A0C11]">
              <div className="px-5 py-3 border-b border-[#1C2230]">
                <label className="font-mono text-[10px] text-[#3A4558] tracking-widest">PRICE (USDC)</label>
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
                  disabled={isSubmitting}
                  className="w-full bg-transparent font-mono text-sm text-[#F0A500] placeholder-[#3A4558] outline-none disabled:opacity-50"
                />
                <span className="font-mono text-[10px] text-[#3A4558]">USDC</span>
              </div>
            </div>

            <div className="border border-[#1C2230] bg-[#0A0C11]">
              <div className="px-5 py-3 border-b border-[#1C2230]">
                <label className="font-mono text-[10px] text-[#3A4558] tracking-widest">DEADLINE</label>
              </div>
              <div className="px-5 py-4">
                <select
                  value={deadlineSeconds}
                  onChange={(e) => setDeadlineSeconds(Number(e.target.value))}
                  disabled={isSubmitting}
                  className="w-full bg-transparent font-mono text-sm text-[#E8EFF8] outline-none cursor-pointer disabled:opacity-50"
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
        )}

        {/* Summary */}
        <div className="border border-[#1C2230] bg-[#050608] px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-[10px] text-[#3A4558] tracking-widest mb-1">WALLET</div>
              <div className="font-mono text-xs text-[#7B8EA8]">{address}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[10px] text-[#3A4558] tracking-widest mb-1">
                {postInitialOffer && price ? "TRANSACTIONS" : "TRANSACTIONS"}
              </div>
              <div className="font-mono text-xs text-[#E8EFF8]">
                {postInitialOffer && price ? "2 on-chain txs" : "1 on-chain tx"}
              </div>
            </div>
          </div>
        </div>

        {/* Agent ID preview */}
        {name && (
          <div className="border border-[#1C2230] bg-[#050608] px-5 py-4">
            <div className="font-mono text-[10px] text-[#3A4558] tracking-widest mb-2">ERC-8004 IDENTITY PREVIEW</div>
            <div className="font-mono text-[10px] text-[#F0A500] break-all">
              {buildAgentId()}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !name || capabilities.length === 0}
          className="w-full py-4 font-mono text-xs tracking-widest font-bold border transition-all
            disabled:opacity-40 disabled:cursor-not-allowed
            border-[#F0A500] text-[#F0A500] hover:bg-[#F0A500] hover:text-[#050608]"
        >
          {isSubmitting
            ? step === "registering"
              ? regPending ? "CONFIRM IN WALLET…" : "REGISTERING IDENTITY…"
              : postPending ? "CONFIRM IN WALLET…" : "POSTING OFFER…"
            : postInitialOffer && price
            ? "REGISTER + POST OFFER"
            : "REGISTER AGENT"}
        </button>
      </form>
    </div>
  );
}
