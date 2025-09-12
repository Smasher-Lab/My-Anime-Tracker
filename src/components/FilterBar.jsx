import React, { useState, useEffect } from 'react';

function FilterBar({ onFilterChange }) {
  const [genres, setGenres] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/genres');
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || 'Failed to fetch genres.');
        }
        setGenres(data.genres);
      } catch (err) {
        console.error("Fetch genres error:", err);
        setError('Could not load genres.');
      }
    };
    fetchGenres();
  }, []);

  const handleGenreChange = (e) => {
    setSelectedGenre(e.target.value);
    onFilterChange(e.target.value);
  };

  return (
    <div className="filter-bar-container">
      <div className="filter-group">
        <label htmlFor="genre-filter">Filter by Genre:</label>
        <select id="genre-filter" value={selectedGenre} onChange={handleGenreChange}>
          <option value="">All Genres</option>
          {genres.length > 0 ? (
            genres.map(genre => (
              <option key={genre.mal_id} value={genre.mal_id}>{genre.name}</option>
            ))
          ) : (
            <option disabled>Loading genres...</option>
          )}
        </select>
      </div>
      {error && <p className="filter-error-message">{error}</p>}
    </div>
  );
}

export default FilterBar;