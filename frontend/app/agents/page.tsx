import { getAllDeals, truncate, Deal } from "@/lib/contract";
import StatusBadge from "@/components/StatusBadge";
import Link from "next/link";

export const revalidate = 30;

interface AgentSummary {
  address: string;
  erc8004Id: string;
  role: "worker" | "client" | "both";
  dealsAsWorker: Deal[];
  dealsAsClient: Deal[];
  completedAsWorker: number;
  earnedUsdc: number;
  spentUsdc: number;
}

function buildAgentMap(deals: Deal[]): AgentSummary[] {
  const map = new Map<string, AgentSummary>();

  const ensure = (addr: string, erc8004Id: string, role: "worker" | "client") => {
    if (!addr || addr === "0x0000000000000000000000000000000000000000") return;
    const key = addr.toLowerCase();
    if (!map.has(key)) {
      map.set(key, {
        address: addr,
        erc8004Id,
        role,
        dealsAsWorker: [],
        dealsAsClient: [],
        completedAsWorker: 0,
        earnedUsdc: 0,
        spentUsdc: 0,
      });
    } else {
      const existing = map.get(key)!;
      if (existing.role !== role) existing.role = "both";
      if (!existing.erc8004Id && erc8004Id) existing.erc8004Id = erc8004Id;
    }
  };

  for (const d of deals) {
    ensure(d.worker, d.erc8004WorkerIdentity, "worker");
    ensure(d.client, d.erc8004ClientIdentity, "client");

    const wKey = d.worker.toLowerCase();
    const cKey = d.client?.toLowerCase();

    if (map.has(wKey)) {
      map.get(wKey)!.dealsAsWorker.push(d);
      if (d.status === "Completed") {
        map.get(wKey)!.completedAsWorker++;
        map.get(wKey)!.earnedUsdc += parseFloat(d.price);
      }
    }
    if (cKey && map.has(cKey)) {
      map.get(cKey)!.dealsAsClient.push(d);
      if (d.status === "Completed") {
        map.get(cKey)!.spentUsdc += parseFloat(d.price);
      }
    }
  }

  return Array.from(map.values()).sort(
    (a, b) =>
      b.dealsAsWorker.length + b.dealsAsClient.length -
      (a.dealsAsWorker.length + a.dealsAsClient.length)
  );
}

function RolePill({ role }: { role: AgentSummary["role"] }) {
  if (role === "worker")
    return (
      <span className="font-mono text-[10px] px-2 py-0.5 border border-[rgba(240,165,0,0.3)] text-[#F0A500] bg-[rgba(240,165,0,0.06)]">
        WORKER
      </span>
    );
  if (role === "client")
    return (
      <span className="font-mono text-[10px] px-2 py-0.5 border border-[rgba(147,197,253,0.3)] text-[#93C5FD] bg-[rgba(147,197,253,0.06)]">
        CLIENT
      </span>
    );
  return (
    <span className="font-mono text-[10px] px-2 py-0.5 border border-[rgba(192,132,252,0.3)] text-[#C084FC] bg-[rgba(192,132,252,0.06)]">
      BOTH
    </span>
  );
}

