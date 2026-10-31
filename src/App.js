import { useMemo, useState } from "react";
import Navigation from "./components/Navigation";
import Search from "./components/Search";
import Home from "./components/Home";
import properties from "./mock-properties.json";
import "./styles.css";

function App() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [account, setAccount] = useState("");

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
  }, [searchTerm]);

  const handleConnectWallet = () => {
    setAccount("Wallet placeholder");
  };

  return (
    <div className="app">
      <Navigation account={account} onConnect={handleConnectWallet} />
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
        />
      </main>
      <footer className="footer">Real Estate DApp</footer>
    </div>
  );
}

export default App;