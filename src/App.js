import { useEffect, useMemo, useState } from "react";
import Navigation from "./components/Navigation";
import Search from "./components/Search";
import Home from "./components/Home";
import "./styles.css";
import { ethers } from "ethers";
import escrowAbi from "./abis/Escrow.json";
import realEstateAbi from "./abis/RealEstate.json";
import config from "./config.json";

function App() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [account, setAccount] = useState("");
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [escrow, setEscrow] = useState(null);
  const [realEstate, setRealEstate] = useState(null);
  const [properties, setProperties] = useState([]);

  const filteredProperties = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    if (!term) {
      return properties;
    }

    return properties.filter((property) =>
      [property.name, property.city, property.address]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [properties, searchTerm]);

  const resolveUri = (uri) => {
    if (uri.startsWith("ipfs://")) {
      return `https://ipfs.io/ipfs/${uri.slice(7)}`;
    }

    return uri;
  };

  const loadProperties = async (contract) => {
    const totalSupply = await contract.totalSupply();
    const loadedProperties = [];

    for (let id = 1; id <= totalSupply.toNumber(); id += 1) {
      // lấy url metadata của property từ contract
      const tokenUri = await contract.tokenURI(id);
      // tải metadata từ url
      const response = await fetch(resolveUri(tokenUri));

      if (!response.ok) {
        throw new Error(`Không thể tải metadata của property #${id}`);
      }
      // parse metadata từ json
      const metadata = await response.json();

      // thêm property vào danh sách
      loadedProperties.push({
        id,
        ...metadata,
        image: metadata.image ? resolveUri(metadata.image) : "",
      });
    }

    setProperties(loadedProperties);
  };

  // lắng nghe sự kiện thay đổi tài khoản và mạng từ MetaMask
  useEffect(() => {
    if (!window.ethereum) {
      return undefined;
    }
    const handleAccountsChanged = (accounts) => {
      setAccount(accounts[0] || "");
    };
    const handleChainChanged = () => {
      window.location.reload();
    }
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);
    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, []);
  // chờ dữ liệu 
  const loadBlockchainData = async () => {
    try {
    // đối tượng window.ethereum là một API được cung cấp bởi các trình duyệt hỗ trợ MetaMask, cho phép các ứng dụng web tương tác với blockchain Ethereum
    if (!window.ethereum) {
      throw new Error("MetaMask is not installed.");
    }
    // yêu cầu quyền truy cập vào tài khoản Ethereum của người dùng thông qua MetaMask
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    setAccount(accounts[0]);
    const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
    const network = await web3Provider.getNetwork();
    // lưu địa chỉ contract đã deploy 
    const networkConfig = config[String(network.chainId)];
    if (!networkConfig) {
      throw new Error("Unsupported network.");
    }
    const web3Signer = web3Provider.getSigner();
    const escrowContract = new ethers.Contract(
      networkConfig.escrow.address,
      escrowAbi,
      web3Signer
    );
    const realEstateContract = new ethers.Contract(
      networkConfig.realEstate.address,
      realEstateAbi,
      web3Signer
    );

    await loadProperties(realEstateContract);

    setProvider(web3Provider);
    setSigner(web3Signer);
    setEscrow(escrowContract);
    setRealEstate(realEstateContract);
  } catch (error) {
    console.error("Error loading blockchain data:", error);
  }
  };

  return (
    <div className="app">
      <Navigation account={account} onConnect={loadBlockchainData} />
      <main>
        <section className="hero">
          <div className="hero-content">
            <p className="eyebrow">Real estate, reimagined</p>
            <h1>Find a place you will be proud to own.</h1>
            <p className="hero-description">
              Explore unique properties represented as NFTs and discover a
              simpler way to invest in real estate.
            </p>
            <Search value={searchTerm} onChange={setSearchTerm} />
          </div>
        </section>

        <Home
          properties={filteredProperties}
          selectedProperty={selectedProperty}
          onSelectProperty={setSelectedProperty}
          onClose={() => setSelectedProperty(null)}
          escrow={escrow}
          account={account}
        />
      </main>
      <footer className="footer">Real Estate DApp</footer>
    </div>
  );
}

export default App;