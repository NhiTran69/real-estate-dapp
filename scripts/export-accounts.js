// Chạy: npx hardhat run scripts/export-accounts.js
// Xuất 5 tài khoản test mặc định của Hardhat ra docs/test-accounts.md
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const { ethers } = hre;

const ROLES = [
  { name: "Seller", note: "Người bán, deploy contract, sở hữu 3 NFT ban đầu" },
  { name: "Buyer", note: "Người mua, đặt cọc và phê duyệt" },
  { name: "Inspector", note: "Người kiểm định bất động sản" },
  { name: "Lender", note: "Bên cho vay, nạp tiền bằng depositLoan(id)" },
  { name: "Dự phòng", note: "Tài khoản thêm để thử nghiệm" },
];

function deriveWallet(mnemonic, index) {
  const hdPath = `m/44'/60'/0'/0/${index}`;
  if (ethers.HDNodeWallet) {
    // ethers v6
    return ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, hdPath);
  }
  // ethers v5
  return ethers.Wallet.fromMnemonic(mnemonic, hdPath);
}

async function main() {
  const cfg = hre.config.networks.hardhat.accounts;
  if (!cfg || !cfg.mnemonic) {
    throw new Error("hardhat.config.js đang dùng accounts tùy chỉnh, không có mnemonic mặc định");
  }

  const wallets = ROLES.map((_, i) => deriveWallet(cfg.mnemonic, i));
  const short = (a) => `${a.slice(0, 6)}...${a.slice(-4)}`;

  const lines = [
    "# Tài khoản test (chỉ dùng cho local)",
    "",
    "> **Cảnh báo:** đây là các key công khai của Hardhat, ai cũng biết. Không gửi tiền thật vào các địa chỉ này và không dùng trên mainnet hay testnet.",
    "",
    "## Tóm tắt",
    "",
    "| # | Vai trò | Địa chỉ rút gọn | Ghi chú |",
    "|---|---------|-----------------|---------|",
  ];

  ROLES.forEach((r, i) => {
    lines.push(`| ${i} | **${r.name}** | \`${short(wallets[i].address)}\` | ${r.note} |`);
  });

  lines.push("", "## Chi tiết từng tài khoản", "");

  ROLES.forEach((r, i) => {
    lines.push(
      `### Tài khoản ${i} — ${r.name}`,
      "",
      "**Địa chỉ**",
      "```",
      wallets[i].address,
      "```",
      "**Private key**",
      "```",
      wallets[i].privateKey,
      "```",
      ""
    );
  });

  lines.push(
    "## Cách import vào MetaMask",
    "",
    "1. Thêm network: RPC `http://127.0.0.1:8545`, chainId `31337`, ký hiệu `ETH`.",
    "2. Chọn **Add account → Import account** và dán private key của vai trò cần dùng.",
    "3. Đặt tên tài khoản theo vai trò (Seller, Buyer...) để khỏi nhầm.",
    "4. Nếu restart `npx hardhat node`, vào **Settings → Advanced → Clear activity tab data** để xóa nonce cũ.",
    ""
  );

  const out = path.join(__dirname, "..", "docs", "test-accounts.md");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, lines.join("\n"));
  console.log("Đã ghi", out);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});