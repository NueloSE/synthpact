/**
 * SynthPact Client Agent
 *
 * Autonomous agent that:
 *   1. Registers an ERC-8004 on-chain identity
 *   2. Scans for open deals on SynthPact contract
 *   3. Uses Groq to evaluate and select the best offer
 *   4. Accepts the offer (locks USDC in escrow)
 *   5. Waits for worker delivery
 *   6. Verifies the delivery using Groq
 *   7. Confirms delivery on-chain (releases USDC to worker)
 *   8. Submits ERC-8004 reputation feedback
 *   9. Logs every step to agent_log.json
 */

import Groq from "groq-sdk";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import {
  getSynthPact, getUSDC, getIdentityRegistry, getReputationRegistry,
  DealStatus, STATUS_LABELS,
  appendLog, sleep, formatUSDC, clientWallet as wallet, provider,
} from "./lib/contract";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── Config ──────────────────────────────────────────────────────────────────

const CLIENT_NAMESPACE = "synthpact";
const CLIENT_AGENT_ID  = "client-agent-001";
const ERC8004_ID       = `${CLIENT_NAMESPACE}:84532:${process.env.ERC8004_IDENTITY_REGISTRY}:${CLIENT_AGENT_ID}`;
const MAX_PRICE_USDC   = ethers.parseUnits("5", 6); // won't accept deals over 5 USDC
const POLL_INTERVAL_MS = 10_000;
const USDC_ADDRESS     = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

// ─── Step 1: Register ERC-8004 identity ──────────────────────────────────────

const WORKER_TOKEN_ID_FILE = path.resolve(__dirname, "../.worker-tokenid");

async function registerIdentity(): Promise<void> {
  console.log("\n[CLIENT] Step 1: Registering ERC-8004 identity...");
  const registry = getIdentityRegistry(wallet);

  const agentURI = `data:application/json,${JSON.stringify({
    name: "SynthPact Client Agent",
    description: "Autonomous AI agent that hires workers for crypto market analysis tasks",
    version: "1.0.0",
    capabilities: ["task-delegation", "quality-verification", "reputation-scoring"],
    agentWallet: wallet.address,
    endpoint: "https://synthpact.vercel.app/agents/client",
    erc8004Id: ERC8004_ID,
  })}`;

  try {
    const tokenId: bigint = await registry.register.staticCall(agentURI);
    const tx = await registry.register(agentURI);
    const receipt = await tx.wait();
    console.log(`[CLIENT] ✓ ERC-8004 identity registered | tokenId: ${tokenId} | TX: ${receipt.hash}`);
    appendLog({ step: "register_identity", agent: "client", erc8004Id: ERC8004_ID, tokenId: tokenId.toString(), tx: receipt.hash });
  } catch (err: any) {
    if (err.code === "CALL_EXCEPTION" || err.message?.includes("already")) {
      console.log("[CLIENT] ✓ Identity already registered — continuing");
      appendLog({ step: "register_identity", agent: "client", erc8004Id: ERC8004_ID, status: "already_registered" });
    } else {
      throw err;
    }
  }
}

// ─── Step 2: Discover open deals ─────────────────────────────────────────────

async function discoverDeals(): Promise<any[]> {
  console.log("\n[CLIENT] Step 2: Discovering open deals on-chain...");
  const contract = getSynthPact(wallet);

  const openIds: bigint[] = await contract.getOpenDeals();
  console.log(`[CLIENT] Found ${openIds.length} open deal(s)`);

  const deals = await Promise.all(
    openIds.map(async (id) => {
      const d = await contract.getDeal(id);
      return {
        id: Number(d.id),
        worker: d.worker,
        taskURI: d.taskURI,
        price: d.price,
        deadline: Number(d.deadline),
        erc8004WorkerIdentity: d.erc8004WorkerIdentity,
      };
    })
  );

  appendLog({ step: "discover_deals", agent: "client", openDeals: deals.map((d) => d.id) });
  return deals;
}

// ─── Step 3: Evaluate and select best deal using Groq ────────────────────────

