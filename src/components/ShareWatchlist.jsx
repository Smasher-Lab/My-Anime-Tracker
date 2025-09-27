import React, { useState } from 'react';

function ShareWatchlist({ userId }) {
  const [shareableLink, setShareableLink] = useState('');
  
  const handleGenerateLink = () => {
    if (!userId) {
      alert('You must be logged in to share your list.');
      return;
    }
    const link = `${window.location.origin}/shared-watchlist/${userId}`;
    setShareableLink(link);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareableLink);
    alert('Link copied to clipboard!');
  };

  return (
    <div className="share-watchlist-container">
      <h3>Share Your Watchlist</h3>
      <p>Click the button to generate a public link to your anime list. Anyone with the link can view your list.</p>
      <button onClick={handleGenerateLink} className="share-link-button">
        Generate Shareable Link
      </button>
      {shareableLink && (
        <div className="share-link-result">
          <input
            type="text"
            value={shareableLink}
            readOnly
            onClick={handleCopyLink}
          />
          <button onClick={handleCopyLink} className="copy-button">
            Copy Link
          </button>
        </div>
      )}
    </div>
  );
}

export default ShareWatchlist;