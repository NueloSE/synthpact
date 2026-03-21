import * as dotenv from "dotenv";
import * as path from "path";
import { ethers } from "ethers";
import { getSynthPact, STATUS_LABELS, formatUSDC } from "./lib/contract";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const contract = getSynthPact();
  const count = await contract.dealCount();
  console.log("Total deals:", count.toString());

  for (let i = 1; i <= Number(count); i++) {
    const d = await contract.getDeal(i);
    console.log(`\nDeal #${i}:`);
    console.log("  Status:", STATUS_LABELS[Number(d.status)]);
    console.log("  Worker:", d.worker);
    console.log("  Client:", d.client || "(none)");
    console.log("  Price:", formatUSDC(d.price));
    console.log("  Deadline:", new Date(Number(d.deadline) * 1000).toISOString());
    if (d.deliveryHash !== ethers.ZeroHash) {
      console.log("  DeliveryHash:", d.deliveryHash);
    }
  }
}

main().catch(console.error);
