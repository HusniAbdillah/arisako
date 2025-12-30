const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("SocialVouching", function () {
  
  async function deploySocialVouchingFixture() {
    const [owner, user1, user2, user3, user4] = await ethers. getSigners();
    
    const SocialVouching = await ethers.getContractFactory("SocialVouching");
    const vouching = await SocialVouching.deploy();
    await vouching.waitForDeployment();
    
    return { vouching, owner, user1, user2, user3, user4 };
  }
  
  describe("Deployment", function () {
    it("Should set correct constants", async function () {
      const { vouching } = await loadFixture(deploySocialVouchingFixture);
      
      expect(await vouching.MIN_VOUCH_WEIGHT()).to.equal(1);
      expect(await vouching. MAX_VOUCH_WEIGHT()).to.equal(10);
      expect(await vouching. VERIFICATION_THRESHOLD()).to.equal(50);
    });
  });
  
  describe("Vouching", function () {
    it("Should allow user to vouch for another", async function () {
      const { vouching, user1, user2 } = await loadFixture(deploySocialVouchingFixture);
      
      await expect(
        vouching.connect(user1).vouchFor(user2.address, 8, "Trusted friend")
      ).to.emit(vouching, "VouchGiven")
        .withArgs(user1.address, user2.address, 8, "Trusted friend");
    });
    
    it("Should not allow vouching for self", async function () {
      const { vouching, user1 } = await loadFixture(deploySocialVouchingFixture);
      
      await expect(
        vouching.connect(user1).vouchFor(user1.address, 5, "Self vouch")
      ).to.be.revertedWith("Cannot vouch self");
    });
    
    it("Should not allow invalid weight", async function () {
      const { vouching, user1, user2 } = await loadFixture(deploySocialVouchingFixture);
      
      await expect(
        vouching.connect(user1).vouchFor(user2.address, 0, "Invalid")
      ).to.be.revertedWith("Invalid weight");
      
      await expect(
        vouching.connect(user1).vouchFor(user2.address, 11, "Too high")
      ).to.be.revertedWith("Invalid weight");
    });
    
    it("Should not allow vouching twice", async function () {
      const { vouching, user1, user2 } = await loadFixture(deploySocialVouchingFixture);
      
      await vouching.connect(user1).vouchFor(user2.address, 5, "First vouch");
      
      await expect(
        vouching.connect(user1).vouchFor(user2.address, 8, "Second vouch")
      ).to.be.revertedWith("Already vouched");
    });
  });
  
  describe("Trust Score", function () {
    it("Should calculate trust score correctly", async function () {
      const { vouching, user1, user2, user3, user4 } = await loadFixture(deploySocialVouchingFixture);
      
      await vouching.connect(user1).vouchFor(user4.address, 8, "Good");
      await vouching.connect(user2).vouchFor(user4.address, 7, "Trusted");
      await vouching. connect(user3).vouchFor(user4.address, 9, "Excellent");
      
      const score = await vouching.getTrustScore(user4.address);
      expect(score).to.equal(8 + 7 + 9);
    });
    
    it("Should verify user when threshold is reached", async function () {
      const signers = await ethers.getSigners();
      const [, user1, user2, user3, user4, user5, user6, user7] = signers;
      
      const SocialVouching = await ethers.getContractFactory("SocialVouching");
      const vouching = await SocialVouching.deploy();
      await vouching.waitForDeployment();
      
      // Create 5 vouches for user1, each with 10 points = 50 total
      await vouching.connect(user2).vouchFor(user1.address, 10, "Vouch 1");
      await vouching.connect(user3).vouchFor(user1.address, 10, "Vouch 2");
      await vouching.connect(user4).vouchFor(user1.address, 10, "Vouch 3");
      await vouching.connect(user5).vouchFor(user1.address, 10, "Vouch 4");
      await vouching.connect(user6).vouchFor(user1.address, 10, "Vouch 5");
      
      expect(await vouching.isVerified(user1.address)).to.equal(true);
    });
  });
  
  describe("Revoking Vouch", function () {
    it("Should allow revoking vouch", async function () {
      const { vouching, user1, user2 } = await loadFixture(deploySocialVouchingFixture);
      
      await vouching. connect(user1).vouchFor(user2.address, 8, "Initial vouch");
      
      await expect(
        vouching.connect(user1).revokeVouch(user2.address)
      ).to.emit(vouching, "VouchRevoked")
        .withArgs(user1.address, user2.address);
    });
    
    it("Should update trust score after revoke", async function () {
      const { vouching, user1, user2, user3 } = await loadFixture(deploySocialVouchingFixture);
      
      await vouching.connect(user1).vouchFor(user3.address, 8, "Vouch 1");
      await vouching.connect(user2).vouchFor(user3.address, 7, "Vouch 2");
      
      let score = await vouching.getTrustScore(user3.address);
      expect(score).to.equal(15);
      
      await vouching.connect(user1).revokeVouch(user3.address);
      
      score = await vouching.getTrustScore(user3.address);
      expect(score).to.equal(7);
    });
  });
  
  describe("Updating Vouch Weight", function () {
    it("Should allow updating vouch weight", async function () {
      const { vouching, user1, user2 } = await loadFixture(deploySocialVouchingFixture);
      
      await vouching.connect(user1).vouchFor(user2.address, 5, "Initial");
      await vouching.connect(user1).updateVouchWeight(user2.address, 9);
      
      const vouch = await vouching.getVouch(user1.address, user2.address);
      expect(vouch.weight).to.equal(9);
    });
  });
  
  describe("View Functions", function () {
    it("Should return vouchers list", async function () {
      const { vouching, user1, user2, user3, user4 } = await loadFixture(deploySocialVouchingFixture);
      
      await vouching.connect(user1).vouchFor(user4.address, 5, "V1");
      await vouching. connect(user2).vouchFor(user4.address, 6, "V2");
      await vouching.connect(user3).vouchFor(user4.address, 7, "V3");
      
      const vouchers = await vouching.getVouchersOf(user4.address);
      expect(vouchers.length).to.equal(3);
    });
    
    it("Should return vouchees list", async function () {
      const { vouching, user1, user2, user3 } = await loadFixture(deploySocialVouchingFixture);
      
      await vouching. connect(user1).vouchFor(user2.address, 5, "V1");
      await vouching. connect(user1).vouchFor(user3.address, 6, "V2");
      
      const vouchees = await vouching.getVoucheesOf(user1.address);
      expect(vouchees.length).to.equal(2);
    });
  });
});