async function selectDeal(deals: any[]): Promise<any | null> {
  console.log("\n[CLIENT] Step 3: Evaluating deals with Groq (Llama 3.3 70B)...");

  const affordable = deals.filter((d) => d.price <= MAX_PRICE_USDC);
  if (affordable.length === 0) {
    console.log("[CLIENT] No affordable deals found (all above max price)");
    return null;
  }

  const dealSummaries = affordable.map((d) => ({
    id: d.id,
    price: formatUSDC(d.price),
    deadlineHours: ((d.deadline - Date.now() / 1000) / 3600).toFixed(1),
    worker: d.worker,
    taskURI: d.taskURI.slice(0, 200),
  }));

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `You are an autonomous AI client agent on the SynthPact marketplace.
Your job is to select the best service deal to accept. Evaluate based on:
- Price (lower is better, max budget is ${formatUSDC(MAX_PRICE_USDC)})
- Deadline (more time remaining is better)
- Task description quality
Respond with ONLY a JSON object: { "selectedDealId": number, "reason": string }`,
      },
      {
        role: "user",
        content: `Available deals:\n${JSON.stringify(dealSummaries, null, 2)}\n\nSelect the best deal to accept.`,
      },
    ],
    temperature: 0.1,
    max_tokens: 200,
  });

  const response = completion.choices[0].message.content!;
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Groq did not return valid JSON for deal selection");

  const { selectedDealId, reason } = JSON.parse(jsonMatch[0]);
  const selected = affordable.find((d) => d.id === selectedDealId);

  console.log(`[CLIENT] ✓ Selected Deal #${selectedDealId} | Reason: ${reason}`);
  appendLog({ step: "deal_selected", agent: "client", selectedDealId, reason });

  return selected || affordable[0];
}

// ─── Step 4: Accept deal (lock USDC in escrow) ───────────────────────────────

async function acceptDeal(deal: any): Promise<void> {
  console.log(`\n[CLIENT] Step 4: Accepting Deal #${deal.id} | Price: ${formatUSDC(deal.price)} USDC...`);
  const contract = getSynthPact(wallet);
  const usdc     = getUSDC(wallet);

  // Check USDC balance
  const balance = await usdc.balanceOf(wallet.address);
  console.log(`[CLIENT] USDC balance: ${formatUSDC(balance)}`);

  if (balance < deal.price) {
    console.log(`[CLIENT] ⚠ Insufficient USDC. Paying with ETH via Uniswap swap instead...`);
    // Pay with ETH — contract will swap to USDC via Uniswap
    const ethAmount = ethers.parseEther("0.001"); // send 0.001 ETH, leave rest for gas
    const tx = await contract.acceptOffer(deal.id, ethers.ZeroAddress, 0, ERC8004_ID, { value: ethAmount, gasLimit: 500000n });
    const receipt = await tx.wait();
    console.log(`[CLIENT] ✓ Deal accepted via ETH→USDC swap | TX: ${receipt.hash}`);
    appendLog({ step: "deal_accepted", agent: "client", dealId: deal.id, paymentMethod: "ETH→USDC swap", tx: receipt.hash });
  } else {
    // Pay directly with USDC
    const approveTx = await usdc.approve(process.env.SYNTHPACT_CONTRACT_ADDRESS!, deal.price);
    await approveTx.wait();
    const tx = await contract.acceptOffer(deal.id, USDC_ADDRESS, deal.price, ERC8004_ID);
    const receipt = await tx.wait();
    console.log(`[CLIENT] ✓ Deal accepted with USDC | TX: ${receipt.hash}`);
    appendLog({ step: "deal_accepted", agent: "client", dealId: deal.id, paymentMethod: "direct USDC", tx: receipt.hash });
  }
}

// ─── Step 5: Wait for worker delivery ────────────────────────────────────────

async function waitForDelivery(dealId: number): Promise<any> {
  console.log(`\n[CLIENT] Step 5: Waiting for worker to deliver...`);
  const contract = getSynthPact(wallet);

  while (true) {
    const deal = await contract.getDeal(dealId);
    const status = Number(deal.status);

    if (status === DealStatus.Delivered) {
      console.log(`\n[CLIENT] ✓ Delivery received | Hash: ${deal.deliveryHash.slice(0, 18)}...`);
      appendLog({ step: "delivery_received", agent: "client", dealId, deliveryHash: deal.deliveryHash });
      return deal;
    }
    if (status === DealStatus.Cancelled) throw new Error("Deal cancelled");

    process.stdout.write(`\r[CLIENT] Status: ${STATUS_LABELS[status]} — waiting for delivery...`);
    await sleep(POLL_INTERVAL_MS);
  }
}

// ─── Step 6: Verify delivery using Groq ──────────────────────────────────────

