import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

function AdminPanel() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = location.state || {};
  
  const [users, setUsers] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAdminData = async () => {
    if (!isAdmin) {
      navigate('/tracker');
      return;
    }
    
    try {
      const usersResponse = await fetch(`http://localhost:3001/api/admin/users?is_admin=true`);
      const usersData = await usersResponse.json();
      if (!usersResponse.ok) throw new Error(usersData.message);
      setUsers(usersData.users);

      const clubsResponse = await fetch(`http://localhost:3001/api/admin/clubs?is_admin=true`);
      const clubsData = await clubsResponse.json();
      if (!clubsResponse.ok) throw new Error(clubsData.message);
      setClubs(clubsData.clubs);
      
      const reviewsResponse = await fetch(`http://localhost:3001/api/admin/reviews?is_admin=true`);
      const reviewsData = await reviewsResponse.json();
      if (!reviewsResponse.ok) throw new Error(reviewsData.message);
      setReviews(reviewsData.reviews);

    } catch (err) {
      console.error('Admin panel fetch error:', err);
      setError('Could not fetch data for admin panel. ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleDelete = async (type, id) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete this ${type}?`);
    if (!confirmDelete) return;

    try {
      const response = await fetch(`http://localhost:3001/api/admin/${type}s/${id}?is_admin=true`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (response.ok) {
        alert(data.message);
        fetchAdminData(); // Refresh data
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Could not delete item.');
    }
  };

  if (isLoading) {
    return <div className="loading-message">Loading Admin Panel...</div>;
  }
  
  if (error) {
    return <div className="error-message">Access Denied: {error}</div>;
  }

  return (
    <div className="admin-panel-container">
      <h2>Admin Panel</h2>

      <div className="admin-section">
        <h3>Manage Users</h3>
        <div className="admin-list">
          {users.map(user => (
            <div key={user.id} className="admin-card">
              <p><strong>Username:</strong> {user.username}</p>
              <button onClick={() => handleDelete('user', user.id)}>Delete</button>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-section">
        <h3>Manage Clubs</h3>
        <div className="admin-list">
          {clubs.map(club => (
            <div key={club.id} className="admin-card">
              <p><strong>Name:</strong> {club.name}</p>
              <button onClick={() => handleDelete('club', club.id)}>Delete</button>
            </div>
          ))}
        </div>
      </div>
      
      <div className="admin-section">
        <h3>Manage Reviews</h3>
        <div className="admin-list">
          {reviews.map(review => (
            <div key={review.id} className="admin-card">
              <p><strong>User:</strong> {review.username}</p>
              <p><strong>Review:</strong> {review.review_text}</p>
              <button onClick={() => handleDelete('review', review.id)}>Delete</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AdminPanel;