import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("SynthPact", function () {
  // Mock addresses for Uniswap + tokens on local hardhat network
  const MOCK_USDC = ethers.ZeroAddress; // replaced by ERC20Mock in setup
  let synthPact: any;
  let usdcToken: any;
  let mockRouter: any;
  let worker: any, client: any, other: any;

  const PRICE = ethers.parseUnits("10", 6); // 10 USDC
  const TASK_HASH = ethers.keccak256(ethers.toUtf8Bytes("Analyse ETH gas trends for Q1 2026"));
  const TASK_URI  = "ipfs://QmTaskSpec123";
  const ERC8004_WORKER = "base-sepolia:84532:0xIdentityRegistry:worker-001";
  const ERC8004_CLIENT = "base-sepolia:84532:0xIdentityRegistry:client-001";
  const ONE_DAY = 86400;

  beforeEach(async () => {
    [worker, client, other] = await ethers.getSigners();

    // Deploy a minimal ERC20 mock for USDC
    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    usdcToken = await ERC20Mock.deploy("USD Coin", "USDC", 6);

    // Deploy a mock swap router that just transfers USDC directly (simulates a swap)
    const MockRouter = await ethers.getContractFactory("MockSwapRouter");
    mockRouter = await MockRouter.deploy(await usdcToken.getAddress());

    // Mint USDC to mock router (so it can "return" USDC from swaps)
    await usdcToken.mint(await mockRouter.getAddress(), ethers.parseUnits("10000", 6));
    // Mint USDC to client for direct USDC payment tests
    await usdcToken.mint(client.address, ethers.parseUnits("1000", 6));

    // Deploy SynthPact
    const SynthPact = await ethers.getContractFactory("SynthPact");
    synthPact = await SynthPact.deploy(
      await mockRouter.getAddress(),
      await usdcToken.getAddress(),
      ethers.ZeroAddress // WETH not needed for local tests
    );
  });

  // ─── postOffer ─────────────────────────────────────────────────────────────

  describe("postOffer", () => {
    it("creates a deal with Open status", async () => {
      const deadline = (await time.latest()) + ONE_DAY;
      await synthPact.connect(worker).postOffer(TASK_HASH, TASK_URI, PRICE, deadline, ERC8004_WORKER);

      const deal = await synthPact.getDeal(1);
      expect(deal.id).to.equal(1);
      expect(deal.worker).to.equal(worker.address);
      expect(deal.price).to.equal(PRICE);
      expect(deal.status).to.equal(0); // Open
      expect(deal.erc8004WorkerIdentity).to.equal(ERC8004_WORKER);
    });

    it("increments dealCount", async () => {
      const deadline = (await time.latest()) + ONE_DAY;
      await synthPact.connect(worker).postOffer(TASK_HASH, TASK_URI, PRICE, deadline, ERC8004_WORKER);
      await synthPact.connect(worker).postOffer(TASK_HASH, TASK_URI, PRICE, deadline, ERC8004_WORKER);
      expect(await synthPact.dealCount()).to.equal(2);
    });

    it("reverts with zero price", async () => {
      const deadline = (await time.latest()) + ONE_DAY;
      await expect(
        synthPact.connect(worker).postOffer(TASK_HASH, TASK_URI, 0, deadline, ERC8004_WORKER)
      ).to.be.revertedWithCustomError(synthPact, "ZeroPrice");
    });

    it("reverts with past deadline", async () => {
      const pastDeadline = (await time.latest()) - 1;
      await expect(
        synthPact.connect(worker).postOffer(TASK_HASH, TASK_URI, PRICE, pastDeadline, ERC8004_WORKER)
      ).to.be.revertedWithCustomError(synthPact, "DeadlineMustBeFuture");
    });

    it("emits DealPosted event", async () => {
      const deadline = (await time.latest()) + ONE_DAY;
      await expect(
        synthPact.connect(worker).postOffer(TASK_HASH, TASK_URI, PRICE, deadline, ERC8004_WORKER)
      ).to.emit(synthPact, "DealPosted").withArgs(1, worker.address, TASK_HASH, TASK_URI, PRICE, deadline, ERC8004_WORKER);
    });
  });

  // ─── acceptOffer ───────────────────────────────────────────────────────────

  describe("acceptOffer", () => {
    let dealId: number;
    let deadline: number;

    beforeEach(async () => {
      deadline = (await time.latest()) + ONE_DAY;
      await synthPact.connect(worker).postOffer(TASK_HASH, TASK_URI, PRICE, deadline, ERC8004_WORKER);
      dealId = 1;
    });

    it("accepts with direct USDC payment", async () => {
      await usdcToken.connect(client).approve(await synthPact.getAddress(), PRICE);
      await synthPact.connect(client).acceptOffer(dealId, await usdcToken.getAddress(), PRICE, ERC8004_CLIENT);

      const deal = await synthPact.getDeal(dealId);
      expect(deal.status).to.equal(1); // Accepted
      expect(deal.client).to.equal(client.address);
      expect(deal.erc8004ClientIdentity).to.equal(ERC8004_CLIENT);

      // USDC locked in contract
      expect(await usdcToken.balanceOf(await synthPact.getAddress())).to.equal(PRICE);
    });

    it("emits DealAccepted event", async () => {
      await usdcToken.connect(client).approve(await synthPact.getAddress(), PRICE);
      await expect(
        synthPact.connect(client).acceptOffer(dealId, await usdcToken.getAddress(), PRICE, ERC8004_CLIENT)
      ).to.emit(synthPact, "DealAccepted").withArgs(dealId, client.address, PRICE, ERC8004_CLIENT);
    });

    it("reverts if deal already accepted", async () => {
      await usdcToken.connect(client).approve(await synthPact.getAddress(), PRICE * 2n);
      await synthPact.connect(client).acceptOffer(dealId, await usdcToken.getAddress(), PRICE, ERC8004_CLIENT);
      await usdcToken.mint(other.address, PRICE);
      await usdcToken.connect(other).approve(await synthPact.getAddress(), PRICE);
      await expect(
        synthPact.connect(other).acceptOffer(dealId, await usdcToken.getAddress(), PRICE, ERC8004_CLIENT)
      ).to.be.revertedWithCustomError(synthPact, "InvalidStatus");
    });

    it("reverts if deadline has passed", async () => {
      await time.increase(ONE_DAY + 1);
      await usdcToken.connect(client).approve(await synthPact.getAddress(), PRICE);
      await expect(
        synthPact.connect(client).acceptOffer(dealId, await usdcToken.getAddress(), PRICE, ERC8004_CLIENT)
      ).to.be.revertedWithCustomError(synthPact, "DeadlinePassed");
    });
  });

  // ─── submitDelivery ────────────────────────────────────────────────────────

  describe("submitDelivery", () => {
    const DELIVERY_HASH = ethers.keccak256(ethers.toUtf8Bytes("Gas analysis output: average 25 gwei"));
    const DELIVERY_URI  = "ipfs://QmDeliveryOutput456";
    let dealId: number;

    beforeEach(async () => {
      const deadline = (await time.latest()) + ONE_DAY;
      await synthPact.connect(worker).postOffer(TASK_HASH, TASK_URI, PRICE, deadline, ERC8004_WORKER);
      dealId = 1;
      await usdcToken.connect(client).approve(await synthPact.getAddress(), PRICE);
      await synthPact.connect(client).acceptOffer(dealId, await usdcToken.getAddress(), PRICE, ERC8004_CLIENT);
    });

    it("sets delivery hash and status to Delivered", async () => {
      await synthPact.connect(worker).submitDelivery(dealId, DELIVERY_HASH, DELIVERY_URI);
      const deal = await synthPact.getDeal(dealId);
      expect(deal.status).to.equal(2); // Delivered
      expect(deal.deliveryHash).to.equal(DELIVERY_HASH);
      expect(deal.deliveryURI).to.equal(DELIVERY_URI);
    });

    it("reverts if called by non-worker", async () => {
      await expect(
        synthPact.connect(client).submitDelivery(dealId, DELIVERY_HASH, DELIVERY_URI)
      ).to.be.revertedWithCustomError(synthPact, "NotWorker");
    });

    it("emits DeliverySubmitted event", async () => {
      await expect(
        synthPact.connect(worker).submitDelivery(dealId, DELIVERY_HASH, DELIVERY_URI)
      ).to.emit(synthPact, "DeliverySubmitted").withArgs(dealId, worker.address, DELIVERY_HASH, DELIVERY_URI);
    });
  });

  // ─── confirmDelivery ───────────────────────────────────────────────────────

  describe("confirmDelivery", () => {
    const DELIVERY_HASH = ethers.keccak256(ethers.toUtf8Bytes("output"));
    let dealId: number;

    beforeEach(async () => {
      const deadline = (await time.latest()) + ONE_DAY;
      await synthPact.connect(worker).postOffer(TASK_HASH, TASK_URI, PRICE, deadline, ERC8004_WORKER);
      dealId = 1;
      await usdcToken.connect(client).approve(await synthPact.getAddress(), PRICE);
      await synthPact.connect(client).acceptOffer(dealId, await usdcToken.getAddress(), PRICE, ERC8004_CLIENT);
      await synthPact.connect(worker).submitDelivery(dealId, DELIVERY_HASH, "ipfs://out");
    });

    it("releases USDC to worker and sets status to Completed", async () => {
      const workerBefore = await usdcToken.balanceOf(worker.address);
      await synthPact.connect(client).confirmDelivery(dealId);
      const workerAfter = await usdcToken.balanceOf(worker.address);

      expect(workerAfter - workerBefore).to.equal(PRICE);
      expect((await synthPact.getDeal(dealId)).status).to.equal(3); // Completed
    });

    it("emits DealCompleted event", async () => {
      await expect(synthPact.connect(client).confirmDelivery(dealId))
        .to.emit(synthPact, "DealCompleted").withArgs(dealId, worker.address, PRICE);
    });

    it("reverts if called by non-client", async () => {
      await expect(
        synthPact.connect(other).confirmDelivery(dealId)
      ).to.be.revertedWithCustomError(synthPact, "NotClient");
    });
  });

  // ─── claimRefund ───────────────────────────────────────────────────────────

  describe("claimRefund", () => {
    let dealId: number;

    beforeEach(async () => {
      const deadline = (await time.latest()) + ONE_DAY;
      await synthPact.connect(worker).postOffer(TASK_HASH, TASK_URI, PRICE, deadline, ERC8004_WORKER);
      dealId = 1;
      await usdcToken.connect(client).approve(await synthPact.getAddress(), PRICE);
      await synthPact.connect(client).acceptOffer(dealId, await usdcToken.getAddress(), PRICE, ERC8004_CLIENT);
    });

    it("refunds USDC after deadline passes", async () => {
      await time.increase(ONE_DAY + 1);
      const clientBefore = await usdcToken.balanceOf(client.address);
      await synthPact.connect(client).claimRefund(dealId);
      const clientAfter = await usdcToken.balanceOf(client.address);

      expect(clientAfter - clientBefore).to.equal(PRICE);
      expect((await synthPact.getDeal(dealId)).status).to.equal(4); // Refunded
    });

    it("reverts if deadline has not passed", async () => {
      await expect(
        synthPact.connect(client).claimRefund(dealId)
      ).to.be.revertedWithCustomError(synthPact, "DeadlineNotPassed");
    });

    it("emits DealRefunded event", async () => {
      await time.increase(ONE_DAY + 1);
      await expect(synthPact.connect(client).claimRefund(dealId))
        .to.emit(synthPact, "DealRefunded").withArgs(dealId, client.address, PRICE);
    });
  });

  // ─── cancelOffer ───────────────────────────────────────────────────────────

  describe("cancelOffer", () => {
    it("cancels an open offer", async () => {
      const deadline = (await time.latest()) + ONE_DAY;
      await synthPact.connect(worker).postOffer(TASK_HASH, TASK_URI, PRICE, deadline, ERC8004_WORKER);
      await synthPact.connect(worker).cancelOffer(1);
      expect((await synthPact.getDeal(1)).status).to.equal(5); // Cancelled
    });

    it("reverts if called by non-worker", async () => {
      const deadline = (await time.latest()) + ONE_DAY;
      await synthPact.connect(worker).postOffer(TASK_HASH, TASK_URI, PRICE, deadline, ERC8004_WORKER);
      await expect(synthPact.connect(client).cancelOffer(1))
        .to.be.revertedWithCustomError(synthPact, "NotWorker");
    });
  });

  // ─── getOpenDeals ──────────────────────────────────────────────────────────

  describe("getOpenDeals", () => {
    it("returns only open deal IDs", async () => {
      const deadline = (await time.latest()) + ONE_DAY;
      await synthPact.connect(worker).postOffer(TASK_HASH, TASK_URI, PRICE, deadline, ERC8004_WORKER);
      await synthPact.connect(worker).postOffer(TASK_HASH, TASK_URI, PRICE, deadline, ERC8004_WORKER);
      await synthPact.connect(worker).cancelOffer(1);

      const open = await synthPact.getOpenDeals();
      expect(open.length).to.equal(1);
      expect(open[0]).to.equal(2);
    });
  });
});
