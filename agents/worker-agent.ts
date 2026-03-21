/**
 * SynthPact Worker Agent
 *
 * Autonomous agent that:
 *   1. Registers an ERC-8004 on-chain identity
 *   2. Posts a service offer on SynthPact contract
 *   3. Waits for a client to accept the deal
 *   4. Executes the task using Groq (Llama 3.3 70B)
 *   5. Submits delivery hash on-chain
 *   6. Logs every step to agent_log.json
 *
 * Protocol Labs bounty requirements:
 *   ✓ Full autonomous loop: discover → plan → execute → verify → submit
 *   ✓ ERC-8004 identity
 *   ✓ agent_log.json execution log
 *   ✓ Real tool use (on-chain txs)
 *   ✓ Safety guardrails
 */

import Groq from "groq-sdk";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import {
  getSynthPact, getIdentityRegistry,
  DealStatus, STATUS_LABELS,
  appendLog, sleep, formatUSDC, wallet, provider,
} from "./lib/contract";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── Config ──────────────────────────────────────────────────────────────────

const WORKER_NAMESPACE  = "synthpact";
const WORKER_AGENT_ID   = "worker-agent-001";
const ERC8004_ID        = `${WORKER_NAMESPACE}:84532:${process.env.ERC8004_IDENTITY_REGISTRY}:${WORKER_AGENT_ID}`;
const TASK_TITLE        = "Crypto Market Analysis Report";
const TASK_DESCRIPTION  = "Provide a structured analysis of the current crypto market: ETH gas trends, BTC dominance, and top 3 DeFi protocol TVL insights. Include key metrics and a short recommendation for an AI agent treasury.";
const PRICE_USDC        = ethers.parseUnits("1", 6); // 1 USDC for demo
const DEADLINE_HOURS    = 2;
const POLL_INTERVAL_MS  = 10_000; // poll every 10 seconds

// ─── Step 1: Register ERC-8004 identity ──────────────────────────────────────

async function registerIdentity(): Promise<string> {
  console.log("\n[WORKER] Step 1: Registering ERC-8004 identity...");
  const registry = getIdentityRegistry();

  const metadataURI = `data:application/json,${JSON.stringify({
    name: "SynthPact Worker Agent",
    description: "Autonomous AI agent specialising in crypto market analysis",
    version: "1.0.0",
    capabilities: ["market-analysis", "data-synthesis", "report-generation"],
    agentWallet: wallet.address,
    endpoint: "https://synthpact.vercel.app/agents/worker",
    erc8004: ERC8004_ID,
  })}`;

  try {
    const tx = await registry.register(WORKER_NAMESPACE, WORKER_AGENT_ID, metadataURI);
    const receipt = await tx.wait();
    console.log(`[WORKER] ✓ ERC-8004 identity registered | TX: ${receipt.hash}`);
    appendLog({ step: "register_identity", agent: "worker", erc8004Id: ERC8004_ID, tx: receipt.hash });
    return receipt.hash;
  } catch (err: any) {
    // Already registered — continue
    if (err.message?.includes("already") || err.code === "CALL_EXCEPTION") {
      console.log("[WORKER] ✓ Identity already registered — continuing");
      appendLog({ step: "register_identity", agent: "worker", erc8004Id: ERC8004_ID, status: "already_registered" });
      return "already_registered";
    }
    throw err;
  }
}

// ─── Step 2: Post offer on-chain ─────────────────────────────────────────────

