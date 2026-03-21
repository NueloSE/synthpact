import type { DealStatus } from "@/lib/contract";

const CONFIG: Record<DealStatus, { dot: string; text: string; bg: string; border: string }> = {
  Open:      { dot: "bg-[#F0A500] pulse-amber", text: "text-[#F0A500]", bg: "bg-[rgba(240,165,0,0.08)]", border: "border-[rgba(240,165,0,0.3)]" },
  Accepted:  { dot: "bg-[#93C5FD]",             text: "text-[#93C5FD]", bg: "bg-[rgba(147,197,253,0.08)]", border: "border-[rgba(147,197,253,0.3)]" },
  Delivered: { dot: "bg-[#C084FC]",             text: "text-[#C084FC]", bg: "bg-[rgba(192,132,252,0.08)]", border: "border-[rgba(192,132,252,0.3)]" },
  Completed: { dot: "bg-[#22C55E] pulse-green", text: "text-[#22C55E]", bg: "bg-[rgba(34,197,94,0.08)]",  border: "border-[rgba(34,197,94,0.3)]"  },
  Refunded:  { dot: "bg-[#EF4444]",             text: "text-[#EF4444]", bg: "bg-[rgba(239,68,68,0.08)]",  border: "border-[rgba(239,68,68,0.3)]"  },
  Cancelled: { dot: "bg-[#3A4558]",             text: "text-[#3A4558]", bg: "bg-[rgba(58,69,88,0.08)]",   border: "border-[rgba(58,69,88,0.3)]"   },
};

export default function StatusBadge({ status }: { status: DealStatus }) {
  const c = CONFIG[status] ?? CONFIG.Cancelled;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-mono tracking-wide ${c.bg} ${c.border} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
      {status.toUpperCase()}
    </span>
  );
}
