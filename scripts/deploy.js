// Chạy: npx hardhat run scripts/deploy.js --network localhost
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const { ethers } = hre;

// Hỗ trợ cả ethers v5 và v6
const parseEther = ethers.parseEther || ethers.utils.parseEther;
const addressOf = (c) => c.target || c.address;
const waitDeploy = (c) =>
  c.waitForDeployment ? c.waitForDeployment() : c.deployed();

// Nơi xuất file cho frontend (React chỉ import được từ src/)
const ABI_DIR = path.join(__dirname, "..", "src", "abis");
const CONFIG_PATH = path.join(__dirname, "..", "src", "config.json");

// TODO: thay bằng CID metadata thật (hoặc thư mục metadata của nhóm)
const BASE_URI = "ipfs://REPLACE_WITH_CID";

// 3 property mẫu: giá bán và tiền cọc (ETH)
const PROPERTIES = [
  { price: "20", escrow: "10" },
  { price: "15", escrow: "5" },
  { price: "10", escrow: "5" },
];
const LIST_ON_DEPLOY = true; // niêm yết sẵn để frontend có dữ liệu

async function exportAbi(name) {
  const artifact = await hre.artifacts.readArtifact(name);
  fs.mkdirSync(ABI_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(ABI_DIR, `${name}.json`),
    JSON.stringify(artifact.abi, null, 2)
  );
}

async function main() {
  const [seller, buyer, inspector, lender] = await ethers.getSigners();
  const { chainId } = await ethers.provider.getNetwork();
  console.log(`Network chainId: ${chainId}`);

  // 1. Deploy RealEstate
  const RealEstate = await ethers.getContractFactory("RealEstate");
  const realEstate = await RealEstate.deploy();
  await waitDeploy(realEstate);
  console.log("RealEstate:", addressOf(realEstate));

  // 2. Mint 3 property cho seller
  for (let i = 0; i < PROPERTIES.length; i++) {
    const uri = `${BASE_URI}/${i + 1}.json`;
    await (await realEstate.connect(seller).mint(uri)).wait();
  }
  console.log(`Đã mint ${PROPERTIES.length} property`);

  // 3. Deploy Escrow
  const Escrow = await ethers.getContractFactory("Escrow");
  const escrow = await Escrow.deploy(
    addressOf(realEstate),
    seller.address,
    inspector.address,
    lender.address
  );
  await waitDeploy(escrow);
  console.log("Escrow    :", addressOf(escrow));

  // 4. Approve và niêm yết
  if (LIST_ON_DEPLOY) {
    for (let i = 0; i < PROPERTIES.length; i++) {
      const id = i + 1;
      const { price, escrow: deposit } = PROPERTIES[i];
      await (await realEstate.connect(seller).approve(addressOf(escrow), id)).wait();
      await (
        await escrow
          .connect(seller)
          .list(id, buyer.address, parseEther(price), parseEther(deposit))
      ).wait();
    }
    console.log("Đã niêm yết 3 property");
  }

  // 5. Xuất ABI và cập nhật config.json
  await exportAbi("Escrow");
  await exportAbi("RealEstate");

  let config = {};
  try {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch (e) {
    // file chưa có hoặc rỗng -> bắt đầu từ object trống
  }
  config[String(chainId)] = {
    realEstate: { address: addressOf(realEstate) },
    escrow: { address: addressOf(escrow) },
  };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log("Đã xuất src/abis/*.json và src/config.json");

  console.log("\nVai trò (Hardhat accounts):");
  console.log("  seller    :", seller.address);
  console.log("  buyer     :", buyer.address);
  console.log("  inspector :", inspector.address);
  console.log("  lender    :", lender.address);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});