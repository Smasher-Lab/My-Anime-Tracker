// src/components/Profile.jsx

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

function Profile() {
  const navigate = useNavigate();
  const location = useLocation();
  const { username } = location.state || {};

  const handleLogout = () => {
    // We'll add logic to clear the user's session here later if we implement JWTs
    navigate('/');
  };

  return (
    <div className="profile-container">
      <h2>Profile</h2>
      {username ? (
        <>
          <p className="profile-greeting">Hello, <strong>{username}</strong>!</p>
          <p>This is your profile page. You can customize your settings here.</p>
          <button onClick={handleLogout} className="logout-button">Logout</button>
        </>
      ) : (
        <p>Please log in to view your profile.</p>
      )}
    </div>
  );
}

export default Profile;