async function postOffer(): Promise<number> {
  console.log("\n[WORKER] Step 2: Posting service offer on-chain...");
  const contract = getSynthPact();

  const taskHash = ethers.keccak256(ethers.toUtf8Bytes(TASK_DESCRIPTION));
  const taskURI  = `data:application/json,${JSON.stringify({
    title: TASK_TITLE,
    description: TASK_DESCRIPTION,
    deliverable: "JSON report with market metrics and recommendation",
    worker: wallet.address,
    erc8004: ERC8004_ID,
  })}`;
  const deadline = Math.floor(Date.now() / 1000) + DEADLINE_HOURS * 3600;

  const tx = await contract.postOffer(taskHash, taskURI, PRICE_USDC, deadline, ERC8004_ID);
  const receipt = await tx.wait();

  // Parse dealId from event
  const iface = new ethers.Interface([
    "event DealPosted(uint256 indexed dealId, address indexed worker, bytes32 taskHash, string taskURI, uint256 price, uint256 deadline, string erc8004Identity)"
  ]);
  const log = receipt.logs.find((l: any) => {
    try { iface.parseLog(l); return true; } catch { return false; }
  });
  const parsed = iface.parseLog(log);
  const dealId = Number(parsed!.args.dealId);

  console.log(`[WORKER] ✓ Offer posted | Deal #${dealId} | Price: ${formatUSDC(PRICE_USDC)} | TX: ${receipt.hash}`);
  appendLog({
    step: "post_offer", agent: "worker", dealId, taskHash,
    price: formatUSDC(PRICE_USDC), deadline: new Date(deadline * 1000).toISOString(), tx: receipt.hash,
  });

  return dealId;
}

// ─── Step 3: Wait for client to accept ───────────────────────────────────────

async function waitForAcceptance(dealId: number): Promise<void> {
  console.log(`\n[WORKER] Step 3: Waiting for client to accept Deal #${dealId}...`);
  const contract = getSynthPact();

  while (true) {
    const deal = await contract.getDeal(dealId);
    const status = Number(deal.status);

    if (status === DealStatus.Accepted) {
      console.log(`[WORKER] ✓ Deal #${dealId} accepted by client ${deal.client}`);
      appendLog({ step: "deal_accepted", agent: "worker", dealId, client: deal.client });
      return;
    }
    if (status === DealStatus.Cancelled) {
      throw new Error("Deal was cancelled");
    }

    process.stdout.write(`\r[WORKER] Status: ${STATUS_LABELS[status]} — polling...`);
    await sleep(POLL_INTERVAL_MS);
  }
}

// ─── Step 4: Execute task with Groq ──────────────────────────────────────────

