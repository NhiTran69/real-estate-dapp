// Chạy: npx hardhat test
const { ethers } = require("hardhat");
const assert = require("assert");

const parseEther = ethers.parseEther || ethers.utils.parseEther;
const addressOf = (c) => c.target || c.address;
const waitDeploy = (c) =>
  c.waitForDeployment ? c.waitForDeployment() : c.deployed();
const big = (x) => BigInt(x.toString());
const eth = (n) => big(parseEther(String(n)));
const balanceOf = async (addr) => big(await ethers.provider.getBalance(addr));
const send = async (tx) => (await tx).wait();

async function expectRevert(promise, reason) {
  let error;
  try {
    await promise;
  } catch (e) {
    error = e;
  }
  assert.ok(error, "Giao dịch lẽ ra phải bị revert nhưng đã thành công");
  if (reason) {
    assert.ok(
      error.message.includes(reason),
      `Mong đợi "${reason}" nhưng nhận: ${error.message}`
    );
  }
}

describe("Escrow", () => {
  const NFT_ID = 1;
  const PRICE = 10;
  const ESCROW = 5;

  let seller, buyer, inspector, lender, stranger;
  let realEstate, escrow;

  // --- helper ---
  const list = () =>
    send(
      escrow
        .connect(seller)
        .list(NFT_ID, buyer.address, parseEther(String(PRICE)), parseEther(String(ESCROW)))
    );
  const deposit = (amount) =>
    send(escrow.connect(buyer).depositEarnest(NFT_ID, { value: parseEther(String(amount)) }));
  const loan = (amount) =>
    send(escrow.connect(lender).depositLoan(NFT_ID, { value: parseEther(String(amount)) }));
  const approveAll = async () => {
    for (const s of [buyer, seller, lender]) {
      await send(escrow.connect(s).approveSale(NFT_ID));
    }
  };

  beforeEach(async () => {
    [seller, buyer, inspector, lender, stranger] = await ethers.getSigners();

    const RealEstate = await ethers.getContractFactory("RealEstate");
    realEstate = await RealEstate.deploy();
    await waitDeploy(realEstate);
    await send(realEstate.connect(seller).mint("ipfs://test/1.json"));

    const Escrow = await ethers.getContractFactory("Escrow");
    escrow = await Escrow.deploy(
      addressOf(realEstate), seller.address, inspector.address, lender.address
    );
    await waitDeploy(escrow);

    await send(realEstate.connect(seller).approve(addressOf(escrow), NFT_ID));
  });

  describe("list", () => {
    it("chuyển NFT vào Escrow và lưu thông tin", async () => {
      await list();
      assert.strictEqual(await realEstate.ownerOf(NFT_ID), addressOf(escrow));
      assert.strictEqual(await escrow.isListed(NFT_ID), true);
      assert.strictEqual(big(await escrow.purchasePrice(NFT_ID)), eth(PRICE));
      assert.strictEqual(big(await escrow.escrowAmount(NFT_ID)), eth(ESCROW));
      assert.strictEqual(await escrow.buyer(NFT_ID), buyer.address);
    });

    it("chỉ seller được list", async () => {
      await expectRevert(
        escrow.connect(stranger).list(NFT_ID, buyer.address, parseEther("10"), parseEther("5")),
        "Only seller"
      );
    });

    it("không cho list trùng", async () => {
      await list();
      await expectRevert(list(), "NFT is already listed");
    });

    it("từ chối buyer rỗng và tiền cọc lớn hơn giá", async () => {
      const zero = "0x0000000000000000000000000000000000000000";
      await expectRevert(
        escrow.connect(seller).list(NFT_ID, zero, parseEther("10"), parseEther("5")),
        "Buyer address cannot be zero"
      );
      await expectRevert(
        escrow.connect(seller).list(NFT_ID, buyer.address, parseEther("10"), parseEther("11")),
        "Escrow amount cannot exceed purchase price"
      );
    });
  });

  describe("deposit", () => {
    beforeEach(list);

    it("buyer cọc đủ thì contract nhận tiền", async () => {
      await deposit(ESCROW);
      assert.strictEqual(big(await escrow.getBalance()), eth(ESCROW));
      assert.strictEqual(big(await escrow.buyerDeposit(NFT_ID)), eth(ESCROW));
    });

    it("từ chối cọc thiếu", async () => {
      await expectRevert(deposit(2), "Deposit below escrow amount");
    });

    it("người không phải buyer không cọc được", async () => {
      await expectRevert(
        escrow.connect(stranger).depositEarnest(NFT_ID, { value: parseEther("5") }),
        "Only buyer"
      );
    });

    it("chỉ lender được nạp tiền vay", async () => {
      await loan(PRICE - ESCROW);
      assert.strictEqual(big(await escrow.lenderDeposit(NFT_ID)), eth(PRICE - ESCROW));
      await expectRevert(
        escrow.connect(stranger).depositLoan(NFT_ID, { value: parseEther("5") }),
        "Only lender"
      );
    });
  });

  describe("inspection và approve", () => {
    beforeEach(list);

    it("chỉ inspector cập nhật kiểm định", async () => {
      await send(escrow.connect(inspector).updateInspectionStatus(NFT_ID, true));
      assert.strictEqual(await escrow.inspectionPassed(NFT_ID), true);
      await expectRevert(
        escrow.connect(stranger).updateInspectionStatus(NFT_ID, true),
        "Only inspector"
      );
    });

    it("chỉ buyer, seller, lender được phê duyệt", async () => {
      await expectRevert(
        escrow.connect(stranger).approveSale(NFT_ID),
        "Not a party of this sale"
      );
    });
  });

  describe("finalize", () => {
    beforeEach(list);

    it("hoàn tất: NFT về buyer, seller nhận đúng giá", async () => {
      await deposit(ESCROW);
      await loan(PRICE - ESCROW);
      await send(escrow.connect(inspector).updateInspectionStatus(NFT_ID, true));
      await approveAll();

      const before = await balanceOf(seller.address);
      await send(escrow.connect(stranger).finalizeSale(NFT_ID)); // người gọi trả gas
      const after = await balanceOf(seller.address);

      assert.strictEqual(after - before, eth(PRICE));
      assert.strictEqual(await realEstate.ownerOf(NFT_ID), buyer.address);
      assert.strictEqual(big(await escrow.getBalance()), 0n);
      assert.strictEqual(await escrow.isListed(NFT_ID), false);
    });

    it("hoàn lại tiền dư cho buyer", async () => {
      await deposit(ESCROW);
      await loan(8); // tổng 13, giá 10 -> dư 3
      await send(escrow.connect(inspector).updateInspectionStatus(NFT_ID, true));
      await approveAll();

      const before = await balanceOf(buyer.address);
      await send(escrow.connect(stranger).finalizeSale(NFT_ID));
      const after = await balanceOf(buyer.address);

      assert.strictEqual(after - before, eth(3));
    });

    it("từ chối khi kiểm định chưa đạt", async () => {
      await deposit(ESCROW);
      await loan(PRICE - ESCROW);
      await approveAll();
      await expectRevert(escrow.finalizeSale(NFT_ID), "Inspection not passed");
    });

    it("từ chối khi thiếu phê duyệt", async () => {
      await deposit(ESCROW);
      await loan(PRICE - ESCROW);
      await send(escrow.connect(inspector).updateInspectionStatus(NFT_ID, true));
      await send(escrow.connect(buyer).approveSale(NFT_ID));
      await send(escrow.connect(seller).approveSale(NFT_ID));
      await expectRevert(escrow.finalizeSale(NFT_ID), "Lender not approved");
    });

    it("từ chối khi thiếu tiền", async () => {
      await deposit(ESCROW); // chưa có tiền vay
      await send(escrow.connect(inspector).updateInspectionStatus(NFT_ID, true));
      await approveAll();
      await expectRevert(escrow.finalizeSale(NFT_ID), "Insufficient funds");
    });
  });

  describe("cancel", () => {
    beforeEach(list);

    it("hoàn tiền cả hai bên và trả NFT về seller", async () => {
      await deposit(ESCROW);
      await loan(PRICE - ESCROW);
      await send(escrow.connect(inspector).updateInspectionStatus(NFT_ID, false));

      const buyerBefore = await balanceOf(buyer.address);
      const lenderBefore = await balanceOf(lender.address);
      await send(escrow.connect(seller).cancelSale(NFT_ID));

      assert.strictEqual((await balanceOf(buyer.address)) - buyerBefore, eth(ESCROW));
      assert.strictEqual((await balanceOf(lender.address)) - lenderBefore, eth(PRICE - ESCROW));
      assert.strictEqual(await realEstate.ownerOf(NFT_ID), seller.address);
      assert.strictEqual(big(await escrow.getBalance()), 0n);
      assert.strictEqual(await escrow.isListed(NFT_ID), false);
    });

    it("người ngoài không được hủy", async () => {
      await expectRevert(escrow.connect(stranger).cancelSale(NFT_ID), "Not authorized");
    });

    it("không hủy được khi kiểm định đã đạt", async () => {
      await send(escrow.connect(inspector).updateInspectionStatus(NFT_ID, true));
      await expectRevert(
        escrow.connect(seller).cancelSale(NFT_ID),
        "Inspection already passed"
      );
    });

    it("sau khi hủy có thể niêm yết lại (dữ liệu cũ đã xóa)", async () => {
      await send(escrow.connect(seller).cancelSale(NFT_ID));
      assert.strictEqual(await escrow.inspectionPassed(NFT_ID), false);
      await send(realEstate.connect(seller).approve(addressOf(escrow), NFT_ID));
      await list();
      assert.strictEqual(await escrow.isListed(NFT_ID), true);
    });
  });
});