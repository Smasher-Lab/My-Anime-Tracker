import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';


function AnimeDetail() {
  const { animeId } = useParams();
  const location = useLocation();
  const { userId, username } = location.state || {};

  const [anime, setAnime] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [streamingLinks, setStreamingLinks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [newRating, setNewRating] = useState(1);
  const [newReviewText, setNewReviewText] = useState('');
  const [reviewMessage, setReviewMessage] = useState('');

  const [showSpoiler, setShowSpoiler] = useState(false); // New state for spoiler protection
  const [isSubscribed, setIsSubscribed] = useState(false); // New state to track subscription status
  const [reminderMessage, setReminderMessage] = useState('');

  // Fetch anime details and reviews on component load
  useEffect(() => {
    const fetchAnimeData = async () => {
      try {
        const animeResponse = await fetch(`https://api.jikan.moe/v4/anime/${animeId}/full`);
        const animeData = await animeResponse.json();
        if (!animeResponse.ok) {
          throw new Error('Failed to fetch anime details.');
        }

        const reviewsResponse = await fetch(`http://localhost:3001/api/reviews/${animeId}`);
        const reviewsData = await reviewsResponse.json();
        if (!reviewsResponse.ok) {
          throw new Error('Failed to fetch reviews.');
        }

        setAnime(animeData.data);
        setReviews(reviewsData.reviews);
        setStreamingLinks(animeData.data.streaming || []);

      } catch (err) {
        console.error('Anime data fetch error:', err);
        setError('Could not load anime data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
      const remindersResponse = await fetch(`http://localhost:3001/api/reminders/${userId}`);
      const remindersData = await remindersResponse.json();

      if (remindersResponse.ok && remindersData.subscribedAnimeIds.includes(parseInt(animeId))) {
        setIsSubscribed(true);
      }
      const handleSubscribe = async () => {
        try {
          const response = await fetch('http://localhost:3001/api/reminders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              animeId: parseInt(animeId),
              currentEpisodes: anime.episodes || 0
            })
          });
          const data = await response.json();
          if (response.ok) {
            setReminderMessage(data.message);
            setIsSubscribed(true);
          } else {
            setReminderMessage(data.message || 'Failed to subscribe to reminders.');
          }
        } catch (err) {
          setReminderMessage('Could not connect to the server.');
        }
      };
    };
    fetchAnimeData();
  }, [animeId]);

  const handleReviewSubmit = async (event) => {
    event.preventDefault();
    if (!userId) {
      setReviewMessage('You must be logged in to submit a review.');
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          animeId: parseInt(animeId),
          userId,
          rating: newRating,
          reviewText: newReviewText,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setReviewMessage('Review submitted successfully!');
        const reviewsResponse = await fetch(`http://localhost:3001/api/reviews/${animeId}`);
        const reviewsData = await reviewsResponse.json();
        setReviews(reviewsData.reviews);
        setNewRating(1);
        setNewReviewText('');
      } else {
        setReviewMessage(data.message || 'Failed to submit review.');
      }
    } catch (err) {
      console.error('Submit review error:', err);
      setReviewMessage('Could not connect to the server.');
    }
  };

  if (isLoading) {
    return <div className="loading-message">Loading anime details...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="anime-detail-container">
      <div className="anime-header">
        <img src={anime.images.jpg.large_image_url} alt={anime.title} className="anime-detail-image" />
        <div className="anime-info">
          <h2>{anime.title}</h2>
          <p><strong>Type:</strong> {anime.type}</p>
          <p><strong>Episodes:</strong> {anime.episodes || 'N/A'}</p>
          <p><strong>Status:</strong> {anime.status}</p>
          <p><strong>Score:</strong> {anime.score || 'N/A'}</p>

          <div className="synopsis-container">
            <div className="spoiler-toggle">
              <button onClick={() => setShowSpoiler(!showSpoiler)}>
                {showSpoiler ? 'Hide Synopsis' : 'Show Synopsis'}
              </button>
            </div>
            {showSpoiler ? (
              <p className="synopsis-text">{anime.synopsis}</p>
            ) : (
              <p className="spoiler-placeholder">Synopsis is hidden to prevent spoilers.</p>
            )}
          </div>

          <div className="streaming-links">
            <h3>Watch Now</h3>
            {streamingLinks.length > 0 ? (
              <div className="streaming-list">
                {streamingLinks.map((link, index) => (
                  <a key={index} href={link.url} target="_blank" rel="noopener noreferrer" className="streaming-link">
                    {link.name}
                  </a>
                ))}
              </div>
            ) : (
              <p>No official streaming links available.</p>
            )}
          </div>
          <div className="reminder-section">
            {isSubscribed ? (
              <p className="subscribed-message">You are subscribed to reminders for this anime. ✅</p>
            ) : (
              <button onClick={handleSubscribe} className="subscribe-button">
                Subscribe to Episode Reminders
              </button>
            )}
            {reminderMessage && <p className="reminder-message">{reminderMessage}</p>}
          </div>
        </div>
      </div>

      <div className="reviews-section">
        <h3>User Reviews</h3>
        <div className="review-form-container">
          <h4>Leave a Review</h4>
          <form onSubmit={handleReviewSubmit}>
            <div className="form-group">
              <label htmlFor="rating">Rating:</label>
              <select id="rating" value={newRating} onChange={(e) => setNewRating(parseInt(e.target.value))}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="review-text">Review:</label>
              <textarea
                id="review-text"
                value={newReviewText}
                onChange={(e) => setNewReviewText(e.target.value)}
                placeholder="Write your review here..."
              />
            </div>
            <button type="submit">Submit Review</button>
          </form>
          {reviewMessage && <p className="form-message">{reviewMessage}</p>}
        </div>

        <div className="review-list">
          {reviews.length > 0 ? (
            reviews.map(review => (
              <div key={review.id} className="review-card">
                <p><strong>{review.username}</strong> rated it: <strong>{review.rating}/10</strong></p>
                <p>{review.review_text}</p>
              </div>
            ))
          ) : (
            <p className="no-reviews-message">No reviews yet. Be the first to leave one!</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default AnimeDetail;