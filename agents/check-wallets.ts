import * as dotenv from "dotenv";
import * as path from "path";
import { ethers } from "ethers";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL!);

  const workerWallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  const clientWallet = new ethers.Wallet(process.env.CLIENT_PRIVATE_KEY!, provider);

  const [wb, cb] = await Promise.all([
    provider.getBalance(workerWallet.address),
    provider.getBalance(clientWallet.address),
  ]);

  console.log("Worker wallet:", workerWallet.address, "|", ethers.formatEther(wb), "ETH",
    parseFloat(ethers.formatEther(wb)) >= 0.003 ? "✓" : "✗ needs ETH");
  console.log("Client wallet:", clientWallet.address, "|", ethers.formatEther(cb), "ETH",
    parseFloat(ethers.formatEther(cb)) >= 0.003 ? "✓" : "✗ needs ETH");

  const ready = parseFloat(ethers.formatEther(wb)) >= 0.003 && parseFloat(ethers.formatEther(cb)) >= 0.003;
  console.log(ready ? "\n✅ Both wallets funded — ready to run the demo!" : "\n⚠ One or more wallets need more ETH");
}

main().catch(console.error);
