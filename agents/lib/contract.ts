import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// ─── Provider + Wallets ─────────────────────────────────────────────────────

export const provider      = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL!);
export const wallet        = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);        // worker
export const clientWallet  = new ethers.Wallet(process.env.CLIENT_PRIVATE_KEY!, provider); // client

// ─── SynthPact ABI ──────────────────────────────────────────────────────────

export const SYNTHPACT_ABI = [
  "function postOffer(bytes32 taskHash, string taskURI, uint256 price, uint256 deadline, string erc8004Id) returns (uint256)",
  "function acceptOffer(uint256 dealId, address tokenIn, uint256 amountIn, string erc8004Id) payable",
  "function submitDelivery(uint256 dealId, bytes32 deliveryHash, string deliveryURI)",
  "function confirmDelivery(uint256 dealId)",
  "function claimRefund(uint256 dealId)",
  "function cancelOffer(uint256 dealId)",
  "function getDeal(uint256 dealId) view returns (tuple(uint256 id, address worker, address client, bytes32 taskHash, string taskURI, uint256 price, uint256 deadline, bytes32 deliveryHash, string deliveryURI, uint8 status, uint256 createdAt, uint256 acceptedAt, uint256 deliveredAt, uint256 completedAt, string erc8004WorkerIdentity, string erc8004ClientIdentity))",
  "function getOpenDeals() view returns (uint256[])",
  "function dealCount() view returns (uint256)",
  "event DealPosted(uint256 indexed dealId, address indexed worker, bytes32 taskHash, string taskURI, uint256 price, uint256 deadline, string erc8004Identity)",
  "event DealAccepted(uint256 indexed dealId, address indexed client, uint256 usdcLocked, string erc8004Identity)",
  "event DeliverySubmitted(uint256 indexed dealId, address indexed worker, bytes32 deliveryHash, string deliveryURI)",
  "event DealCompleted(uint256 indexed dealId, address indexed worker, uint256 usdcPaid)",
];

export const USDC_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

// ─── ERC-8004 Identity Registry ABI (correct — erc-8004/erc-8004-contracts) ──

export const IDENTITY_REGISTRY_ABI = [
  // register with a metadata URI, returns sequential agentId (uint256)
  "function register(string agentURI) returns (uint256 agentId)",
  // getters
  "function getMetadata(uint256 agentId, string metadataKey) view returns (bytes)",
  "function getAgentWallet(uint256 agentId) view returns (address)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function getVersion() view returns (string)",
  "event Registered(uint256 indexed agentId, address indexed owner)",
];

export const REPUTATION_REGISTRY_ABI = [
  // submit feedback — value is int128 with valueDecimals decimal places
  // e.g. score 95/100 → value=95, valueDecimals=0
  "function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash) returns (uint256 feedbackIndex)",
  // read feedback summary for an agent
  "function getSummary(uint256 agentId, address[] clientAddresses, string tag1, string tag2) view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)",
  "function readFeedback(uint256 agentId, address clientAddress, uint64 feedbackIndex) view returns (int128 value, uint8 valueDecimals, string tag1, string tag2, bool isRevoked)",
  "function getClients(uint256 agentId) view returns (address[])",
  "function getIdentityRegistry() view returns (address)",
  "function getVersion() view returns (string)",
  "event NewFeedback(uint256 indexed agentId, address indexed clientAddress, uint64 feedbackIndex, int128 value, uint8 valueDecimals)",
];

// ─── Contract instances ──────────────────────────────────────────────────────

type Signer = ethers.Wallet;

export function getSynthPact(signer: Signer = wallet) {
  return new ethers.Contract(process.env.SYNTHPACT_CONTRACT_ADDRESS!, SYNTHPACT_ABI, signer);
}

export function getUSDC(signer: Signer = wallet) {
  return new ethers.Contract(
    "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC on Base Sepolia
    USDC_ABI,
    signer
  );
}

export function getIdentityRegistry(signer: Signer = wallet) {
  return new ethers.Contract(process.env.ERC8004_IDENTITY_REGISTRY!, IDENTITY_REGISTRY_ABI, signer);
}

export function getReputationRegistry(signer: Signer = wallet) {
  return new ethers.Contract(process.env.ERC8004_REPUTATION_REGISTRY!, REPUTATION_REGISTRY_ABI, signer);
}

// ─── Deal status enum ────────────────────────────────────────────────────────

export enum DealStatus {
  Open = 0,
  Accepted = 1,
  Delivered = 2,
  Completed = 3,
  Refunded = 4,
  Cancelled = 5,
}

export const STATUS_LABELS = ["Open", "Accepted", "Delivered", "Completed", "Refunded", "Cancelled"];

// ─── Agent log ───────────────────────────────────────────────────────────────

const LOG_PATH = path.resolve(__dirname, "../../agent_log.json");

export function appendLog(entry: object) {
  let log: object[] = [];
  if (fs.existsSync(LOG_PATH)) {
    log = JSON.parse(fs.readFileSync(LOG_PATH, "utf8"));
  }
  log.push({ timestamp: new Date().toISOString(), ...entry });
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export function formatUSDC(amount: bigint): string {
  return `${(Number(amount) / 1e6).toFixed(2)} USDC`;
}
