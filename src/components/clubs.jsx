// src/components/Clubs.jsx
import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom'; // Add Link here
// ... (rest of the component) ...

function Clubs() {
    const location = useLocation();
    const { userId, username } = location.state || {};

    const [clubs, setClubs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // New state for the club creation form
    const [newClubName, setNewClubName] = useState('');
    const [newClubDescription, setNewClubDescription] = useState('');
    const [formMessage, setFormMessage] = useState('');

    useEffect(() => {
        const fetchClubs = async () => {
            try {
                const response = await fetch('http://localhost:3001/api/clubs');
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || 'Failed to fetch clubs.');
                }

                setClubs(data.clubs);
            } catch (err) {
                console.error("Fetch clubs error:", err);
                setError('Could not load clubs. Please try again later.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchClubs();
    }, []);

    const handleCreateClub = async (event) => {
        event.preventDefault();
        setFormMessage('');

        if (!newClubName.trim()) {
            setFormMessage('Please enter a club name.');
            return;
        }

        // We need to pass the userId to the backend to know who created the club
        if (!userId) {
            setFormMessage('You must be logged in to create a club.');
            return;
        }

        try {
            const response = await fetch('http://localhost:3001/api/clubs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: newClubName,
                    description: newClubDescription,
                    created_by: userId,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                setClubs(prevClubs => [data.club, ...prevClubs]);
                setNewClubName('');
                setNewClubDescription('');
                setFormMessage('Club created successfully!');
            } else {
                setFormMessage(data.message || 'Failed to create club.');
            }
        } catch (err) {
            console.error('Create club error:', err);
            setFormMessage('Could not connect to the server.');
        }
    };

    if (isLoading) {
        return <div className="loading-message">Loading clubs...</div>;
    }

    if (error) {
        return <div className="error-message">{error}</div>;
    }

    return (
        <div className="clubs-container">
            <h2>Community Clubs</h2>
            {/* Club Creation Form */}
            <div className="create-club-form">
                <h3>Create a New Club</h3>
                <form onSubmit={handleCreateClub}>
                    <div className="form-group">
                        <label htmlFor="club-name">Club Name:</label>
                        <input
                            type="text"
                            id="club-name"
                            value={newClubName}
                            onChange={(e) => setNewClubName(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="club-description">Description:</label>
                        <textarea
                            id="club-description"
                            value={newClubDescription}
                            onChange={(e) => setNewClubDescription(e.target.value)}
                        />
                    </div>
                    <button type="submit">Create Club</button>
                </form>
                {formMessage && <p className="form-message">{formMessage}</p>}
            </div>
            {/* End of Club Creation Form */}

            <div className="club-list">
                {clubs.length > 0 ? (
                    clubs.map(club => (
                        <Link
                            to={`/clubs/${club.id}`}
                            key={club.id}
                            state={{ userId, username }}
                            className="club-card-link"
                        >
                            <div className="club-card">
                                <h3>{club.name}</h3>
                                <p>{club.description}</p>
                                <small>Created by user {club.created_by}</small>
                            </div>
                        </Link>
                    ))
                ) : (
                    <p className="no-clubs-message">No clubs have been created yet. Be the first!</p>
                )}
            </div>
        </div>
    );
}

export default Clubs;