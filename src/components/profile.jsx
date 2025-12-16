// src/components/Profile.jsx
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Chatbot from './Chatbot';

function Profile() {
  const navigate = useNavigate();
  const location = useLocation();
  const { username, isAdmin } = location.state || {};
  const [showHelp, setShowHelp] = useState(false);

  const handleLogout = () => {
    navigate('/');
  };

  return (
    <div className="profile-container">
      <h2>Profile</h2>
      {username ? (
        <>
          <p className="profile-greeting">Hello, <strong>{username}</strong>!</p>
          <div className="profile-details">
            <p><strong>Account Type:</strong> {isAdmin ? 'Administrator' : 'Standard User'}</p>
          </div>
          
          <div className="profile-actions">
            <button onClick={() => setShowHelp(!showHelp)} className="help-button">
              {showHelp ? 'Hide Help' : 'Show Help'}
            </button>
            <button onClick={handleLogout} className="logout-button">Logout</button>
          </div>

          {showHelp && (
            <div className="help-section">
              <h3>User Documentation & Help</h3>
              <p>Welcome to the help section! Here are a few tips:</p>
              <ul>
                <li>Use the search bar on the Tracker page to find new anime.</li>
                <li>Add anime to your list and use the +/- buttons to track your progress.</li>
                <li>Join a club to discuss shows with other users and participate in polls.</li>
                <li>Your entire list is automatically saved to the database, so you won't lose any progress!</li>
              </ul>
              <Chatbot />
            </div>
          )}
        </>
      ) : (
        <p>Please log in to view your profile.</p>
      )}
    </div>
  );
  
}

export default Profile;