"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { getAllDeals, Deal, truncate, timeAgo, formatDeadline } from "@/lib/contract";
import StatusBadge from "@/components/StatusBadge";

function DealRow({ deal, role }: { deal: Deal; role: "worker" | "client" }) {
  return (
    <Link
      href={`/deal/${deal.id}`}
      className="flex items-center gap-4 px-5 py-4 border-b border-[#0F1219] last:border-0 hover:bg-[#0F1219] transition-colors group"
    >
      <div className="w-10 text-right">
        <span className="font-mono text-[10px] text-[#3A4558]">#{deal.id}</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-mono text-xs text-[#E8EFF8] truncate group-hover:text-[#F0A500] transition-colors">
          {deal.taskTitle || `Deal #${deal.id}`}
        </div>
        <div className="font-mono text-[10px] text-[#3A4558] mt-0.5">
          {role === "worker" ? `CLIENT: ${truncate(deal.client)}` : `WORKER: ${truncate(deal.worker)}`}
          {" · "}
          {timeAgo(deal.createdAt)}
        </div>
      </div>

      <div className="hidden md:block">
        <div className="font-mono text-[10px] text-[#3A4558] mb-0.5">DEADLINE</div>
        <div className="font-mono text-xs text-[#7B8EA8]">{formatDeadline(deal.deadline)}</div>
      </div>

      <div className="text-right min-w-[80px]">
        <div className="font-mono text-sm font-bold text-[#F0A500]">${deal.price}</div>
        <div className="font-mono text-[10px] text-[#3A4558]">USDC</div>
      </div>

      <StatusBadge status={deal.status} />
    </Link>
  );
}

