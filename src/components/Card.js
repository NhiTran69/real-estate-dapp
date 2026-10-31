function Card({ property, onSelect }) {
  return (
    <article className="card" onClick={() => onSelect(property)}>
      <div className="card__image">
        <img src={property.image} alt={property.name} />
      </div>

      <div className="card__info">
        <h4>{property.price} </h4>

        <p>
          <strong>{property.bedrooms}</strong> bds |{" "}
          <strong>{property.bathrooms}</strong> ba |{" "}
          <strong>{property.area}</strong> sqft
        </p>

        <p>{property.address}</p>
      </div>
    </article>
  );
}

export default Card;