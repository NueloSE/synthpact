/**
 * Manually confirm a delivered deal and release USDC to worker.
 * Usage: tsx confirm-deal.ts <dealId>
 */
import * as dotenv from "dotenv";
import * as path from "path";
import { ethers } from "ethers";
import { getSynthPact, getReputationRegistry, clientWallet as wallet, formatUSDC } from "./lib/contract";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const dealId = parseInt(process.argv[2] || "1");
  const contract = getSynthPact(wallet);

  const deal = await contract.getDeal(dealId);
  console.log(`Deal #${dealId} status: ${["Open","Accepted","Delivered","Completed","Refunded","Cancelled"][Number(deal.status)]}`);
  console.log(`Price: ${formatUSDC(deal.price)} | Worker: ${deal.worker}`);

  if (Number(deal.status) !== 2) {
    console.log("Deal is not in Delivered state — cannot confirm");
    return;
  }

  console.log("\nConfirming delivery and releasing USDC to worker...");
  const tx = await contract.confirmDelivery(dealId);
  const receipt = await tx.wait();
  console.log(`✓ Payment released! TX: ${receipt.hash}`);
  console.log(`  Basescan: https://sepolia.basescan.org/tx/${receipt.hash}`);

  // Submit ERC-8004 reputation feedback
  console.log("\nSubmitting ERC-8004 reputation feedback...");
  const reputationRegistry = getReputationRegistry(wallet);
  try {
    const feedbackTx = await reputationRegistry.submitFeedback(
      process.env.ERC8004_IDENTITY_REGISTRY!,
      1,
      80,
      "crypto-analysis,market-report,verified",
      `data:application/json,${JSON.stringify({ dealId, score: 80, verified: true })}`
    );
    const feedbackReceipt = await feedbackTx.wait();
    console.log(`✓ Reputation submitted! TX: ${feedbackReceipt.hash}`);
    console.log(`  Basescan: https://sepolia.basescan.org/tx/${feedbackReceipt.hash}`);
  } catch (e: any) {
    console.log(`⚠ Reputation skipped: ${e.message?.slice(0, 80)}`);
  }

  console.log("\n✅ Deal complete! Full loop verified on-chain.");
}

main().catch(console.error);
