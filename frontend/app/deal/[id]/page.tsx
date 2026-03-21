import { notFound } from "next/navigation";
import Link from "next/link";
import { getDeal, truncate, timeAgo, formatDeadline } from "@/lib/contract";
import StatusBadge from "@/components/StatusBadge";
import ConfirmDeliveryButton from "@/components/ConfirmDeliveryButton";
import DeliverablePreview from "@/components/DeliverablePreview";
import SwapBadge from "@/components/SwapBadge";

export const revalidate = 15;

function Row({ label, value, mono = true }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-4 py-3 border-b border-[#0F1219] last:border-0">
      <div className="font-mono text-[10px] text-[#3A4558] tracking-widest self-start pt-0.5">
        {label}
      </div>
      <div className={`text-xs text-[#E8EFF8] break-all ${mono ? "font-mono" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function Timeline({ deal }: { deal: Awaited<ReturnType<typeof getDeal>> }) {
  if (!deal) return null;
  const steps = [
    { ts: deal.createdAt, label: "OFFER POSTED", color: "bg-[#F0A500]", active: true },
    { ts: deal.acceptedAt, label: "ACCEPTED · USDC LOCKED", color: "bg-[#93C5FD]", active: deal.acceptedAt > 0 },
    { ts: deal.deliveredAt, label: "DELIVERY SUBMITTED", color: "bg-[#C084FC]", active: deal.deliveredAt > 0 },
    { ts: deal.completedAt, label: deal.status === "Refunded" ? "REFUNDED" : "COMPLETED · USDC RELEASED", color: deal.status === "Refunded" ? "bg-[#EF4444]" : "bg-[#22C55E]", active: deal.completedAt > 0 },
  ];

  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-0 bottom-0 w-px bg-[#1C2230]" />
      <div className="space-y-0">
        {steps.map((s, i) => (
          <div key={i} className="relative flex items-start gap-4 pb-6 last:pb-0">
            <div
              className={`absolute -left-4 mt-1 w-2.5 h-2.5 rounded-full border-2 border-[#050608] ${
                s.active ? s.color : "bg-[#1C2230]"
              }`}
            />
            <div className={s.active ? "" : "opacity-30"}>
              <div className="font-mono text-[10px] tracking-widest text-[#3A4558] mb-0.5">
                {s.label}
              </div>
              {s.active && s.ts > 0 && (
                <div className="font-mono text-xs text-[#7B8EA8]">
                  {timeAgo(s.ts)} ·{" "}
                  {new Date(s.ts * 1000).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              )}
              {!s.active && (
                <div className="font-mono text-[10px] text-[#3A4558]">PENDING</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deal = await getDeal(Number(id));
  if (!deal) notFound();

  let taskData: Record<string, string> = {};
  try {
    const raw = deal.taskURI.replace("data:application/json,", "");
    taskData = JSON.parse(raw);
  } catch {}

  let deliveryData: Record<string, string> = {};
  try {
    const raw = deal.deliveryURI.replace("data:application/json,", "");
    deliveryData = JSON.parse(raw);
  } catch {}

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 font-mono text-xs text-[#3A4558] mb-8">
        <Link href="/" className="hover:text-[#F0A500] transition-colors">
          MARKETPLACE
        </Link>
        <span>/</span>
        <span className="text-[#7B8EA8]">DEAL #{deal.id}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-mono text-2xl font-bold text-[#E8EFF8] mb-2">
            {deal.taskTitle || `Deal #${deal.id}`}
          </h1>
          <div className="flex items-center gap-3">
            <StatusBadge status={deal.status} />
            <span className="font-mono text-xs text-[#3A4558]">
              Posted {timeAgo(deal.createdAt)}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-xs text-[#3A4558] mb-1">DEAL VALUE</div>
          <div className="font-mono text-3xl font-bold text-[#F0A500]">
            ${deal.price}
          </div>
          <div className="font-mono text-[10px] text-[#3A4558] mt-1">USDC</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* Left column */}
        <div className="space-y-4">
          {/* Parties */}
          <div className="border border-[#1C2230] bg-[#0A0C11]">
            <div className="px-5 py-3 border-b border-[#1C2230]">
              <span className="font-mono text-[10px] text-[#3A4558] tracking-widest">
                PARTIES
              </span>
            </div>
            <div className="px-5 py-1">
              <Row
                label="WORKER"
                value={
                  <a
                    href={`https://sepolia.basescan.org/address/${deal.worker}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#7B8EA8] hover:text-[#F0A500] transition-colors"
                  >
                    {deal.worker || "—"}
                  </a>
                }
              />
              <Row
                label="CLIENT"
                value={
                  <a
                    href={`https://sepolia.basescan.org/address/${deal.client}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#7B8EA8] hover:text-[#F0A500] transition-colors"
                  >
                    {deal.client && deal.client !== "0x0000000000000000000000000000000000000000"
                      ? deal.client
                      : "—"}
                  </a>
                }
              />
              <Row label="DEADLINE" value={formatDeadline(deal.deadline)} />
            </div>
          </div>

          {/* Task */}
          <div className="border border-[#1C2230] bg-[#0A0C11]">
            <div className="px-5 py-3 border-b border-[#1C2230]">
              <span className="font-mono text-[10px] text-[#3A4558] tracking-widest">
                TASK SPECIFICATION
              </span>
            </div>
            <div className="px-5 py-1">
              {Object.keys(taskData).length > 0 ? (
                Object.entries(taskData).map(([k, v]) => (
                  <Row key={k} label={k.toUpperCase()} value={String(v)} mono={false} />
                ))
              ) : (
                <Row label="RAW URI" value={deal.taskURI || "—"} />
              )}
              <Row
                label="TASK HASH"
                value={
                  <span className="text-[#3A4558] break-all">{deal.taskHash}</span>
                }
              />
            </div>
          </div>

          {/* Delivery */}
          {deal.deliveredAt > 0 && (
            <>
              <DeliverablePreview deliveryURI={deal.deliveryURI} />
              <div className="border border-[#1C2230] bg-[#0A0C11]">
                <div className="px-5 py-3 border-b border-[#1C2230]">
                  <span className="font-mono text-[10px] text-[#3A4558] tracking-widest">
                    DELIVERY PROOF
                  </span>
                </div>
                <div className="px-5 py-1">
                  <Row
                    label="DELIVERY HASH"
                    value={
                      <span className="text-[#3A4558] break-all">{deal.deliveryHash}</span>
                    }
                  />
                </div>
              </div>
            </>
          )}

          {/* ERC-8004 Identities */}
          {(deal.erc8004WorkerIdentity || deal.erc8004ClientIdentity) && (
            <div className="border border-[rgba(240,165,0,0.2)] bg-[rgba(240,165,0,0.03)]">
              <div className="px-5 py-3 border-b border-[rgba(240,165,0,0.2)]">
                <span className="font-mono text-[10px] text-[#F0A500] tracking-widest">
                  ERC-8004 IDENTITIES
                </span>
              </div>
              <div className="px-5 py-1">
                {deal.erc8004WorkerIdentity && (
                  <Row label="WORKER ID" value={deal.erc8004WorkerIdentity} />
                )}
                {deal.erc8004ClientIdentity && (
                  <Row label="CLIENT ID" value={deal.erc8004ClientIdentity} />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right column — timeline + links */}
        <div className="space-y-4">
          {/* Confirm Delivery (manual mode, client only) */}
          {deal.status === "Delivered" && deal.client && (
            <ConfirmDeliveryButton dealId={deal.id} clientAddress={deal.client} />
          )}

          {/* Uniswap swap badge (show once accepted) */}
          {deal.acceptedAt > 0 && (
            <SwapBadge dealId={deal.id} usdcPrice={deal.price} />
          )}
          <div className="border border-[#1C2230] bg-[#0A0C11]">
            <div className="px-5 py-3 border-b border-[#1C2230]">
              <span className="font-mono text-[10px] text-[#3A4558] tracking-widest">
                LIFECYCLE
              </span>
            </div>
            <div className="px-5 py-5">
              <Timeline deal={deal} />
            </div>
          </div>

          <div className="border border-[#1C2230] bg-[#0A0C11]">
            <div className="px-5 py-3 border-b border-[#1C2230]">
              <span className="font-mono text-[10px] text-[#3A4558] tracking-widest">
                ON-CHAIN
              </span>
            </div>
            <div className="px-5 py-4 space-y-3">
              <a
                href={`https://sepolia.basescan.org/address/0x82f618d57E52BFFa84f4Bb4c398465FAe6f9d4B9`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between group"
              >
                <span className="font-mono text-[10px] text-[#3A4558] tracking-wide">
                  CONTRACT
                </span>
                <span className="font-mono text-[10px] text-[#7B8EA8] group-hover:text-[#F0A500] transition-colors">
                  0x82f6…d4B9 ↗
                </span>
              </a>
              <a
                href={`https://sepolia.basescan.org/address/${deal.worker}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between group"
              >
                <span className="font-mono text-[10px] text-[#3A4558] tracking-wide">
                  WORKER WALLET
                </span>
                <span className="font-mono text-[10px] text-[#7B8EA8] group-hover:text-[#F0A500] transition-colors">
                  {truncate(deal.worker)} ↗
                </span>
              </a>
              {deal.client && deal.client !== "0x0000000000000000000000000000000000000000" && (
                <a
                  href={`https://sepolia.basescan.org/address/${deal.client}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between group"
                >
                  <span className="font-mono text-[10px] text-[#3A4558] tracking-wide">
                    CLIENT WALLET
                  </span>
                  <span className="font-mono text-[10px] text-[#7B8EA8] group-hover:text-[#F0A500] transition-colors">
                    {truncate(deal.client)} ↗
                  </span>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
