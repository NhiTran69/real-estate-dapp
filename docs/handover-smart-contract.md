## Import tài khoản vào MetaMask (local)
1. Chạy `npx hardhat node` và deploy (xem mục 2).
2. MetaMask → Thêm network thủ công: RPC `http://127.0.0.1:8545`, chainId `31337`, ký hiệu `ETH`.
3. Với mỗi vai trò cần thử: Add account → Import account → dán private key trong `docs/test-accounts.md`.
4. Đặt tên tài khoản theo vai trò (Seller, Buyer...) để khỏi nhầm.
5. Nếu restart `hardhat node`, vào MetaMask → Settings → Advanced → Clear activity tab data
   để xóa nonce cũ, nếu không giao dịch sẽ báo lỗi nonce.