function ConfirmButton({ deal }: { deal: Deal }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // Dynamic import to avoid SSR issues
  async function handleConfirm() {
    setBusy(true);
    try {
      // We use fetch to a server action or direct wagmi hook — but since this is a client component
      // we redirect to the deal page where the confirm button lives with full context
      window.location.href = `/deal/${deal.id}?action=confirm`;
    } finally {
      setBusy(false);
    }
  }

  if (done) return <span className="font-mono text-[10px] text-[#22C55E]">CONFIRMED</span>;

  return (
    <button
      onClick={handleConfirm}
      disabled={busy}
      className="font-mono text-[10px] tracking-widest px-3 py-1.5 border border-[#22C55E] text-[#22C55E] hover:bg-[#22C55E] hover:text-[#050608] transition-all disabled:opacity-40"
    >
      {busy ? "…" : "CONFIRM"}
    </button>
  );
}

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    getAllDeals()
      .then((all) => {
        const addr = address.toLowerCase();
        return all.filter(
          (d) =>
            d.worker.toLowerCase() === addr || d.client.toLowerCase() === addr
        );
      })
      .then(setDeals)
      .finally(() => setLoading(false));
  }, [address]);

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
            Connect your wallet to view your deals
          </p>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </div>
      </div>
    );
  }

  const workerDeals = deals.filter((d) => d.worker.toLowerCase() === address?.toLowerCase());
  const clientDeals = deals.filter((d) => d.client.toLowerCase() === address?.toLowerCase());
  const pendingConfirm = clientDeals.filter((d) => d.status === "Delivered");

  const totalEarned = workerDeals
    .filter((d) => d.status === "Completed")
    .reduce((sum, d) => sum + parseFloat(d.price), 0);

  const totalSpent = clientDeals
    .filter((d) => d.status === "Completed")
    .reduce((sum, d) => sum + parseFloat(d.price), 0);

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="font-mono text-[10px] text-[#3A4558] tracking-widest mb-3">
          DASHBOARD
        </div>
        <h1 className="font-mono text-2xl font-bold text-[#E8EFF8]">My Deals</h1>
        <p className="font-mono text-[10px] text-[#7B8EA8] mt-1">{address}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { label: "DEALS AS WORKER", value: workerDeals.length },
          { label: "DEALS AS CLIENT", value: clientDeals.length },
          { label: "TOTAL EARNED", value: `$${totalEarned.toFixed(2)}`, accent: true },
          { label: "TOTAL SPENT", value: `$${totalSpent.toFixed(2)}` },
        ].map((s) => (
          <div key={s.label} className="border border-[#1C2230] bg-[#0A0C11] px-5 py-4">
            <div className="font-mono text-[10px] text-[#3A4558] tracking-widest mb-1">
              {s.label}
            </div>
            <div
              className={`font-mono text-xl font-bold ${
                s.accent ? "text-[#F0A500]" : "text-[#E8EFF8]"
              }`}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {loading && (
        <div className="font-mono text-xs text-[#3A4558] text-center py-10">
          LOADING DEALS…
        </div>
      )}

      {/* Pending confirmation */}
      {pendingConfirm.length > 0 && (
        <div className="mb-6 border border-[#F0A500] bg-[rgba(240,165,0,0.04)]">
          <div className="px-5 py-3 border-b border-[rgba(240,165,0,0.2)]">
            <span className="font-mono text-[10px] text-[#F0A500] tracking-widest">
              ACTION REQUIRED — {pendingConfirm.length} DEAL{pendingConfirm.length > 1 ? "S" : ""} AWAITING CONFIRMATION
            </span>
          </div>
          {pendingConfirm.map((deal) => (
            <div
              key={deal.id}
              className="flex items-center gap-4 px-5 py-4 border-b border-[rgba(240,165,0,0.1)] last:border-0"
            >
              <div className="flex-1 min-w-0">
                <div className="font-mono text-xs text-[#E8EFF8] truncate">
                  {deal.taskTitle || `Deal #${deal.id}`}
                </div>
                <div className="font-mono text-[10px] text-[#3A4558] mt-0.5">
                  DEAL #{deal.id} · ${deal.price} USDC · WORKER: {truncate(deal.worker)}
                </div>
              </div>
              <Link
                href={`/deal/${deal.id}`}
                className="font-mono text-[10px] tracking-widest px-3 py-1.5 border border-[#22C55E] text-[#22C55E] hover:bg-[#22C55E] hover:text-[#050608] transition-all"
              >
                REVIEW & CONFIRM
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Worker deals */}
      {workerDeals.length > 0 && (
        <div className="border border-[#1C2230] bg-[#0A0C11] mb-6">
          <div className="px-5 py-3 border-b border-[#1C2230] flex items-center justify-between">
            <span className="font-mono text-[10px] text-[#3A4558] tracking-widest">
              POSTED OFFERS ({workerDeals.length})
            </span>
            <span className="font-mono text-[10px] text-[#3A4558]">
              AS WORKER
            </span>
          </div>
          {workerDeals.map((d) => (
            <DealRow key={d.id} deal={d} role="worker" />
          ))}
        </div>
      )}

      {/* Client deals */}
      {clientDeals.length > 0 && (
        <div className="border border-[#1C2230] bg-[#0A0C11] mb-6">
          <div className="px-5 py-3 border-b border-[#1C2230] flex items-center justify-between">
            <span className="font-mono text-[10px] text-[#3A4558] tracking-widest">
              ACCEPTED DEALS ({clientDeals.length})
            </span>
            <span className="font-mono text-[10px] text-[#3A4558]">
              AS CLIENT
            </span>
          </div>
          {clientDeals.map((d) => (
            <DealRow key={d.id} deal={d} role="client" />
          ))}
        </div>
      )}

      {!loading && deals.length === 0 && (
        <div className="border border-[#1C2230] bg-[#0A0C11] px-5 py-16 text-center">
          <div className="font-mono text-xs text-[#3A4558] mb-4">NO DEALS FOUND</div>
          <p className="font-mono text-[10px] text-[#3A4558] mb-6">
            This wallet hasn&apos;t posted or accepted any offers yet.
          </p>
          <Link
            href="/post"
            className="inline-block px-6 py-2.5 border border-[#F0A500] font-mono text-xs text-[#F0A500] hover:bg-[#F0A500] hover:text-[#050608] transition-all tracking-widest"
          >
            POST A TASK
          </Link>
        </div>
      )}
    </div>
  );
}
