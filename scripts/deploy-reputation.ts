import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying SynthPactReputation with:", deployer.address);

  const Factory = await ethers.getContractFactory("SynthPactReputation");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("SynthPactReputation deployed to:", address);
  console.log("Add to .env: REPUTATION_CONTRACT_ADDRESS=" + address);
}

main().catch((e) => { console.error(e); process.exit(1); });
