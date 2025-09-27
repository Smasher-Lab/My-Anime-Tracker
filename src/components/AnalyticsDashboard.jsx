import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function AnalyticsDashboard() {
  const location = useLocation();
  const { userId } = location.state || {};

  const [totalEpisodes, setTotalEpisodes] = useState(0);
  const [totalWatchTimeHours, setTotalWatchTimeHours] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      if (!userId) {
        setError("You must be logged in to view analytics.");
        setIsLoading(false);
        return;
      }
      try {
        const response = await fetch(`http://localhost:3001/api/analytics/${userId}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || 'Failed to fetch analytics data.');
        }
        setTotalEpisodes(data.totalEpisodes);
        setTotalWatchTimeHours(data.totalWatchTimeHours);
      } catch (err) {
        console.error("Analytics fetch error:", err);
        setError('Could not load analytics data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAnalyticsData();
  }, [userId]);

  if (isLoading) {
    return <div className="loading-message">Loading your dashboard...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="dashboard-container">
      <h2>Your Watch History Analytics</h2>
      <div className="analytics-grid">
        <div className="analytics-card">
          <h3>Total Episodes Watched</h3>
          <p className="big-number">{totalEpisodes}</p>
        </div>
        <div className="analytics-card">
          <h3>Total Watch Time</h3>
          <p className="big-number">{totalWatchTimeHours}</p>
          <p className="unit">hours</p>
        </div>
      </div>
    </div>
  );
}

export default AnalyticsDashboard;