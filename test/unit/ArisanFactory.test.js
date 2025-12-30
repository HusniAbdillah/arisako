const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("ArisanFactory", function () {
  
  async function deployFactoryFixture() {
    const [owner, treasury, user1, user2, user3] = await ethers. getSigners();
    
    // Deploy Mock IDRX
    const MockIDRX = await ethers. getContractFactory("MockIDRX");
    const idrx = await MockIDRX.deploy();
    await idrx.waitForDeployment();
    
    // Deploy Factory
    const ArisanFactory = await ethers.getContractFactory("ArisanFactory");
    const factory = await ArisanFactory.deploy(
      await idrx.getAddress(),
      treasury.address,
      ethers.parseUnits("10", 6)
    );
    await factory.waitForDeployment();
    
    await idrx.faucet(user1.address, ethers.parseUnits("10000", 6));
    await idrx.faucet(user2.address, ethers.parseUnits("10000", 6));
    await idrx.faucet(user3.address, ethers.parseUnits("10000", 6));
    
    return { factory, idrx, owner, treasury, user1, user2, user3 };
  }
  
  describe("Deployment", function () {
    it("Should set the correct IDRX token address", async function () {
      const { factory, idrx } = await loadFixture(deployFactoryFixture);
      expect(await factory. IDRX_TOKEN()).to.equal(await idrx.getAddress());
    });
    
    it("Should set the correct treasury address", async function () {
      const { factory, treasury } = await loadFixture(deployFactoryFixture);
      expect(await factory.treasury()).to.equal(treasury.address);
    });
    
    it("Should set the correct deployment fee", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      expect(await factory.deploymentFee()).to.equal(ethers.parseUnits("10", 6));
    });
  });
  
  describe("Pool Creation", function () {
    it("Should create a new pool successfully", async function () {
      const { factory, user1 } = await loadFixture(deployFactoryFixture);
      
      const poolConfig = {
        name: "Test Arisan RT 05",
        contributionAmount: ethers.parseUnits("1000", 6), // 1000 IDRX
        maxMembers: 10,
        cycleDuration: 30 * 24 * 60 * 60, // 30 days
        ujrahRate: 50, // 0.5%
        requiresVouching: false,
        minVouchScore: 0
      };
      
      const tx = await factory.connect(user1).createPool(poolConfig);
      const receipt = await tx.wait();
      
      expect(await factory.getTotalPools()).to.equal(1);
    });
    
    it("Should emit PoolCreated event", async function () {
      const { factory, user1 } = await loadFixture(deployFactoryFixture);
      
      const poolConfig = {
        name: "Test Arisan",
        contributionAmount: ethers.parseUnits("1000", 6),
        maxMembers: 10,
        cycleDuration: 30 * 24 * 60 * 60,
        ujrahRate: 50,
        requiresVouching: false,
        minVouchScore:  0
      };
      
      await expect(factory.connect(user1).createPool(poolConfig))
        .to.emit(factory, "PoolCreated");
    });
    
    it("Should revert if pool name is empty", async function () {
      const { factory, user1 } = await loadFixture(deployFactoryFixture);
      
      const poolConfig = {
        name:  "",
        contributionAmount: ethers.parseUnits("1000", 6),
        maxMembers: 10,
        cycleDuration: 30 * 24 * 60 * 60,
        ujrahRate:  50,
        requiresVouching: false,
        minVouchScore: 0
      };
      
      await expect(
        factory.connect(user1).createPool(poolConfig)
      ).to.be.revertedWith("Name required");
    });
    
    it("Should revert if max members is invalid", async function () {
      const { factory, user1 } = await loadFixture(deployFactoryFixture);
      
      const poolConfig = {
        name:  "Test Arisan",
        contributionAmount: ethers.parseUnits("1000", 6),
        maxMembers: 3, // Too low
        cycleDuration: 30 * 24 * 60 * 60,
        ujrahRate: 50,
        requiresVouching: false,
        minVouchScore:  0
      };
      
      await expect(
        factory. connect(user1).createPool(poolConfig)
      ).to.be.revertedWith("Invalid max members");
    });
    
    it("Should revert if ujrah rate is too high", async function () {
      const { factory, user1 } = await loadFixture(deployFactoryFixture);
      
      const poolConfig = {
        name:  "Test Arisan",
        contributionAmount: ethers.parseUnits("1000", 6),
        maxMembers: 10,
        cycleDuration:  30 * 24 * 60 * 60,
        ujrahRate: 600, // 6% - too high
        requiresVouching: false,
        minVouchScore: 0
      };
      
      await expect(
        factory.connect(user1).createPool(poolConfig)
      ).to.be.revertedWith("Ujrah too high");
    });
  });
  
  describe("Pool Tracking", function () {
    it("Should track pools by creator", async function () {
      const { factory, user1 } = await loadFixture(deployFactoryFixture);
      
      const poolConfig = {
        name:  "Test Arisan 1",
        contributionAmount:  ethers.parseUnits("1000", 6),
        maxMembers: 10,
        cycleDuration: 30 * 24 * 60 * 60,
        ujrahRate: 50,
        requiresVouching: false,
        minVouchScore: 0
      };
      
      await factory.connect(user1).createPool(poolConfig);
      await factory.connect(user1).createPool({... poolConfig, name: "Test Arisan 2"});
      
      const userPools = await factory.getPoolsByCreator(user1.address);
      expect(userPools.length).to.equal(2);
    });
    
    it("Should return correct pool metadata", async function () {
      const { factory, user1 } = await loadFixture(deployFactoryFixture);
      
      const poolConfig = {
        name:  "Test Arisan",
        contributionAmount: ethers.parseUnits("1000", 6),
        maxMembers: 10,
        cycleDuration: 30 * 24 * 60 * 60,
        ujrahRate: 50,
        requiresVouching: false,
        minVouchScore: 0
      };
      
      const tx = await factory.connect(user1).createPool(poolConfig);
      const receipt = await tx. wait();
      
      const allPools = await factory.getAllPools();
      const poolAddress = allPools[0];
      
      const metadata = await factory.getPoolMetadata(poolAddress);
      expect(metadata.creator).to.equal(user1.address);
      expect(metadata. currentMembers).to.equal(0);
    });
  });
  
  describe("Admin Functions", function () {
    it("Should allow owner to update deployment fee", async function () {
      const { factory, owner } = await loadFixture(deployFactoryFixture);
      
      const newFee = ethers.parseUnits("20", 6);
      await factory.connect(owner).setDeploymentFee(newFee);
      
      expect(await factory.deploymentFee()).to.equal(newFee);
    });
    
    it("Should allow owner to update treasury", async function () {
      const { factory, owner, user1 } = await loadFixture(deployFactoryFixture);
      
      await factory.connect(owner).setTreasury(user1.address);
      expect(await factory. treasury()).to.equal(user1.address);
    });
    
    it("Should revert if non-owner tries to update fee", async function () {
      const { factory, user1 } = await loadFixture(deployFactoryFixture);
      
      await expect(
        factory.connect(user1).setDeploymentFee(ethers.parseUnits("20", 6))
      ).to.be.reverted;
    });
  });
});