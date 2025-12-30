const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("VestingManager", function () {
  
  async function deployVestingFixture() {
    const [owner, beneficiary, user1] = await ethers.getSigners();
    
    // Deploy Mock IDRX
    const MockIDRX = await ethers. getContractFactory("MockIDRX");
    const idrx = await MockIDRX.deploy();
    await idrx.waitForDeployment();
    
    // Deploy VestingManager
    const VestingManager = await ethers.getContractFactory("VestingManager");
    const vesting = await VestingManager. deploy(await idrx.getAddress());
    await vesting.waitForDeployment();
    
    // Mint tokens
    await idrx.faucet(owner.address, ethers.parseUnits("100000", 6));
    await idrx.faucet(user1.address, ethers.parseUnits("100000", 6));
    
    // Approve vesting contract
    await idrx.connect(owner).approve(
      await vesting.getAddress(),
      ethers.parseUnits("100000", 6)
    );
    await idrx.connect(user1).approve(
      await vesting.getAddress(),
      ethers.parseUnits("100000", 6)
    );
    
    return { vesting, idrx, owner, beneficiary, user1 };
  }
  
  describe("Deployment", function () {
    it("Should set the correct token address", async function () {
      const { vesting, idrx } = await loadFixture(deployVestingFixture);
      expect(await vesting.TOKEN()).to.equal(await idrx.getAddress());
    });
  });
  
  describe("Creating Vesting", function () {
    it("Should create vesting successfully", async function () {
      const { vesting, beneficiary, owner } = await loadFixture(deployVestingFixture);
      
      const amount = ethers.parseUnits("1000", 6);
      const duration = 365 * 24 * 60 * 60; // 1 year
      
      await expect(
        vesting.connect(owner).createVesting(
          beneficiary.address,
          amount,
          duration,
          false
        )
      ).to.emit(vesting, "VestingCreated");
    });
    
    it("Should revert if beneficiary is zero address", async function () {
      const { vesting, owner } = await loadFixture(deployVestingFixture);
      
      await expect(
        vesting.connect(owner).createVesting(
          ethers.ZeroAddress,
          ethers.parseUnits("1000", 6),
          365 * 24 * 60 * 60,
          false
        )
      ).to.be.revertedWith("Invalid beneficiary");
    });
    
    it("Should revert if amount is zero", async function () {
      const { vesting, beneficiary, owner } = await loadFixture(deployVestingFixture);
      
      await expect(
        vesting.connect(owner).createVesting(
          beneficiary.address,
          0,
          365 * 24 * 60 * 60,
          false
        )
      ).to.be.revertedWith("Invalid amount");
    });
  });
  
  describe("Claiming Vesting", function () {
    it("Should allow claiming after time passes", async function () {
      const { vesting, idrx, beneficiary, owner } = await loadFixture(deployVestingFixture);
      
      const amount = ethers.parseUnits("1000", 6);
      const duration = 100; 
      
      const tx = await vesting.connect(owner).createVesting(
        beneficiary.address,
        amount,
        duration,
        false
      );
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(log => {
        try {
          return vesting.interface.parseLog(log).name === "VestingCreated";
        } catch {
          return false;
        }
      });
      const vestingId = vesting.interface.parseLog(event).args[0];
      
      await time.increase(50);
      
      const claimable = await vesting.getClaimable(vestingId);
      expect(claimable).to.be.gt(0);
      
      await expect(
        vesting.connect(beneficiary).claim(vestingId)
      ).to.emit(vesting, "VestingClaimed");
    });
    
    it("Should not allow non-beneficiary to claim", async function () {
      const { vesting, beneficiary, owner, user1 } = await loadFixture(deployVestingFixture);
      
      const tx = await vesting.connect(owner).createVesting(
        beneficiary.address,
        ethers.parseUnits("1000", 6),
        100,
        false
      );
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(log => {
        try {
          return vesting.interface.parseLog(log).name === "VestingCreated";
        } catch {
          return false;
        }
      });
      const vestingId = vesting.interface.parseLog(event).args[0];
      
      await time.increase(50);
      
      await expect(
        vesting.connect(user1).claim(vestingId)
      ).to.be.revertedWith("Not beneficiary");
    });
    
    it("Should allow full claim after duration", async function () {
      const { vesting, beneficiary, owner } = await loadFixture(deployVestingFixture);
      
      const amount = ethers. parseUnits("1000", 6);
      const duration = 100;
      
      const tx = await vesting.connect(owner).createVesting(
        beneficiary.address,
        amount,
        duration,
        false
      );
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(log => {
        try {
          return vesting.interface.parseLog(log).name === "VestingCreated";
        } catch {
          return false;
        }
      });
      const vestingId = vesting.interface.parseLog(event).args[0];
      
      await time.increase(duration + 1);
      
      const claimable = await vesting.getClaimable(vestingId);
      expect(claimable).to.equal(amount);
    });
  });
  
  describe("View Functions", function () {
    it("Should return user vestings", async function () {
      const { vesting, beneficiary, owner } = await loadFixture(deployVestingFixture);
      
      await vesting.connect(owner).createVesting(
        beneficiary. address,
        ethers.parseUnits("1000", 6),
        100,
        false
      );
      
      await vesting.connect(owner).createVesting(
        beneficiary.address,
        ethers.parseUnits("2000", 6),
        200,
        false
      );
      
      const vestings = await vesting.getUserVestings(beneficiary.address);
      expect(vestings.length).to.equal(2);
    });
  });
});