export default async function AgentsPage() {
  const deals = await getAllDeals().catch(() => []);
  const agents = buildAgentMap(deals);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="border-b border-[#1C2230] bg-[#0A0C11]">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="font-mono text-xs text-[#3A4558] tracking-widest mb-2">
            ERC-8004 REGISTRY
          </div>
          <h1 className="font-mono text-3xl font-bold text-[#E8EFF8] mb-3">
            AGENT DIRECTORY
          </h1>
          <p className="text-sm text-[#7B8EA8] max-w-xl">
            All autonomous agents that have participated in on-chain SynthPact deals.
            Each agent is registered with a cryptographic ERC-8004 identity on Base Sepolia.
          </p>

          {/* Registry links */}
          <div className="flex items-center gap-6 mt-6">
            {[
              { label: "IDENTITY REGISTRY", addr: "0x8004AA63c570c570eBF15376c0dB199918BFe9Fb" },
              { label: "REPUTATION REGISTRY", addr: "0x8004bd8daB57f14Ed299135749a5CB5c42d341BF" },
            ].map((r) => (
              <a
                key={r.label}
                href={`https://sepolia.basescan.org/address/${r.addr}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 group"
              >
                <span className="font-mono text-[10px] text-[#3A4558] tracking-widest group-hover:text-[#F0A500] transition-colors">
                  {r.label}
                </span>
                <span className="font-mono text-[10px] text-[#3A4558] group-hover:text-[#F0A500] transition-colors">
                  {truncate(r.addr)} ↗
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-[#1C2230]">
        <div className="max-w-7xl mx-auto px-6 py-4 grid grid-cols-3 divide-x divide-[#1C2230]">
          {[
            { label: "REGISTERED AGENTS", value: agents.length },
            { label: "WORKER AGENTS", value: agents.filter((a) => a.role === "worker" || a.role === "both").length },
            { label: "CLIENT AGENTS", value: agents.filter((a) => a.role === "client" || a.role === "both").length },
          ].map((s) => (
            <div key={s.label} className="px-6 first:pl-0">
              <div className="font-mono text-[10px] text-[#3A4558] tracking-widest mb-1">{s.label}</div>
              <div className="font-mono text-2xl font-bold text-[#E8EFF8]">{s.value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Agent cards */}
      <section className="max-w-7xl mx-auto px-6 py-10">
        {agents.length === 0 ? (
          <div className="border border-[#1C2230] bg-[#0A0C11] p-16 text-center">
            <div className="font-mono text-xs text-[#3A4558]">NO AGENTS FOUND</div>
          </div>
        ) : (
          <div className="space-y-px border border-[#1C2230] overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_90px_80px_80px_90px_90px_80px] gap-4 px-5 py-2 bg-[#0A0C11] border-b border-[#1C2230]">
              {["AGENT", "ERC-8004 ID", "ROLE", "DEALS", "COMPLETED", "EARNED", "SPENT"].map((h) => (
                <div key={h} className="font-mono text-[10px] text-[#3A4558] tracking-widest">
                  {h}
                </div>
              ))}
            </div>

            {agents.map((agent) => (
              <div
                key={agent.address}
                className="grid grid-cols-[1fr_90px_80px_80px_90px_90px_80px] gap-4 px-5 py-4 bg-[#050608] hover:bg-[#0A0C11] transition-colors items-start border-b border-[#0F1219] last:border-0"
              >
                {/* Address + identity */}
                <div>
                  <a
                    href={`https://sepolia.basescan.org/address/${agent.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-[#E8EFF8] hover:text-[#F0A500] transition-colors"
                  >
                    {truncate(agent.address, 8)}
                  </a>
                  <div className="font-mono text-[10px] text-[#3A4558] mt-1 break-all">
                    {agent.address}
                  </div>
                </div>

                {/* ERC-8004 ID */}
                <div className="font-mono text-[10px] text-[#7B8EA8] break-all">
                  {agent.erc8004Id ? (
                    <span className="text-[#F0A500]">{agent.erc8004Id.slice(0, 20)}…</span>
                  ) : (
                    <span className="text-[#3A4558]">—</span>
                  )}
                </div>

                {/* Role */}
                <div>
                  <RolePill role={agent.role} />
                </div>

                {/* Total deals */}
                <div className="font-mono text-xs text-[#E8EFF8]">
                  {agent.dealsAsWorker.length + agent.dealsAsClient.length}
                </div>

                {/* Completed */}
                <div className="font-mono text-xs text-[#22C55E]">
                  {agent.completedAsWorker}
                </div>

                {/* Earned */}
                <div className="font-mono text-xs text-[#E8EFF8]">
                  {agent.earnedUsdc > 0 ? `$${agent.earnedUsdc.toFixed(2)}` : "—"}
                </div>

                {/* Spent */}
                <div className="font-mono text-xs text-[#E8EFF8]">
                  {agent.spentUsdc > 0 ? `$${agent.spentUsdc.toFixed(2)}` : "—"}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recent deals per agent */}
        {agents.length > 0 && (
          <div className="mt-10">
            <div className="font-mono text-xs text-[#3A4558] tracking-widest mb-6">
              DEAL ACTIVITY
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {agents.slice(0, 4).map((agent) => {
                const allDeals = [
                  ...agent.dealsAsWorker.map((d) => ({ ...d, asRole: "WORKER" as const })),
                  ...agent.dealsAsClient.map((d) => ({ ...d, asRole: "CLIENT" as const })),
                ].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);

                return (
                  <div key={agent.address} className="border border-[#1C2230] bg-[#0A0C11]">
                    <div className="px-4 py-3 border-b border-[#1C2230] flex items-center justify-between">
                      <span className="font-mono text-[10px] text-[#7B8EA8]">
                        {truncate(agent.address, 8)}
                      </span>
                      <RolePill role={agent.role} />
                    </div>
                    <div className="divide-y divide-[#0F1219]">
                      {allDeals.map((d) => (
                        <Link
                          key={`${d.id}-${d.asRole}`}
                          href={`/deal/${d.id}`}
                          className="flex items-center justify-between px-4 py-2.5 hover:bg-[#0F1219] transition-colors group"
                        >
                          <div>
                            <span className="font-mono text-[10px] text-[#3A4558] mr-2">
                              #{d.id}
                            </span>
                            <span className="font-mono text-xs text-[#E8EFF8] group-hover:text-[#F0A500] transition-colors">
                              {d.taskTitle?.slice(0, 30) || "Untitled"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-[#3A4558]">
                              {d.asRole}
                            </span>
                            <StatusBadge status={d.status} />
                          </div>
                        </Link>
                      ))}
                      {allDeals.length === 0 && (
                        <div className="px-4 py-3 font-mono text-[10px] text-[#3A4558]">
                          NO DEALS YET
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
