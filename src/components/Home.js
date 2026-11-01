import Card from "./Card";
import { useEffect, useState } from "react";
import { ethers } from "ethers";

function Home({
  properties,
  selectedProperty,
  onSelectProperty,
  onClose,
  escrow,
  account,
}) {
  const [escrowData, setEscrowData] = useState(null);
  const [transactionStatus, setTransactionStatus] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const zeroAddress = ethers.constants.AddressZero.toLowerCase();

  useEffect(() => {
    setEscrowData(null);
    setTransactionStatus("");
    setDepositAmount("");

    const loadEscrowData = async () => {
      if (!escrow || !selectedProperty) {
        return;
      }

      try {
        const tokenId = selectedProperty.id;
        const [
          listed,
          purchasePrice,
          escrowAmount,
          buyer,
          inspectionPassed,
          buyerDeposit,
          paymentCompleted,
          sellerOf,
          inspector,
          saleCompleted,
          completedBuyer,
          completedSeller,
          cancellationReason,
        ] = await Promise.all([
          escrow.isListed(tokenId),
          escrow.purchasePrice(tokenId),
          escrow.escrowAmount(tokenId),
          escrow.buyer(tokenId),
          escrow.inspectionPassed(tokenId),
          escrow.buyerDeposit(tokenId),
          escrow.paymentCompleted(tokenId),
          escrow.sellerOf(tokenId),
          escrow.inspector(),
          escrow.saleCompleted(tokenId),
          escrow.completedBuyer(tokenId),
          escrow.completedSeller(tokenId),
          escrow.cancellationReason(tokenId),
        ]);
        const sellerApproved = await escrow.approval(tokenId, sellerOf);

        setEscrowData({
          listed,
          purchasePrice: ethers.utils.formatEther(purchasePrice),
          escrowAmount: ethers.utils.formatEther(escrowAmount),
          buyer,
          inspectionPassed,
          buyerDeposit,
          paymentCompleted,
          seller: sellerOf,
          inspector,
          sellerApproved,
          saleCompleted,
          completedBuyer,
          completedSeller,
          cancellationReason: Number(cancellationReason),
        });
      } catch (error) {
        console.error("Error loading escrow data:", error);
        setTransactionStatus(
          error.reason || error.message || "Không thể tải dữ liệu escrow."
        );
      }
    };

    loadEscrowData();
  }, [escrow, selectedProperty, account]);

  const hasBuyer =
    Boolean(escrowData?.buyer) &&
    escrowData.buyer.toLowerCase() !== zeroAddress;
  const isCurrentBuyer =
    hasBuyer &&
    Boolean(account) &&
    escrowData.buyer.toLowerCase() === account.toLowerCase();
  const isCurrentSeller =
    Boolean(escrowData?.seller) &&
    Boolean(account) &&
    escrowData.seller.toLowerCase() === account.toLowerCase();
  const isCompletedBuyer =
    escrowData?.saleCompleted &&
    Boolean(account) &&
    escrowData.completedBuyer.toLowerCase() === account.toLowerCase();
  const isCompletedSeller =
    escrowData?.saleCompleted &&
    Boolean(account) &&
    escrowData.completedSeller.toLowerCase() === account.toLowerCase();
  const isCompletedInspector =
    escrowData?.saleCompleted &&
    Boolean(account) &&
    escrowData.inspector.toLowerCase() === account.toLowerCase();
  const hasRemainingBalance =
    escrowData &&
    ethers.utils
      .parseEther(escrowData.purchasePrice)
      .gt(escrowData.buyerDeposit);
  const isListed = escrowData?.listed === true;
  const displayPrice = isListed
    ? escrowData.purchasePrice
    : selectedProperty?.price;

  const waitForSuccessfulTransaction = async (transaction) => {
    try {
      const receipt = await transaction.wait();
      const confirmedReceipt = await escrow.provider.getTransactionReceipt(
        transaction.hash
      );
      const status = confirmedReceipt?.status ?? receipt?.status;

      if (status !== 1) {
        throw new Error(
          `Giao dịch thất bại trên blockchain (hash: ${transaction.hash}).`
        );
      }

      return confirmedReceipt || receipt;
    } catch (error) {
      const receipt = error.receipt;
      if (receipt && receipt.status !== 1) {
        throw new Error(
          `Giao dịch thất bại trên blockchain (hash: ${receipt.transactionHash}).`
        );
      }
      throw error;
    }
  };

  const setTransactionFailure = (error, fallbackMessage) => {
    console.error(error);
    setTransactionStatus(
      error?.reason || error?.data?.message || error?.message || fallbackMessage
    );
  };

  const verifyDepositState = async (expectedDeposit) => {
    const tokenId = selectedProperty.id;
    const [buyer, buyerDeposit] = await Promise.all([
      escrow.buyer(tokenId),
      escrow.buyerDeposit(tokenId),
    ]);

    if (
      buyer.toLowerCase() !== account.toLowerCase() ||
      !buyerDeposit.eq(expectedDeposit)
    ) {
      throw new Error("Blockchain chưa ghi nhận khoản thanh toán.");
    }
  };

  const verifyApprovalState = async () => {
    const approved = await escrow.approval(
      selectedProperty.id,
      escrowData.seller
    );
    if (!approved) {
      throw new Error("Blockchain chưa ghi nhận seller approve.");
    }
  };

  const verifyInspectionState = async () => {
    if (!(await escrow.inspectionPassed(selectedProperty.id))) {
      throw new Error("Blockchain chưa ghi nhận inspection thành công.");
    }
  };

  const verifyFinalizedState = async () => {
    if (!(await escrow.saleCompleted(selectedProperty.id))) {
      throw new Error("Blockchain chưa ghi nhận finalize thành công.");
    }
  };

  const verifyCancelledState = async () => {
    const [listed, reason] = await Promise.all([
      escrow.isListed(selectedProperty.id),
      escrow.cancellationReason(selectedProperty.id),
    ]);
    if (listed || Number(reason) === 0) {
      throw new Error("Blockchain chưa ghi nhận hủy giao dịch.");
    }
  };

  const ensureNativeBalance = async (value) => {
    const balance = await escrow.provider.getBalance(account);
    const feeData = await escrow.provider.getFeeData();
    const gasPrice = feeData.gasPrice || feeData.maxFeePerGas;
    const gasLimit = await escrow.estimateGas.depositEarnest(
      selectedProperty.id,
      { value }
    );
    const estimatedFee = gasPrice
      ? gasLimit.mul(gasPrice)
      : ethers.constants.Zero;

    if (balance.lt(value.add(estimatedFee))) {
      throw new Error(
        `Không đủ ETH để trả tiền và phí gas. Cần khoảng ${ethers.utils.formatEther(
          value.add(estimatedFee)
        )} ETH, hiện có ${ethers.utils.formatEther(balance)} ETH.`
      );
    }
  };

  const handleBuy = async () => {
    try {
      setTransactionStatus("");
      setTransactionStatus("Handling purchase...");
      const amount = ethers.utils.parseEther(escrowData.purchasePrice);
      await ensureNativeBalance(amount);
      const transaction = await escrow.depositEarnest(
        selectedProperty.id,
        { value: amount }
      );
      setTransactionStatus("Waiting for transaction confirmation...");
      await waitForSuccessfulTransaction(transaction);
      await verifyDepositState(ethers.utils.parseEther(escrowData.purchasePrice));
      await reloadEscrowData();
      setTransactionStatus("Deposit thành công. Vui lòng chờ seller approve.");
    } catch (error) {
      setTransactionFailure(error, "Giao dịch mua thất bại.");
    }
  };

  const handleInitialDeposit = async () => {
    setTransactionStatus("");
    if (!depositAmount || Number(depositAmount) <= 0) {
      setTransactionStatus("Nhập số ETH muốn đặt cọc.");
      return;
    }

    let amount;
    try {
      amount = ethers.utils.parseEther(depositAmount);
    } catch (error) {
      setTransactionStatus("Số tiền deposit không hợp lệ.");
      return;
    }

    const remaining = ethers.utils
      .parseEther(escrowData.purchasePrice)
      .sub(escrowData.buyerDeposit);

    if (amount.gt(remaining)) {
      setTransactionStatus("Deposit không được vượt quá số tiền còn lại.");
      return;
    }

    await handleDeposit(
      amount,
      "Deposit successful. Pay the remaining amount to continue."
    );
  };

  const reloadEscrowData = async () => {
    if (!escrow || !selectedProperty) {
      return;
    }

    const tokenId = selectedProperty.id;
    const [
      listed,
      purchasePrice,
      escrowAmount,
      buyer,
      inspectionPassed,
      buyerDeposit,
      paymentCompleted,
      sellerOf,
      inspector,
      saleCompleted,
      completedBuyer,
      completedSeller,
      cancellationReason,
    ] = await Promise.all([
      escrow.isListed(tokenId),
      escrow.purchasePrice(tokenId),
      escrow.escrowAmount(tokenId),
      escrow.buyer(tokenId),
      escrow.inspectionPassed(tokenId),
      escrow.buyerDeposit(tokenId),
      escrow.paymentCompleted(tokenId),
      escrow.sellerOf(tokenId),
      escrow.inspector(),
      escrow.saleCompleted(tokenId),
      escrow.completedBuyer(tokenId),
      escrow.completedSeller(tokenId),
      escrow.cancellationReason(tokenId),
    ]);
    const sellerApproved = await escrow.approval(tokenId, sellerOf);

    setEscrowData({
      listed,
      purchasePrice: ethers.utils.formatEther(purchasePrice),
      escrowAmount: ethers.utils.formatEther(escrowAmount),
      buyer,
      inspectionPassed,
      buyerDeposit,
      paymentCompleted,
      seller: sellerOf,
      inspector,
      sellerApproved,
      saleCompleted,
      completedBuyer,
      completedSeller,
      cancellationReason: Number(cancellationReason),
    });
  };

  const handleDeposit = async (value, successMessage) => {
    try {
      setTransactionStatus("");
      setTransactionStatus("Đang gửi giao dịch...");
      await ensureNativeBalance(value);
      const transaction = await escrow.depositEarnest(
        selectedProperty.id,
        { value }
      );
      setTransactionStatus(`Đang kiểm tra giao dịch ${transaction.hash}...`);
      await waitForSuccessfulTransaction(transaction);
      await verifyDepositState(escrowData.buyerDeposit.add(value));
      await reloadEscrowData();
      setTransactionStatus(successMessage);
      return true;
    } catch (error) {
      setTransactionFailure(error, "Giao dịch thất bại.");
      return false;
    }
  };

  const handlePayRemaining = async () => {
    setTransactionStatus("");
    if (escrowData.paymentCompleted) {
      setTransactionStatus("Đã thanh toán đủ giá property.");
      return;
    }

    const price = ethers.utils.parseEther(escrowData.purchasePrice);
    const deposited = escrowData.buyerDeposit;
    const remaining = price.gt(deposited) ? price.sub(deposited) : ethers.constants.Zero;

    if (remaining.isZero()) {
      setTransactionStatus("Đã thanh toán đủ giá property.");
      return;
    }

    const paymentSucceeded = await handleDeposit(
      remaining,
      "Đã thanh toán phần còn lại."
    );

    if (!paymentSucceeded) {
      const cancelSucceeded = await handleCancel();
      if (!cancelSucceeded) {
        setTransactionStatus(
          "Pay remaining thất bại. Không thể tự động hủy giao dịch; không được tiếp tục các bước sau."
        );
        return;
      }
      setTransactionStatus(
        "Pay remaining thất bại. Giao dịch đã bị hủy, không phải thanh toán thành công."
      );
    }
  };

  const handleApprove = async () => {
    try {
      setTransactionStatus("");
      setTransactionStatus("Đang gửi approve...");
      const transaction = await escrow.approveSale(selectedProperty.id);
      await waitForSuccessfulTransaction(transaction);
      await verifyApprovalState();
      await reloadEscrowData();
      setTransactionStatus("Approve thành công.");
    } catch (error) {
      console.error("Approve failed:", error);
      setTransactionStatus(
        error.reason || error.message || "Approve thất bại."
      );
    }
  };

  const handleInspection = async () => {
    try {
      setTransactionStatus("");
      setTransactionStatus("Đang cập nhật inspection...");
      const transaction = await escrow.updateInspectionStatus(
        selectedProperty.id,
        true
      );
      await waitForSuccessfulTransaction(transaction);
      await verifyInspectionState();
      await reloadEscrowData();
      setTransactionStatus("Inspection đã đạt.");
    } catch (error) {
      console.error("Inspection failed:", error);
      setTransactionStatus(
        error.reason || error.message || "Inspection thất bại."
      );
    }
  };

  const handleFinalize = async () => {
    try {
      setTransactionStatus("");
      setTransactionStatus("Đang hoàn tất giao dịch...");
      const transaction = await escrow.finalizeSale(selectedProperty.id);
      await waitForSuccessfulTransaction(transaction);
      await verifyFinalizedState();
      await reloadEscrowData();
      setTransactionStatus("Giao dịch đã hoàn tất.");
    } catch (error) {
      console.error("Finalize failed:", error);
      setTransactionStatus(
        error.reason || error.message || "Không thể hoàn tất giao dịch."
      );
    }
  };

  const handleCancel = async () => {
    try {
      setTransactionStatus("");
      setTransactionStatus("Đang hủy giao dịch...");
      const transaction = await escrow.cancelSale(selectedProperty.id);
      await waitForSuccessfulTransaction(transaction);
      await verifyCancelledState();
      await reloadEscrowData();
      setTransactionStatus("Đã hủy giao dịch và hoàn tiền cho buyer.");
      return true;
    } catch (error) {
      console.error("Cancel failed:", error);
      setTransactionStatus(
        error.reason || error.message || "Không thể hủy giao dịch."
      );
      return false;
    }
  };

  return (
    <section className="cards__section" id="properties">
      <h3>Homes For You</h3>

      <hr />

      <div className="cards">
        {properties.map((property) => (
          <Card
            key={property.id}
            property={property}
            onSelect={onSelectProperty}
          />
        ))}
      </div>

      {selectedProperty && (
        <div className="home" onClick={onClose}>
          <div
            className="home__details"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="home__close"
              type="button"
              onClick={onClose}
            >
              ×
            </button>

            <div className="home__image">
              <img
                src={selectedProperty.image}
                alt={selectedProperty.name}
              />
            </div>

            <div className="home__overview">
              <h1>{selectedProperty.name}</h1>
              <h2>
                {escrowData
                  ?                   `${displayPrice} ETH`
                  : "Đang tải giá..."}
              </h2>
              <p>{selectedProperty.address}</p>
              <p>{selectedProperty.description}</p>

              {isCurrentSeller && hasBuyer && (
                <p>
                  Buyer: <code>{escrowData.buyer}</code>
                </p>
              )}

              {escrowData && !isListed && (
                <p>
                  {escrowData.cancellationReason === 1
                    ? "Seller đã từ chối bán property này."
                    : escrowData.cancellationReason === 2
                      ? "Buyer đã hủy giao dịch property này."
                      : escrowData.cancellationReason === 3
                        ? "Inspector đã hủy giao dịch property này."
                        : escrowData.saleCompleted
                          ? "Giao dịch đã hoàn tất."
                          : "Property này không còn được rao bán."}
                </p>
              )}

              {escrowData?.saleCompleted && isCompletedBuyer && (
                <p>Giao dịch thành công: bạn đã mua property này.</p>
              )}

              {escrowData?.saleCompleted && isCompletedSeller && (
                <p>Giao dịch thành công: bạn đã bán property này.</p>
              )}

              {escrowData?.saleCompleted && isCompletedInspector && (
                <p>Giao dịch thành công: bạn đã hoàn tất giao dịch với vai trò inspector.</p>
              )}

              {transactionStatus && <p>{transactionStatus}</p>}

              <ul>
                <li>{selectedProperty.bedrooms} bedrooms</li>
                <li>{selectedProperty.bathrooms} bathrooms</li>
                <li>{selectedProperty.area} sqft</li>
              </ul>

              <div className="home__actions">
                {isListed && !hasBuyer && !isCurrentSeller && (
                    <>
                      <button
                        className="home__buy"
                        type="button"
                        onClick={handleBuy}
                        disabled={
                          !escrow ||
                          !escrowData.listed ||
                          !account
                        }
                      >
                        Buy
                      </button>

                      <button
                        className="home__buy"
                        type="button"
                        onClick={handleInitialDeposit}
                        disabled={
                          !escrow ||
                          !escrowData.listed ||
                          !account
                        }
                      >
                        Deposit
                      </button>
                    </>
                  )}

                {isListed && !hasBuyer && !isCurrentSeller && (
                  <input
                    className="home__deposit-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={depositAmount}
                    onChange={(event) => setDepositAmount(event.target.value)}
                    placeholder="Deposit ETH"
                    aria-label="Deposit amount in ETH"
                  />
                )}

                {isListed &&
                  isCurrentBuyer &&
                  hasRemainingBalance &&
                  !escrowData.paymentCompleted &&
                  escrowData.sellerApproved && (
                    <button
                      className="home__buy"
                      type="button"
                      onClick={handlePayRemaining}
                    >
                      Pay remaining
                    </button>
                  )}

                {isListed &&
                  isCurrentBuyer &&
                  hasRemainingBalance &&
                  !escrowData.paymentCompleted &&
                  !escrowData.sellerApproved && (
                    <p>Đã deposit. Vui lòng chờ seller approve trước khi trả tiếp.</p>
                  )}

                {isListed &&
                  hasBuyer &&
                  escrowData.inspector.toLowerCase() ===
                    account.toLowerCase() && (
                    <button
                      className="home__buy"
                      type="button"
                      onClick={handleInspection}
                      disabled={escrowData.inspectionPassed}
                    >
                      Inspection passed
                    </button>
                  )}

                {isListed &&
                    hasBuyer &&
                    escrowData.buyerDeposit.gte(
                      ethers.utils.parseEther(escrowData.escrowAmount)
                    ) &&
                    escrowData.seller.toLowerCase() === account.toLowerCase() &&
                    !escrowData.sellerApproved && (
                    <button
                    className="home__buy"
                    type="button"
                    onClick={handleApprove}
                    >
                    Approve as seller
                    </button>
                  )}

                {isListed &&
                  hasBuyer &&
                  escrowData.inspector.toLowerCase() ===
                    account.toLowerCase() &&
                  escrowData.inspectionPassed &&
                  escrowData.sellerApproved && (
                    <button
                      className="home__buy"
                      type="button"
                      onClick={handleFinalize}
                    >
                      Finalize sale
                    </button>
                  )}

                {isListed &&
                  hasBuyer &&
                  isCurrentSeller &&
                  !escrowData.inspectionPassed &&
                  !escrowData.sellerApproved && (
                    <button
                      className="home__buy"
                      type="button"
                      onClick={handleCancel}
                    >
                      Reject sale
                    </button>
                  )}

                {isListed &&
                  hasBuyer &&
                  escrowData.inspector.toLowerCase() ===
                    account.toLowerCase() &&
                  !escrowData.inspectionPassed &&
                  !escrowData.sellerApproved && (
                    <button
                      className="home__buy"
                      type="button"
                      onClick={handleCancel}
                    >
                      Inspector reject
                    </button>
                  )}

                <button className="home__contact" type="button">
                  Contact agent
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default Home;