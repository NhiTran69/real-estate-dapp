# Bảng phân công dự án Real Estate DApp

## Cấu trúc thư mục thống nhất

```text
/
├── contracts/
├── scripts/
├── test/
├── abis/
├── docs/
└── src/
    ├── components/
    └── abis/
```

## Giai đoạn 1 — Khởi tạo

Hai người cùng thực hiện:

- Tạo repository Git chung.
- Bổ sung `.gitignore` cho:
  - `node_modules`
  - `.env`
  - cache
  - artifacts
- Chạy `npx hardhat` để khởi tạo project Hardhat.
- Chạy `npx create-react-app` hoặc Vite để khởi tạo frontend trong cùng thư mục.
- Cài đặt các thư viện:
  - `ethers`
  - `hardhat`
  - `@nomiclabs/hardhat-ethers`
  - `chalk`
- Thống nhất cấu trúc thư mục:
  - `/contracts`
  - `/scripts`
  - `/src/components`
  - `/src/abis`
- Tạo hai branch:
  - `feature/contracts` — Người A
  - `feature/frontend` — Người B

## Giai đoạn 2 — Công việc của Người A: Smart Contract

### 2.1. Viết `contracts/Escrow.sol`

- Khai báo các biến và cấu trúc dữ liệu:
  - `nftAddress`
  - `seller`
  - `lender`
  - `inspector`
- Tạo mapping lưu trạng thái:
  - `isListed`
  - `purchasePrice`
  - `escrowAmount`
  - `buyer`
- Tạo các modifier:
  - `onlyBuyer`
  - `onlySeller`
  - `onlyInspector`

### 2.2. Hàm list property

- Viết hàm `list()`:
  - Chuyển NFT vào contract.
  - Thiết lập giá bán.
  - Thiết lập số tiền escrow.
  - Thiết lập buyer.
- Kiểm thử hàm `list()` bằng Hardhat console hoặc script tạm.

### 2.3. Hàm earnest deposit

- Viết hàm `depositEarnest()`:
  - Khai báo `payable`.
  - Kiểm tra `msg.value >= escrowAmount`.
- Viết hàm `getBalance()` để kiểm tra số dư contract.

### 2.4. Hàm hoàn tất hoặc hủy contract

- Viết hàm `updateInspectionStatus()` để inspector duyệt trạng thái kiểm tra.
- Viết hàm `approveSale()` để buyer, seller và lender cùng phê duyệt.
- Viết hàm `finalizeSale()`:
  - Kiểm tra đủ các điều kiện.
  - Chuyển NFT.
  - Chuyển tiền cho các bên liên quan.
- Viết hàm `cancelSale()` để hoàn tiền khi inspection thất bại.

### 2.5. Viết NFT contract `contracts/RealEstate.sol`

- Kế thừa `ERC721`.
- Viết hàm `mint()` với `tokenURI`.
- Metadata có thể được lưu trên IPFS hoặc dùng metadata JSON.

### 2.6. Script deploy và test

- Viết `scripts/deploy.js`:
  - Deploy `RealEstate`.
  - Deploy `Escrow`.
  - Mint sẵn ba property mẫu.
- Viết `test/Escrow.js` để kiểm thử:
  - List.
  - Deposit.
  - Finalize.
  - Cancel.
- Chạy `npx hardhat node` để khởi động local blockchain.
- Deploy lên local network.
- Xuất ABI:
  - `abis/Escrow.json`
  - `abis/RealEstate.json`
- Tạo `config.json` chứa địa chỉ contract theo từng network.

### Bàn giao cho Người B

- `abis/*.json`
- `config.json`
- Địa chỉ của 3–5 tài khoản test.
- Private key của các tài khoản Hardhat node để import vào MetaMask trong môi trường local.

## Giai đoạn 2 — Công việc của Người B: Frontend khung sườn

Phần frontend sử dụng mock data nên không phụ thuộc vào Người A trong giai đoạn này.

### 2.1. Cấu trúc component

- Tạo `src/App.js`:
  - Layout tổng.
  - State quản lý `account`, `provider`, `escrow`.
- Tạo các component:
  - `src/components/Navigation.js`
  - `src/components/Search.js`
  - `src/components/Home.js`
  - `src/components/Card.js`

### 2.2. Navbar

- Hiển thị logo và tên ứng dụng.
- Thêm nút `Connect Wallet` dạng placeholder, chưa cần logic thật.
- Viết CSS responsive cho navbar.

