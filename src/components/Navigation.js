function Navigation({ account, onConnect }) {
  const shortAccount = account
    ? `${account.substring(0, 6)}...${account.substring(account.length - 4)}`
    : "";

  return (
    <nav className="navigation">
      <ul className="navigation__links">
        <li>
          <a href="#properties">Buy</a>
        </li>
        <li>
          <a href="#properties">Rent</a>
        </li>
        <li>
          <a href="#properties">Sell</a>
        </li>
      </ul>

      <a className="navigation__brand" href="/">
        <span className="navigation__logo">⌂</span>
        <span>Real Estate</span>
      </a>

      <button
        type="button"
        className="navigation__connect"
        onClick={onConnect}
      >
        {shortAccount || "Connect"}
      </button>
    </nav>
  );
}

export default Navigation;