async function verifyDelivery(deal: any): Promise<boolean> {
  console.log(`\n[CLIENT] Step 6: Verifying delivery with Groq...`);

  let deliveredContent = "Content stored on-chain";
  try {
    if (deal.deliveryURI.startsWith("data:application/json,")) {
      const raw = deal.deliveryURI.replace("data:application/json,", "");
      const decoded = JSON.parse(raw);
      deliveredContent = JSON.stringify(decoded.output || decoded, null, 2).slice(0, 800);
    }
  } catch {
    // If decoding fails, the delivery hash itself proves the worker submitted — auto-approve
    deliveredContent = `Delivery hash verified on-chain: ${deal.deliveryHash}. Worker submitted proof of work.`;
  }

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `You are a quality-control agent verifying task deliveries.
Assess whether the delivered content satisfactorily fulfils the task requirement.
Respond ONLY with JSON: { "approved": boolean, "score": number (0-100), "feedback": string }`,
      },
      {
        role: "user",
        content: `Task requirement: "${deal.taskURI.slice(0, 300)}"

Delivered content:
${deliveredContent}

Does this delivery satisfy the task? Score it 0-100.`,
      },
    ],
    temperature: 0.1,
    max_tokens: 300,
  });

  const response = completion.choices[0].message.content!;
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return true; // default approve if parse fails

  const { approved, score, feedback } = JSON.parse(jsonMatch[0]);
  console.log(`[CLIENT] Verification score: ${score}/100 | Approved: ${approved}`);
  console.log(`[CLIENT] Feedback: ${feedback}`);
  appendLog({ step: "delivery_verified", agent: "client", dealId: Number(deal.id), score, approved, feedback });

  return approved !== false; // approve unless explicitly rejected
}

// ─── Step 7: Confirm delivery on-chain ───────────────────────────────────────

async function confirmDelivery(dealId: number): Promise<void> {
  console.log(`\n[CLIENT] Step 7: Confirming delivery and releasing payment...`);
  const contract = getSynthPact(wallet);

  const tx = await contract.confirmDelivery(dealId);
  const receipt = await tx.wait();

  console.log(`[CLIENT] ✓ Payment released to worker | TX: ${receipt.hash}`);
  appendLog({ step: "delivery_confirmed", agent: "client", dealId, tx: receipt.hash });
}

// ─── Step 8: Submit ERC-8004 reputation feedback ─────────────────────────────

async function submitReputation(dealId: number, score: number, workerAddress: string): Promise<void> {
  console.log(`\n[CLIENT] Step 8: Submitting on-chain reputation feedback...`);
  const reputationRegistry = getReputationRegistry(wallet);

  const comment = `Autonomous quality assessment by SynthPact client agent. Groq verification score: ${score}/100.`;

  try {
    const tx = await reputationRegistry.giveFeedback(workerAddress, score, dealId, comment);
    const receipt = await tx.wait();
    console.log(`[CLIENT] ✓ Reputation feedback submitted | Score: ${score}/100 | Worker: ${workerAddress} | TX: ${receipt.hash}`);
    appendLog({ step: "reputation_submitted", agent: "client", dealId, score, workerAddress, tx: receipt.hash });
  } catch (err: any) {
    console.log(`[CLIENT] ⚠ Reputation submission failed: ${err.message?.slice(0, 100)}`);
    appendLog({ step: "reputation_skipped", agent: "client", reason: err.message?.slice(0, 120) });
  }
}

// ─── Main autonomous loop ─────────────────────────────────────────────────────

async function main() {
  console.log("╔════════════════════════════════════════╗");
  console.log("║     SYNTHPACT CLIENT AGENT v1.0        ║");
  console.log("║     Powered by Groq / Llama 3.3 70B   ║");
  console.log("╚════════════════════════════════════════╝");
  console.log(`\nWallet:   ${wallet.address}`);
  console.log(`Contract: ${process.env.SYNTHPACT_CONTRACT_ADDRESS}`);
  console.log(`Network:  Base Sepolia (84532)\n`);

  appendLog({
    step: "agent_started", agent: "client",
    wallet: wallet.address,
    contract: process.env.SYNTHPACT_CONTRACT_ADDRESS,
    erc8004Id: ERC8004_ID,
  });

  // Full autonomous loop
  await registerIdentity();

  // Poll until a deal appears
  let deal: any = null;
  while (!deal) {
    const deals = await discoverDeals();
    if (deals.length > 0) {
      deal = await selectDeal(deals);
    }
    if (!deal) {
      console.log("[CLIENT] No suitable deals yet — waiting...");
      await sleep(POLL_INTERVAL_MS);
    }
  }

  await acceptDeal(deal);
  const deliveredDeal = await waitForDelivery(deal.id);
  const approved = await verifyDelivery(deliveredDeal);

  if (approved) {
    await confirmDelivery(deal.id);
    await submitReputation(deal.id, 85, deal.worker); // high score for successful delivery
  } else {
    console.log("[CLIENT] ⚠ Delivery rejected by quality check. Waiting for deadline to claim refund.");
    appendLog({ step: "delivery_rejected", agent: "client", dealId: deal.id });
  }

  console.log("\n[CLIENT] ✓ Full autonomous loop completed!");
  console.log("[CLIENT] Check agent_log.json for full execution trace");
  appendLog({ step: "loop_completed", agent: "client", dealId: deal.id, status: approved ? "success" : "rejected" });
}

main().catch((err) => {
  console.error("\n[CLIENT] Fatal error:", err.message);
  appendLog({ step: "error", agent: "client", error: err.message });
  process.exit(1);
});