### 2.3. Search bar

- Tạo input tìm kiếm theo tên hoặc địa chỉ property.
- Tạo state lưu giá trị tìm kiếm, chưa cần triển khai lọc thật.

### 2.4. Layout danh sách property bằng mock data

- Tạo `src/mock-properties.json` với 3–5 property mẫu:
  - Tên.
  - Giá.
  - Ảnh.
  - Địa chỉ.
- Viết `Card.js` để hiển thị:
  - Ảnh.
  - Tên.
  - Giá.
  - Địa chỉ.
- Tạo grid layout hiển thị danh sách card.
- Tạo modal hoặc popup xem chi tiết property khi click vào card.

### 2.5. Chuẩn bị kết nối blockchain

Đọc trước các nội dung sau, chưa cần triển khai code:

- `ethers.js`:
  - `BrowserProvider`
  - `Contract`
  - `getSigner`
- Cách xử lý event `accountsChanged` của MetaMask.

## Giai đoạn 3 — Tích hợp

Người B thực hiện chính, Người A hỗ trợ khi cần.

### 3.1. Kết nối blockchain

- Import các file từ Người A:
  - `abis/Escrow.json`
  - `abis/RealEstate.json`
  - `config.json`
- Viết hàm `loadBlockchainData()` trong `src/App.js`:
  - Lấy provider.
  - Kiểm tra network.
  - Khởi tạo contract instance.
- Xử lý nút `Connect Wallet`:
  - Gọi `eth_requestAccounts`.
  - Hiển thị địa chỉ đã kết nối.
- Lắng nghe các event của MetaMask:
  - Đổi account.
  - Đổi network.

### 3.2. Hiển thị property thật

- Thay `src/mock-properties.json` bằng dữ liệu từ NFT contract.
- Đọc `totalSupply()`.
- Lấy `tokenURI` của từng property.
- Fetch metadata JSON gồm tên, ảnh và mô tả.
- Render danh sách property thật trong `Card.js`.

### 3.3. Mua property

Trong modal chi tiết của `Home.js`, hiển thị:

- Giá.
- Trạng thái escrow.
- Buyer.
- Seller.

Các thao tác cần triển khai:

- Nút `Buy` gọi `depositEarnest()`.
- Nút `Inspection Passed`:
  - Chỉ hiển thị cho inspector.
  - Gọi `updateInspectionStatus()`.
- Nút `Approve Sale`:
  - Cho phép buyer, seller và lender thực hiện theo quyền.
  - Gọi `approveSale()`.
- Nút `Finalize Sale`:
  - Chỉ hiển thị khi đủ điều kiện.
  - Gọi `finalizeSale()`.
- Hiển thị trạng thái giao dịch theo thời gian thực:
  - Loading.
  - Success.
  - Failure.

### Công việc song song của Người A

- Chạy sẵn `npx hardhat node` để Người B test.
- Viết thêm script seed dữ liệu, tạo sẵn các giao dịch ở nhiều trạng thái.
- Hỗ trợ xử lý lỗi khi gọi hàm contract:
  - Sai tham số.
  - Sai gas.
  - Sai ABI.

## Giai đoạn 4 — Hoàn thiện

Hai người cùng thực hiện:

- Test luồng đầy đủ:
  - Connect wallet.
  - List.
  - Deposit.
  - Inspect.
  - Approve.
  - Finalize.
- Test trường hợp hủy giao dịch bằng `cancelSale()`.
- Test với nhiều tài khoản:
  - Buyer.
  - Seller.
  - Inspector.
  - Lender.
- Review code chéo:
  - Người A review UI và logic gọi contract.
  - Người B review contract, đặc biệt các kiểm tra quyền và `require`.
- Tối ưu responsive và UI cho mobile.
- Viết README hướng dẫn:
  - Cài đặt.
  - Chạy `hardhat node`.
  - Deploy.
  - Import account vào MetaMask.
- Tùy chọn: deploy lên testnet Sepolia thay vì chỉ chạy local.

## Tiêu chí bàn giao

- Contract compile và test chính chạy thành công.
- ABI và địa chỉ contract được bàn giao cho frontend.
- Frontend chạy được với mock data trước khi tích hợp blockchain.
- Luồng giao dịch chính và trường hợp cancel được kiểm thử với nhiều tài khoản.
- Không commit private key thật hoặc thông tin nhạy cảm vào repository.
