import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Login from './components/Login';
import AnimeTracker from './components/AnimeTracker';
import Profile from './components/profile';
import ThemeToggle from './components/ThemeToggle';
import Clubs from './components/clubs';
import ClubPage from './components/ClubPage'
import AnimeDetail from './components/AnimeDetail';
import SharedWatchlist from './components/ShareWatchlist';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import AdminPanel from './components/AdminPanel';

function App() {
  const [theme, setTheme] = useState('dark');
  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div className={`App ${theme}`}>
      <Router>
        <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/tracker" element={<AnimeTracker />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/clubs" element={<Clubs />} />
          <Route path="/clubs/:clubId" element={<ClubPage />} />
          <Route path="/anime/:animeId" element={<AnimeDetail />} />
          <Route path="/shared-watchlist/:userId" element={<SharedWatchlist />} />
          <Route path="/dashboard" element={<AnalyticsDashboard />} />
          <Route path="/admin-panel" element={<AdminPanel />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;