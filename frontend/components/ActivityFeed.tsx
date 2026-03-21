"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Deal, truncate, timeAgo } from "@/lib/contract";

interface Event {
  key: string;
  dealId: number;
  taskTitle: string;
  type: "posted" | "accepted" | "delivered" | "completed" | "refunded";
  ts: number;
  actor: string;
}

function buildEvents(deals: Deal[]): Event[] {
  const events: Event[] = [];
  for (const d of deals) {
    const title = d.taskTitle || `Deal #${d.id}`;
    if (d.createdAt > 0)
      events.push({ key: `${d.id}-posted`, dealId: d.id, taskTitle: title, type: "posted", ts: d.createdAt, actor: d.worker });
    if (d.acceptedAt > 0)
      events.push({ key: `${d.id}-accepted`, dealId: d.id, taskTitle: title, type: "accepted", ts: d.acceptedAt, actor: d.client });
    if (d.deliveredAt > 0)
      events.push({ key: `${d.id}-delivered`, dealId: d.id, taskTitle: title, type: "delivered", ts: d.deliveredAt, actor: d.worker });
    if (d.completedAt > 0) {
      const isRefund = d.status === "Refunded";
      events.push({ key: `${d.id}-completed`, dealId: d.id, taskTitle: title, type: isRefund ? "refunded" : "completed", ts: d.completedAt, actor: d.client });
    }
  }
  return events.sort((a, b) => b.ts - a.ts).slice(0, 20);
}

const EVENT_CONFIG = {
  posted:    { label: "OFFER POSTED",        dot: "bg-[#F0A500]",  text: "text-[#F0A500]",  actorLabel: "WORKER" },
  accepted:  { label: "ACCEPTED · USDC LOCKED", dot: "bg-[#93C5FD]", text: "text-[#93C5FD]", actorLabel: "CLIENT" },
  delivered: { label: "DELIVERY SUBMITTED",  dot: "bg-[#C084FC]", text: "text-[#C084FC]",  actorLabel: "WORKER" },
  completed: { label: "COMPLETED · PAID",    dot: "bg-[#22C55E]", text: "text-[#22C55E]",  actorLabel: "CLIENT" },
  refunded:  { label: "REFUNDED",            dot: "bg-[#EF4444]", text: "text-[#EF4444]",  actorLabel: "CLIENT" },
};

export default function ActivityFeed() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeys, setNewKeys] = useState<Set<string>>(new Set());

  const fetchDeals = useCallback(async (isFirst = false) => {
    try {
      const res = await fetch("/api/deals", { cache: "no-store" });
      if (!res.ok) return;
      const deals: Deal[] = await res.json();
      const next = buildEvents(deals);

      if (!isFirst) {
        setEvents((prev) => {
          const prevKeys = new Set(prev.map((e) => e.key));
          const fresh = next.filter((e) => !prevKeys.has(e.key)).map((e) => e.key);
          if (fresh.length > 0) setNewKeys(new Set(fresh));
          return next;
        });
      } else {
        setEvents(next);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeals(true);
    const id = setInterval(() => fetchDeals(false), 10_000);
    return () => clearInterval(id);
  }, [fetchDeals]);

  // Clear highlight after 3s
  useEffect(() => {
    if (newKeys.size === 0) return;
    const t = setTimeout(() => setNewKeys(new Set()), 3000);
    return () => clearTimeout(t);
  }, [newKeys]);

  return (
    <div className="border border-[#1C2230] bg-[#0A0C11]">
      <div className="px-5 py-3 border-b border-[#1C2230] flex items-center justify-between">
        <span className="font-mono text-[10px] text-[#3A4558] tracking-widest">
          LIVE ACTIVITY
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] pulse-green" />
          <span className="font-mono text-[10px] text-[#3A4558]">POLLING 10s</span>
        </span>
      </div>

      <div className="divide-y divide-[#0F1219] max-h-[480px] overflow-y-auto">
        {loading && (
          <div className="px-5 py-4 font-mono text-[10px] text-[#3A4558]">LOADING…</div>
        )}
        {!loading && events.length === 0 && (
          <div className="px-5 py-4 font-mono text-[10px] text-[#3A4558]">NO ACTIVITY YET</div>
        )}
        {events.map((ev) => {
          const cfg = EVENT_CONFIG[ev.type];
          const isNew = newKeys.has(ev.key);
          return (
            <Link
              key={ev.key}
              href={`/deal/${ev.dealId}`}
              className={`flex items-start gap-3 px-5 py-3 hover:bg-[#0F1219] transition-all group ${
                isNew ? "bg-[rgba(240,165,0,0.04)]" : ""
              }`}
            >
              {/* Dot */}
              <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-mono text-[10px] tracking-widest ${cfg.text}`}>
                    {cfg.label}
                  </span>
                  <span className="font-mono text-[10px] text-[#3A4558]">
                    DEAL #{ev.dealId}
                  </span>
                  {isNew && (
                    <span className="font-mono text-[9px] px-1.5 py-0.5 bg-[rgba(240,165,0,0.12)] text-[#F0A500] tracking-widest">
                      NEW
                    </span>
                  )}
                </div>
                <div className="font-mono text-xs text-[#E8EFF8] mt-0.5 truncate group-hover:text-[#F0A500] transition-colors">
                  {ev.taskTitle}
                </div>
                <div className="font-mono text-[10px] text-[#3A4558] mt-0.5">
                  {cfg.actorLabel}: {truncate(ev.actor)} · {timeAgo(ev.ts)}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
