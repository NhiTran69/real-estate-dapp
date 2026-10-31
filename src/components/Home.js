import Card from "./Card";
function Home({
  properties,
  selectedProperty,
  onSelectProperty,
  onClose
}) {
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
              <h2>{selectedProperty.price} ETH</h2>
              <p>{selectedProperty.address}</p>
              <p>{selectedProperty.description}</p>

              <ul>
                <li>{selectedProperty.bedrooms} bedrooms</li>
                <li>{selectedProperty.bathrooms} bathrooms</li>
                <li>{selectedProperty.area} sqft</li>
              </ul>

              <div className="home__actions">
                <button className="home__buy" type="button" disabled>
                  Buy
                </button>

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