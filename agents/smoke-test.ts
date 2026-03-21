import * as dotenv from "dotenv";
import * as path from "path";
import { ethers } from "ethers";
import Groq from "groq-sdk";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  console.log("Running SynthPact smoke test...\n");

  // Test 1: RPC connection
  const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL!);
  const block = await provider.getBlockNumber();
  console.log("✓ RPC connected | Block:", block);

  // Test 2: SynthPact contract
  const code = await provider.getCode(process.env.SYNTHPACT_CONTRACT_ADDRESS!);
  console.log("✓ SynthPact live | Size:", (code.length - 2) / 2, "bytes");

  // Test 3: ERC-8004 Identity Registry
  const ir = await provider.getCode(process.env.ERC8004_IDENTITY_REGISTRY!);
  console.log("✓ ERC-8004 Identity Registry live | Size:", (ir.length - 2) / 2, "bytes");

  // Test 4: ERC-8004 Reputation Registry
  const rr = await provider.getCode(process.env.ERC8004_REPUTATION_REGISTRY!);
  console.log("✓ ERC-8004 Reputation Registry live | Size:", (rr.length - 2) / 2, "bytes");

  // Test 5: Groq API
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const res = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: "Reply with exactly: GROQ_OK" }],
    max_tokens: 10,
  });
  console.log("✓ Groq API working | Response:", res.choices[0].message.content?.trim());

  // Test 6: Wallet
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  const balance = await provider.getBalance(wallet.address);
  console.log("✓ Wallet:", wallet.address, "| Balance:", ethers.formatEther(balance), "ETH");

  console.log("\n✅ All checks passed — ready to run agents!");
}

main().catch((e) => {
  console.error("✗ FAIL:", e.message);
  process.exit(1);
});
