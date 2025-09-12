import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isLogin, setIsLogin] = useState(true);

  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();

    setMessage('');
    if (!username || !password) {
      setMessage('Please enter a username and password.');
      return;
    }

    const endpoint = isLogin ? '/api/login' : '/api/register';

    try {
      const response = await fetch(`http://localhost:3001${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
        if (isLogin) {
          setTimeout(() => {
            navigate('/tracker', { 
              state: { 
                userId: data.user_id, 
                username: username, 
                isAdmin: data.is_admin 
              } 
            });
          }, 1500);
        } else {
          setTimeout(() => {
            setIsLogin(true);
            setMessage('Registration successful! Please log in.');
          }, 1500);
        }
      } else {
        setMessage(data.message || 'An error occurred.');
      }
    } catch (error) {
      console.error('Request error:', error);
      setMessage('Could not connect to the server. Please try again later.');
    }
  };

  return (
    <div className="login-container">
      <h2>{isLogin ? 'Login' : 'Register'}</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="username">Username:</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit">{isLogin ? 'Log In' : 'Register'}</button>
      </form>
      {message && <p className="message">{message}</p>}
      <p className="toggle-text">
        {isLogin ? "Don't have an account?" : "Already have an account?"}
        <span onClick={() => setIsLogin(!isLogin)} className="toggle-link">
          {isLogin ? ' Register' : ' Log in'}
        </span>
      </p>
    </div>
  );
}

export default Login;