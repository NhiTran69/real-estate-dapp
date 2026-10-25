# Tài khoản test (chỉ dùng cho local)

> **Cảnh báo:** đây là các key công khai của Hardhat, ai cũng biết. Không gửi tiền thật vào các địa chỉ này và không dùng trên mainnet hay testnet.

## Tóm tắt

| # | Vai trò | Địa chỉ rút gọn | Ghi chú |
|---|---------|-----------------|---------|
| 0 | **Seller** | `0xf39F...2266` | Người bán, deploy contract, sở hữu 3 NFT ban đầu |
| 1 | **Buyer** | `0x7099...79C8` | Người mua, đặt cọc và phê duyệt |
| 2 | **Inspector** | `0x3C44...93BC` | Người kiểm định bất động sản |
| 3 | **Lender** | `0x90F7...b906` | Bên cho vay, nạp tiền bằng depositLoan(id) |
| 4 | **Dự phòng** | `0x15d3...6A65` | Tài khoản thêm để thử nghiệm |

## Chi tiết từng tài khoản

### Tài khoản 0 — Seller

**Địa chỉ**
```
0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```
**Private key**
```
0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### Tài khoản 1 — Buyer

**Địa chỉ**
```
0x70997970C51812dc3A010C7d01b50e0d17dc79C8
```
**Private key**
```
0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
```

### Tài khoản 2 — Inspector

**Địa chỉ**
```
0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
```
**Private key**
```
0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
```

### Tài khoản 3 — Lender

**Địa chỉ**
```
0x90F79bf6EB2c4f870365E785982E1f101E93b906
```
**Private key**
```
0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6
```

### Tài khoản 4 — Dự phòng

**Địa chỉ**
```
0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65
```
**Private key**
```
0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a
```

## Cách import vào MetaMask

1. Thêm network: RPC `http://127.0.0.1:8545`, chainId `31337`, ký hiệu `ETH`.
2. Chọn **Add account → Import account** và dán private key của vai trò cần dùng.
3. Đặt tên tài khoản theo vai trò (Seller, Buyer...) để khỏi nhầm.
4. Nếu restart `npx hardhat node`, vào **Settings → Advanced → Clear activity tab data** để xóa nonce cũ.
