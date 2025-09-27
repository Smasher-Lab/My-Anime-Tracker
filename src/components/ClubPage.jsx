import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';

function ClubPage() {
  const { clubId } = useParams();
  const location = useLocation();
  const { userId, username } = location.state || {};
  
  const [club, setClub] = useState(null);
  const [discussions, setDiscussions] = useState([]);
  const [polls, setPolls] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [newPollQuestion, setNewPollQuestion] = useState('');
  const [newPollOptions, setNewPollOptions] = useState(['', '']);
  const [pollFormMessage, setPollFormMessage] = useState('');
  const [userVotes, setUserVotes] = useState({});

  const fetchClubData = async () => {
    try {
      const clubResponse = await fetch(`http://localhost:3001/api/clubs/${clubId}`);
      const clubData = await clubResponse.json();
      if (!clubResponse.ok) {
        throw new Error(clubData.message || 'Failed to fetch club.');
      }

      const discussionsResponse = await fetch(`http://localhost:3001/api/discussions/${clubId}`);
      const discussionsData = await discussionsResponse.json();
      if (!discussionsResponse.ok) {
        throw new Error(discussionsData.message || 'Failed to fetch discussions.');
      }

      const pollsResponse = await fetch(`http://localhost:3001/api/polls/${clubId}`);
      const pollsData = await pollsResponse.json();
      if (!pollsResponse.ok) {
        throw new Error(pollsData.message || 'Failed to fetch polls.');
      }
      
      const votesResponse = await fetch(`http://localhost:3001/api/votes/${userId}`);
      const votesData = await votesResponse.json();
      if (votesResponse.ok) {
          const votesObject = votesData.votes.reduce((acc, vote) => {
              acc[vote.poll_id] = vote.option_id;
              return acc;
          }, {});
          setUserVotes(votesObject);
      }
      
      setClub(clubData.club);
      setDiscussions(discussionsData.discussions);
      setPolls(pollsData.polls);
      
    } catch (err) {
      console.error("Club data fetch error:", err);
      setError('Could not load club data. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
        fetchClubData();
    }
  }, [clubId, userId]);

  const handlePostMessage = async (event) => {
    event.preventDefault();
    if (!newMessage.trim() || !userId) {
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/api/discussions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          club_id: clubId,
          user_id: userId,
          content: newMessage,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setDiscussions(prevDiscussions => [...prevDiscussions, { ...data.discussion, username }]);
        setNewMessage('');
      } else {
        setError(data.message || 'Failed to post message.');
      }
    } catch (err) {
      console.error('Post message error:', err);
      setError('Could not post message.');
    }
  };

  const handleOptionChange = (index, value) => {
    const updatedOptions = [...newPollOptions];
    updatedOptions[index] = value;
    setNewPollOptions(updatedOptions);
  };

  const handleAddOption = () => {
    if (newPollOptions.length < 5) {
      setNewPollOptions([...newPollOptions, '']);
    }
  };

  const handleCreatePoll = async (event) => {
    event.preventDefault();
    setPollFormMessage('');

    if (!newPollQuestion.trim()) {
      setPollFormMessage('Please enter a poll question.');
      return;
    }
    
    const filteredOptions = newPollOptions.filter(opt => opt.trim() !== '');
    if (filteredOptions.length < 2) {
      setPollFormMessage('A poll must have at least two options.');
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          club_id: clubId,
          question: newPollQuestion,
          options: filteredOptions,
          created_by: userId,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setNewPollQuestion('');
        setNewPollOptions(['', '']);
        setPollFormMessage('Poll created successfully!');
        fetchClubData(); 
      } else {
        setPollFormMessage(data.message || 'Failed to create poll.');
      }
    } catch (err) {
      console.error('Create poll error:', err);
      setPollFormMessage('Could not connect to the server.');
    }
  };

  const handleVote = async (pollId, optionId) => {
    if (userVotes[pollId]) {
      alert('You have already voted on this poll.');
      return;
    }
    
    try {
      const response = await fetch('http://localhost:3001/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poll_id: pollId,
          user_id: userId,
          option_id: optionId,
        }),
      });
      
      const data = await response.json();
      if (response.ok) {
        setUserVotes(prevVotes => ({ ...prevVotes, [pollId]: optionId }));
        fetchClubData(); 
      } else {
        alert(data.message || 'Failed to submit vote.');
      }
    } catch (err) {
      console.error('Vote submission error:', err);
      alert('Could not submit vote.');
    }
  };

  if (isLoading) {
    return <div className="loading-message">Loading club...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (!club) {
    return <div className="error-message">Club not found.</div>;
  }

  return (
    <div className="club-page-container">
      <h2>{club.name}</h2>
      <p className="club-description">{club.description}</p>
      
      <div className="discussion-board">
        <h3>Discussion Board</h3>
        <div className="discussion-messages">
          {discussions.length > 0 ? (
            discussions.map(msg => (
              <div key={msg.id} className="message-card">
                <strong>{msg.username}:</strong> {msg.content}
              </div>
            ))
          ) : (
            <p className="no-messages-message">Be the first to post a message!</p>
          )}
        </div>
        <form onSubmit={handlePostMessage} className="post-message-form">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Write a message..."
          />
          <button type="submit">Post</button>
        </form>
      </div>

      <div className="polls-section">
        <h3>Community Polls</h3>
        <div className="create-poll-form">
          <h4>Create a New Poll</h4>
          <form onSubmit={handleCreatePoll}>
            <div className="form-group">
              <label htmlFor="poll-question">Question:</label>
              <input
                type="text"
                id="poll-question"
                value={newPollQuestion}
                onChange={(e) => setNewPollQuestion(e.target.value)}
              />
            </div>
            {newPollOptions.map((option, index) => (
              <div className="form-group" key={index}>
                <label htmlFor={`option-${index}`}>Option {index + 1}:</label>
                <input
                  type="text"
                  id={`option-${index}`}
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                />
              </div>
            ))}
            <div className="poll-form-buttons">
              <button type="button" onClick={handleAddOption}>Add Option</button>
              <button type="submit">Create Poll</button>
            </div>
          </form>
          {pollFormMessage && <p className="form-message">{pollFormMessage}</p>}
        </div>
        
        <div className="poll-list">
          {polls.length > 0 ? (
            polls.map(poll => (
              <div key={poll.id} className="poll-card">
                <h4>{poll.question}</h4>
                <div className="poll-options">
                  {poll.options.map(option => (
                    <div key={option.id} className="poll-option">
                      <button
                        onClick={() => handleVote(poll.id, option.id)}
                        disabled={!!userVotes[poll.id]}
                        className={`vote-button ${userVotes[poll.id] === option.id ? 'voted' : ''}`}
                      >
                        {option.option_text}
                      </button>
                      <span className="vote-count">{option.votes} votes</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className="no-polls-message">No polls in this club yet. Be the first!</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default ClubPage;