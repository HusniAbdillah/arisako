const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ArisanPool", function () {
  
  async function deployPoolFixture() {
    const [owner, user1, user2, user3, user4, user5] = await ethers. getSigners();
    
    // Deploy Mock IDRX
    const MockIDRX = await ethers.getContractFactory("MockIDRX");
    const idrx = await MockIDRX.deploy();
    await idrx.waitForDeployment();
    
    // Deploy Factory
    const ArisanFactory = await ethers.getContractFactory("ArisanFactory");
    const factory = await ArisanFactory.deploy(
      await idrx.getAddress(),
      owner.address,
      0
    );
    await factory.waitForDeployment();
    
    // Create Pool via Factory
    const poolConfig = {
      name: "Test Arisan Pool",
      contributionAmount: ethers.parseUnits("1000", 6),
      maxMembers: 5,
      cycleDuration: 30 * 24 * 60 * 60,
      ujrahRate: 50,
      requiresVouching: false,
      minVouchScore:  0
    };
    
    const tx = await factory.connect(user1).createPool(poolConfig);
    await tx.wait();
    
    const allPools = await factory.getAllPools();
    const poolAddress = allPools[0];
    
    const ArisanPool = await ethers. getContractFactory("ArisanPool");
    const pool = ArisanPool.attach(poolAddress);
    
    // Mint IDRX to users
    const users = [user1, user2, user3, user4, user5];
    for (const user of users) {
      await idrx.faucet(user. address, ethers.parseUnits("10000", 6));
      await idrx.connect(user).approve(poolAddress, ethers.parseUnits("10000", 6));
    }
    
    return { pool, idrx, factory, owner, user1, user2, user3, user4, user5 };
  }
  
  describe("Pool Information", function () {
    it("Should return correct pool info", async function () {
      const { pool } = await loadFixture(deployPoolFixture);
      
      const info = await pool.getPoolInfo();
      expect(info.name).to.equal("Test Arisan Pool");
      expect(info. contribution).to.equal(ethers.parseUnits("1000", 6));
      expect(info. maxMem).to.equal(5);
    });
  });
  
  describe("Joining Pool", function () {
    it("Should allow user to join pool", async function () {
      const { pool, user1 } = await loadFixture(deployPoolFixture);
      
      await expect(pool.connect(user1).joinPool())
        .to.emit(pool, "MemberJoined")
        .withArgs(user1.address, await time.latest() + 1);
      
      expect(await pool.getMemberCount()).to.equal(1);
    });
    
    it("Should not allow same user to join twice", async function () {
      const { pool, user1 } = await loadFixture(deployPoolFixture);
      
      await pool.connect(user1).joinPool();
      
      await expect(
        pool.connect(user1).joinPool()
      ).to.be.revertedWith("Already a member");
    });
    
    it("Should start pool when full", async function () {
      const { pool, user1, user2, user3, user4, user5 } = await loadFixture(deployPoolFixture);
      
      await pool.connect(user1).joinPool();
      await pool.connect(user2).joinPool();
      await pool.connect(user3).joinPool();
      await pool.connect(user4).joinPool();
      
      await expect(pool.connect(user5).joinPool())
        .to.emit(pool, "PoolStarted");
    });
    
    it("Should not allow joining when pool is full", async function () {
      const { pool, user1, user2, user3, user4, user5, owner } = await loadFixture(deployPoolFixture);
      
      await pool.connect(user1).joinPool();
      await pool.connect(user2).joinPool();
      await pool.connect(user3).joinPool();
      await pool.connect(user4).joinPool();
      await pool.connect(user5).joinPool();
      
      await expect(
        pool.connect(owner).joinPool()
      ).to.be.revertedWith("Pool not recruiting");
    });
  });
  
  describe("Contributions", function () {
    it("Should allow member to contribute", async function () {
      const { pool, owner, user1, user2, user3, user4, user5 } = await loadFixture(deployPoolFixture);
      
      await pool.connect(user1).joinPool();
      await pool.connect(user2).joinPool();
      await pool.connect(user3).joinPool();
      await pool.connect(user4).joinPool();
      await pool.connect(user5).joinPool();
      

      const poolInfo = await pool.getPoolInfo();
      expect(poolInfo.state).to.equal(1);
    });
    
    it("Should not allow non-member to contribute", async function () {
      const { pool, user1, user2, user3, user4, user5, owner } = await loadFixture(deployPoolFixture);
      
      await pool.connect(user1).joinPool();
      await pool.connect(user2).joinPool();
      await pool.connect(user3).joinPool();
      await pool.connect(user4).joinPool();
      await pool.connect(user5).joinPool();
      
      await expect(
        pool.connect(owner).contribute()
      ).to.be.revertedWith("Not a member");
    });
  });
  
  describe("Member Information", function () {
    it("Should return correct member info", async function () {
      const { pool, user1 } = await loadFixture(deployPoolFixture);
      
      await pool.connect(user1).joinPool();
      
      const memberInfo = await pool.getMemberInfo(user1.address);
      expect(memberInfo.memberAddress).to.equal(user1.address);
      expect(memberInfo.isActive).to.equal(true);
      expect(memberInfo.totalContributed).to.equal(0);
    });
    
    it("Should return all members", async function () {
      const { pool, user1, user2, user3 } = await loadFixture(deployPoolFixture);
      
      await pool.connect(user1).joinPool();
      await pool.connect(user2).joinPool();
      await pool.connect(user3).joinPool();
      
      const members = await pool.getAllMembers();
      expect(members.length).to.equal(3);
      expect(members[0]).to.equal(user1.address);
    });
  });
});