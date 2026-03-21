import { createPublicClient, http, formatUnits } from "viem";
import { baseSepolia } from "viem/chains";

export const client = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"),
});

export const REPUTATION_CONTRACT = "0x149D16EE14977BAF96EAd7e754b0C6842a763BB0" as `0x${string}`;
export const IDENTITY_REGISTRY   = "0x8004AA63c570c570eBF15376c0dB199918BFe9Fb" as `0x${string}`;

export const REPUTATION_ABI = [
  {
    name: "getScore",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "worker", type: "address" }],
    outputs: [
      { name: "avg", type: "uint8" },
      { name: "count", type: "uint256" },
    ],
  },
  {
    name: "getFeedback",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "worker", type: "address" }],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "client", type: "address" },
          { name: "score", type: "uint8" },
          { name: "dealId", type: "uint256" },
          { name: "comment", type: "string" },
          { name: "timestamp", type: "uint256" },
        ],
      },
    ],
  },
] as const;

export interface AgentReputation {
  address: string;
  score: number | null;
  feedbackCount: number;
}

export interface Feedback {
  client: string;
  score: number;
  dealId: number;
  comment: string;
  timestamp: number;
}

export async function getAgentFeedback(walletAddress: string): Promise<Feedback[]> {
  try {
    const result = await client.readContract({
      address: REPUTATION_CONTRACT,
      abi: REPUTATION_ABI,
      functionName: "getFeedback",
      args: [walletAddress as `0x${string}`],
    }) as Array<{ client: string; score: number; dealId: bigint; comment: string; timestamp: bigint }>;

    return result.map((f) => ({
      client: f.client,
      score: f.score,
      dealId: Number(f.dealId),
      comment: f.comment,
      timestamp: Number(f.timestamp),
    }));
  } catch {
    return [];
  }
}

export async function getAgentReputation(walletAddress: string): Promise<AgentReputation> {
  try {
    const result = await client.readContract({
      address: REPUTATION_CONTRACT,
      abi: REPUTATION_ABI,
      functionName: "getScore",
      args: [walletAddress as `0x${string}`],
    }) as [number, bigint];

    const count = Number(result[1]);
    return {
      address: walletAddress,
      score: count > 0 ? result[0] : null,
      feedbackCount: count,
    };
  } catch {
    return { address: walletAddress, score: null, feedbackCount: 0 };
  }
}

export const CONTRACT = "0x82f618d57E52BFFa84f4Bb4c398465FAe6f9d4B9" as `0x${string}`;

export const ABI = [
  {
    name: "getDeal",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "dealId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "worker", type: "address" },
          { name: "client", type: "address" },
          { name: "taskHash", type: "bytes32" },
          { name: "taskURI", type: "string" },
          { name: "price", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "deliveryHash", type: "bytes32" },
          { name: "deliveryURI", type: "string" },
          { name: "status", type: "uint8" },
          { name: "createdAt", type: "uint256" },
          { name: "acceptedAt", type: "uint256" },
          { name: "deliveredAt", type: "uint256" },
          { name: "completedAt", type: "uint256" },
          { name: "erc8004WorkerIdentity", type: "string" },
          { name: "erc8004ClientIdentity", type: "string" },
        ],
      },
    ],
  },
  {
    name: "dealCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getOpenDeals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256[]" }],
  },
] as const;

export const STATUS = ["Open", "Accepted", "Delivered", "Completed", "Refunded", "Cancelled"] as const;
export type DealStatus = typeof STATUS[number];

export interface Deal {
  id: number;
  worker: string;
  client: string;
  taskURI: string;
  taskHash: string;
  price: string;
  deadline: number;
  deliveryHash: string;
  deliveryURI: string;
  status: DealStatus;
  statusIndex: number;
  createdAt: number;
  acceptedAt: number;
  deliveredAt: number;
  completedAt: number;
  erc8004WorkerIdentity: string;
  erc8004ClientIdentity: string;
  taskTitle?: string;
}

function parseTaskURI(uri: string): string {
  try {
    const raw = uri.replace("data:application/json,", "");
    const parsed = JSON.parse(raw);
    return parsed.title || parsed.description?.slice(0, 60) || "Unnamed task";
  } catch {
    return "Unnamed task";
  }
}

function parseDeal(raw: any, id: number): Deal {
  return {
    id,
    worker: raw.worker as string,
    client: raw.client as string,
    taskURI: raw.taskURI as string,
    taskHash: raw.taskHash as string,
    price: formatUnits(raw.price as bigint, 6),
    deadline: Number(raw.deadline),
    deliveryHash: raw.deliveryHash as string,
    deliveryURI: raw.deliveryURI as string,
    status: STATUS[raw.status as number] ?? "Open",
    statusIndex: raw.status as number,
    createdAt: Number(raw.createdAt),
    acceptedAt: Number(raw.acceptedAt),
    deliveredAt: Number(raw.deliveredAt),
    completedAt: Number(raw.completedAt),
    erc8004WorkerIdentity: raw.erc8004WorkerIdentity as string,
    erc8004ClientIdentity: raw.erc8004ClientIdentity as string,
    taskTitle: parseTaskURI(raw.taskURI as string),
  };
}

export async function getAllDeals(): Promise<Deal[]> {
  const count = await client.readContract({ address: CONTRACT, abi: ABI, functionName: "dealCount" });
  const total = Number(count);
  if (total === 0) return [];

  const results = await Promise.all(
    Array.from({ length: total }, (_, i) =>
      client.readContract({ address: CONTRACT, abi: ABI, functionName: "getDeal", args: [BigInt(i + 1)] })
    )
  );
  return results.map((r, i) => parseDeal(r, i + 1));
}

export async function getDeal(id: number): Promise<Deal | null> {
  try {
    const raw = await client.readContract({ address: CONTRACT, abi: ABI, functionName: "getDeal", args: [BigInt(id)] });
    return parseDeal(raw, id);
  } catch {
    return null;
  }
}

export function truncate(addr: string, chars = 6): string {
  if (!addr || addr === "0x0000000000000000000000000000000000000000") return "—";
  return `${addr.slice(0, chars)}…${addr.slice(-4)}`;
}

export function timeAgo(ts: number): string {
  if (!ts) return "—";
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function formatDeadline(ts: number): string {
  if (!ts) return "—";
  const diff = ts - Math.floor(Date.now() / 1000);
  if (diff < 0) return "Expired";
  if (diff < 3600) return `${Math.floor(diff / 60)}m left`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h left`;
  return `${Math.floor(diff / 86400)}d left`;
}
