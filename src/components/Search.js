function Search({ value, onChange }) {
  return (
    <div className="search-box">
      <input
        type="search"
        className="search-box__input"
        placeholder="Enter an address, neighborhood, city, or ZIP code"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />

      {value && (
        <button
          type="button"
          className="search-box__clear"
          onClick={() => onChange("")}
          aria-label="Clear search"
        >
        </button>
      )}
    </div>
  );
}

export default Search;