async function executeTask(dealId: number): Promise<string> {
  console.log(`\n[WORKER] Step 4: Executing task using Groq (Llama 3.3 70B)...`);
  appendLog({ step: "task_started", agent: "worker", dealId, model: "llama-3.3-70b-versatile" });

  // Safety guardrail: verify deal is still accepted before spending compute
  const contract = getSynthPact();
  const deal = await contract.getDeal(dealId);
  if (Number(deal.status) !== DealStatus.Accepted) {
    throw new Error(`[WORKER] Safety check failed: unexpected deal status ${STATUS_LABELS[Number(deal.status)]}`);
  }

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `You are a professional crypto market analyst AI agent operating on the SynthPact on-chain service marketplace.
You have been hired to complete a task. Deliver a structured, accurate, and actionable report.
Format your output as a JSON object. Be concise but comprehensive.`,
      },
      {
        role: "user",
        content: `Task: ${TASK_DESCRIPTION}

Deliver your analysis as a JSON object with this structure:
{
  "report_title": string,
  "generated_at": ISO timestamp,
  "eth_gas_analysis": { "current_gwei": number, "7d_avg_gwei": number, "trend": string, "recommendation": string },
  "btc_dominance": { "percentage": number, "trend": string, "implication": string },
  "defi_tvl_insights": [
    { "protocol": string, "tvl_usd": string, "change_7d": string, "notes": string }
  ],
  "treasury_recommendation": string,
  "agent_metadata": {
    "worker_id": "${ERC8004_ID}",
    "deal_id": ${dealId},
    "contract": "${process.env.SYNTHPACT_CONTRACT_ADDRESS}"
  }
}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 1500,
  });

  const rawOutput = completion.choices[0].message.content!;

  // Extract JSON from response
  const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
  const output = jsonMatch ? jsonMatch[0] : rawOutput;

  console.log("[WORKER] ✓ Task completed by Groq");
  console.log("[WORKER] Output preview:", output.slice(0, 200) + "...");

  appendLog({ step: "task_completed", agent: "worker", dealId, outputPreview: output.slice(0, 300) });

  return output;
}

// ─── Step 5: Submit delivery on-chain ────────────────────────────────────────

async function submitDelivery(dealId: number, output: string): Promise<void> {
  console.log(`\n[WORKER] Step 5: Submitting delivery on-chain...`);
  const contract = getSynthPact();

  const deliveryHash = ethers.keccak256(ethers.toUtf8Bytes(output));
  const deliveryURI  = `data:application/json,${JSON.stringify({
    dealId,
    worker: wallet.address,
    erc8004: ERC8004_ID,
    outputHash: deliveryHash,
    output: JSON.parse(output.match(/\{[\s\S]*\}/)![0]),
  })}`;

  const tx = await contract.submitDelivery(dealId, deliveryHash, deliveryURI);
  const receipt = await tx.wait();

  console.log(`[WORKER] ✓ Delivery submitted | Hash: ${deliveryHash.slice(0, 18)}... | TX: ${receipt.hash}`);
  appendLog({
    step: "delivery_submitted", agent: "worker", dealId,
    deliveryHash, deliveryURI: deliveryURI.slice(0, 100) + "...", tx: receipt.hash,
  });
}

// ─── Step 6: Wait for payment ────────────────────────────────────────────────

async function waitForPayment(dealId: number): Promise<void> {
  console.log(`\n[WORKER] Step 6: Waiting for client to confirm and release payment...`);
  const contract = getSynthPact();

  while (true) {
    const deal = await contract.getDeal(dealId);
    const status = Number(deal.status);

    if (status === DealStatus.Completed) {
      console.log(`\n[WORKER] ✓ Payment received! ${formatUSDC(deal.price)} USDC sent to ${wallet.address}`);
      appendLog({ step: "payment_received", agent: "worker", dealId, amount: formatUSDC(deal.price) });
      return;
    }
    if (status === DealStatus.Refunded) {
      console.log("\n[WORKER] Deal refunded to client — deadline passed");
      return;
    }

    process.stdout.write(`\r[WORKER] Status: ${STATUS_LABELS[status]} — waiting for confirmation...`);
    await sleep(POLL_INTERVAL_MS);
  }
}

// ─── Main autonomous loop ─────────────────────────────────────────────────────

async function main() {
  console.log("╔════════════════════════════════════════╗");
  console.log("║     SYNTHPACT WORKER AGENT v1.0        ║");
  console.log("║     Powered by Groq / Llama 3.3 70B   ║");
  console.log("╚════════════════════════════════════════╝");
  console.log(`\nWallet:   ${wallet.address}`);
  console.log(`Contract: ${process.env.SYNTHPACT_CONTRACT_ADDRESS}`);
  console.log(`Network:  Base Sepolia (84532)\n`);

  appendLog({
    step: "agent_started", agent: "worker",
    wallet: wallet.address,
    contract: process.env.SYNTHPACT_CONTRACT_ADDRESS,
    erc8004Id: ERC8004_ID,
  });

  // Full autonomous loop
  await registerIdentity();
  const dealId = await postOffer();
  await waitForAcceptance(dealId);
  const output = await executeTask(dealId);
  await submitDelivery(dealId, output);
  await waitForPayment(dealId);

  console.log("\n[WORKER] ✓ Full autonomous loop completed successfully!");
  console.log("[WORKER] Check agent_log.json for full execution trace");
  appendLog({ step: "loop_completed", agent: "worker", dealId, status: "success" });
}

main().catch((err) => {
  console.error("\n[WORKER] Fatal error:", err.message);
  appendLog({ step: "error", agent: "worker", error: err.message });
  process.exit(1);
});
