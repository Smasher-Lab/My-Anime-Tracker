import React, { useState } from "react";
import { useNavigate } from "react-router-dom"; // you need this for navigate

function Sidebar({ userId, username, isAdmin, setShowShareModal }) {
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();

    return (
        <div className="sidebar-container">
            {/* Toggle button */}
            <button
                className={`sidebar-btn ${isOpen ? "open" : ""}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                {isOpen ? "×" : "➡️"}
            </button>


            {/* Sidebar */}
            <div className={`sidebar ${isOpen ? "open" : ""}`}>
                <div className="sidebar-links">
                    <p
                        onClick={() =>
                            navigate("/dashboard", { state: { userId, username, isAdmin } })
                        }
                        className="dashboard-link-button"
                    >
                        Analytics
                    </p>
                    <button
                        onClick={() => setShowShareModal(true)}
                        className="share-link-button"
                    >
                        Share Watchlist
                    </button>
                    <button
                        onClick={() =>
                            navigate("/clubs", { state: { userId, username, isAdmin } })
                        }
                        className="clubs-link-button"
                    >
                        Community Clubs
                    </button>
                    <button
                        onClick={() => navigate("/profile", { state: { username, isAdmin } })}
                        className="profile-link-button"
                    >
                        My Profile
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Sidebar;
