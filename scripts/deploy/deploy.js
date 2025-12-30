const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting Arisako Contract Deployment...\n");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("📝 Deploying contracts with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", hre.ethers.formatEther(balance), "ETH\n");
  
  // ============ DEPLOY MOCK IDRX (for testnet) ============
  console.log("📦 Deploying MockIDRX...");
  const MockIDRX = await hre.ethers.getContractFactory("MockIDRX");
  const idrx = await MockIDRX.deploy();
  await idrx.waitForDeployment();
  const idrxAddress = await idrx.getAddress();
  console.log("✅ MockIDRX deployed to:", idrxAddress);
  console.log("");
  
  // ============ DEPLOY VESTING MANAGER ============
  console.log("📦 Deploying VestingManager...");
  const VestingManager = await hre.ethers.getContractFactory("VestingManager");
  const vestingManager = await VestingManager.deploy(idrxAddress);
  await vestingManager.waitForDeployment();
  const vestingAddress = await vestingManager.getAddress();
  console.log("✅ VestingManager deployed to:", vestingAddress);
  console.log("");
  
  // ============ DEPLOY SOCIAL VOUCHING ============
  console.log("📦 Deploying SocialVouching...");
  const SocialVouching = await hre.ethers.getContractFactory("SocialVouching");
  const socialVouching = await SocialVouching.deploy();
  await socialVouching.waitForDeployment();
  const vouchingAddress = await socialVouching.getAddress();
  console.log("✅ SocialVouching deployed to:", vouchingAddress);
  console.log("");
  
  // ============ DEPLOY ARISAN FACTORY ============
  console.log("📦 Deploying ArisanFactory...");
  const treasuryAddress = deployer.address; // Use deployer as treasury for now
  const deploymentFee = hre.ethers.parseUnits("0", 6); // No fee for initial launch
  
  const ArisanFactory = await hre.ethers.getContractFactory("ArisanFactory");
  const factory = await ArisanFactory.deploy(
    idrxAddress,
    treasuryAddress,
    deploymentFee
  );
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("✅ ArisanFactory deployed to:", factoryAddress);
  console.log("");
  
  // ============ CONFIGURE CONTRACTS ============
  console.log("⚙️  Configuring contracts...");
  
  console.log("   Setting VestingManager in Factory...");
  await factory.setVestingManager(vestingAddress);
  
  console.log("   Setting SocialVouching in Factory...");
  await factory.setSocialVouching(vouchingAddress);
  console.log("✅ Configuration complete\n");
  
  // ============ SAVE DEPLOYMENT INFO ============
  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      MockIDRX: idrxAddress,
      VestingManager:  vestingAddress,
      SocialVouching: vouchingAddress,
      ArisanFactory:  factoryAddress
    }
  };
  
  const deploymentsDir = path.join(__dirname, "../../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  const filename = `${hre.network.name}-${Date.now()}.json`;
  fs.writeFileSync(
    path.join(deploymentsDir, filename),
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("📄 Deployment info saved to:", filename);
  console.log("");
  
  // ============ SUMMARY ============
  console.log("=".repeat(60));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=".repeat(60));
  console.log("📋 Contract Addresses:");
  console.log("   MockIDRX:         ", idrxAddress);
  console.log("   VestingManager:  ", vestingAddress);
  console.log("   SocialVouching:  ", vouchingAddress);
  console.log("   ArisanFactory:    ", factoryAddress);
  console.log("=".repeat(60));
  console.log("");
  
  // ============ VERIFICATION COMMANDS ============
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("🔍 To verify contracts on Basescan, run:");
    console.log("");
    console.log(`npx hardhat verify --network ${hre.network.name} ${idrxAddress}`);
    console.log(`npx hardhat verify --network ${hre.network.name} ${vestingAddress} ${idrxAddress}`);
    console.log(`npx hardhat verify --network ${hre.network.name} ${vouchingAddress}`);
    console.log(`npx hardhat verify --network ${hre.network.name} ${factoryAddress} ${idrxAddress} ${treasuryAddress} ${deploymentFee}`);
    console.log("");
  }
  
  // ============ NEXT STEPS ============
  console.log("📝 Next Steps:");
  console.log("1. Update .env.local with new contract addresses");
  console.log("2. Update lib/web3/config.ts with factory address");
  console.log("3. Run frontend:  pnpm dev");
  console.log("4. Create first test pool!");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });