import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying SynthPact with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // Base Sepolia addresses
  const SWAP_ROUTER = "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4"; // Uniswap v3 SwapRouter on Base Sepolia
  const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";          // USDC on Base Sepolia
  const WETH = "0x4200000000000000000000000000000000000006";          // WETH on Base

  const SynthPact = await ethers.getContractFactory("SynthPact");
  const synthpact = await SynthPact.deploy(SWAP_ROUTER, USDC, WETH);
  await synthpact.waitForDeployment();

  const address = await synthpact.getAddress();
  console.log("SynthPact deployed to:", address);
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("\nVerify with:");
  console.log(`npx hardhat verify --network baseSepolia ${address} ${SWAP_ROUTER} ${USDC} ${WETH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
