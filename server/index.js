const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL Connection Pool
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'anime_tracker_db',
  password: '123456',
  port: 5432,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

async function checkNewEpisodes() {
  console.log('Running background job: Checking for new episodes...');
  try {
    const client = await pool.connect();
    const subscribedAnimeQuery = 'SELECT DISTINCT anime_id FROM reminders';
    const result = await client.query(subscribedAnimeQuery);
    const animeIds = result.rows.map(row => row.anime_id);
    for (const animeId of animeIds) {
      const jikanResponse = await fetch(`https://api.jikan.moe/v4/anime/${animeId}`);
      const jikanData = await jikanResponse.json();
      if (jikanResponse.ok && jikanData.data && jikanData.data.episodes) {
        const currentEpisodes = jikanData.data.episodes;
        const usersSubscribedQuery = 'SELECT user_id, last_checked_episode FROM reminders WHERE anime_id = $1';
        const usersSubscribedResult = await client.query(usersSubcribedQuery, [animeId]);
        for (const user of usersSubscribedResult.rows) {
          const lastEpisode = user.last_checked_episode;
          if (currentEpisodes > lastEpisode) {
            console.log(`Notification for user ${user.user_id}: New episode(s) for Anime ID ${animeId}!`);
            const updateReminderQuery = 'UPDATE reminders SET last_checked_episode = $1 WHERE user_id = $2 AND anime_id = $3';
            await client.query(updateReminderQuery, [currentEpisodes, user.user_id, animeId]);
          }
        }
      }
    }
    client.release();
    console.log('Background job complete.');
  } catch (err) {
    console.error('Error during background job:', err);
  }
}

setInterval(checkNewEpisodes, 5 * 60 * 1000);

app.get('/', (req, res) => {
  res.send('Hello from the backend!');
});

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }
  try {
    const client = await pool.connect();
    const checkUserQuery = 'SELECT username FROM users WHERE username = $1';
    const result = await client.query(checkUserQuery, [username]);
    if (result.rows.length > 0) {
      client.release();
      return res.status(409).json({ message: 'Username already exists.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const insertUserQuery = 'INSERT INTO users (username, password) VALUES ($1, $2)';
    await client.query(insertUserQuery, [username, hashedPassword]);
    client.release();
    res.status(201).json({ message: 'User registered successfully!' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }
  try {
    const client = await pool.connect();
    const findUserQuery = 'SELECT id, password, is_admin FROM users WHERE username = $1';
    const result = await client.query(findUserQuery, [username]);
    if (result.rows.length === 0) {
      client.release();
      return res.status(401).json({ message: 'Invalid username or password.' });
    }
    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);
    client.release();
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }
    res.status(200).json({
      message: 'Login successful!',
      user_id: user.id,
      is_admin: user.is_admin
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
});

app.post('/api/anime', async (req, res) => {
  const { userId, animeList } = req.body;
  try {
    const client = await pool.connect();
    const checkListQuery = 'SELECT id FROM anime_lists WHERE user_id = $1';
    const existingList = await client.query(checkListQuery, [userId]);
    if (existingList.rows.length > 0) {
      const updateListQuery = 'UPDATE anime_lists SET data = $1 WHERE user_id = $2';
      await client.query(updateListQuery, [JSON.stringify(animeList), userId]);
    } else {
      const insertListQuery = 'INSERT INTO anime_lists (user_id, data) VALUES ($1, $2)';
      await client.query(insertListQuery, [userId, JSON.stringify(animeList)]);
    }
    client.release();
    res.status(200).json({ message: 'Anime list saved successfully!' });
  } catch (error) {
    console.error('Save list error:', error);
    res.status(500).json({ message: 'Server error. Could not save list.' });
  }
});

app.get('/api/anime/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const client = await pool.connect();
    const getListQuery = 'SELECT data FROM anime_lists WHERE user_id = $1';
    const result = await client.query(getListQuery, [userId]);
    client.release();
    if (result.rows.length === 0) {
      return res.status(200).json({ animeList: [] });
    }
    res.status(200).json({ animeList: result.rows[0].data });
  } catch (error) {
    console.error('Fetch list error:', error);
    res.status(500).json({ message: 'Server error. Could not fetch list.' });
  }
});

app.get('/api/reviews/:animeId', async (req, res) => {
  const { animeId } = req.params;
  try {
    const client = await pool.connect();
    const query = 'SELECT r.*, u.username FROM reviews r INNER JOIN users u ON r.user_id = u.id WHERE r.anime_id = $1 ORDER BY r.created_at DESC';
    const result = await client.query(query, [animeId]);
    client.release();
    res.status(200).json({ reviews: result.rows });
  } catch (error) {
    console.error('Fetch reviews error:', error);
    res.status(500).json({ message: 'Server error. Could not fetch reviews.' });
  }
});

app.post('/api/reviews', async (req, res) => {
  const { animeId, userId, rating, reviewText } = req.body;
  if (!animeId || !userId || !rating) {
    return res.status(400).json({ message: 'Anime ID, user ID, and rating are required.' });
  }
  try {
    const client = await pool.connect();
    const query = 'INSERT INTO reviews (anime_id, user_id, rating, review_text) VALUES ($1, $2, $3, $4) RETURNING *';
    const result = await client.query(query, [animeId, userId, rating, reviewText]);
    client.release();
    res.status(201).json({ message: 'Review submitted successfully!', review: result.rows[0] });
  } catch (error) {
    console.error('Submit review error:', error);
    res.status(500).json({ message: 'Server error. Could not submit review.' });
  }
});

app.post('/api/reminders', async (req, res) => {
  const { userId, animeId, currentEpisodes } = req.body;
  if (!userId || !animeId || typeof currentEpisodes !== 'number') {
    return res.status(400).json({ message: 'Missing required fields.' });
  }
  try {
    const client = await pool.connect();
    const checkQuery = 'SELECT * FROM reminders WHERE user_id = $1 AND anime_id = $2';
    const checkResult = await client.query(checkQuery, [userId, animeId]);
    if (checkResult.rows.length > 0) {
      client.release();
      return res.status(409).json({ message: 'You are already subscribed to reminders for this anime.' });
    }
    const insertQuery = 'INSERT INTO reminders (user_id, anime_id, last_checked_episode) VALUES ($1, $2, $3)';
    await client.query(insertQuery, [userId, animeId, currentEpisodes]);
    client.release();
    res.status(201).json({ message: 'Reminder subscribed successfully!' });
  } catch (error) {
    console.error('Reminder subscription error:', error);
    res.status(500).json({ message: 'Server error. Could not subscribe to reminder.' });
  }
});

app.get('/api/reminders/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const client = await pool.connect();
    const query = 'SELECT anime_id FROM reminders WHERE user_id = $1';
    const result = await client.query(query, [userId]);
    client.release();
    const subscribedAnimeIds = result.rows.map(row => row.anime_id);
    res.status(200).json({ subscribedAnimeIds });
  } catch (error) {
    console.error('Fetch reminders error:', error);
    res.status(500).json({ message: 'Server error. Could not fetch reminders.' });
  }
});

app.get('/api/analytics/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const client = await pool.connect();
    const getListQuery = 'SELECT data FROM anime_lists WHERE user_id = $1';
    const result = await client.query(getListQuery, [userId]);
    client.release();
    if (result.rows.length === 0) {
      return res.status(200).json({ totalEpisodes: 0, totalWatchTime: 0 });
    }
    const animeList = result.rows[0].data;
    let totalEpisodes = 0;
    animeList.forEach(anime => {
      totalEpisodes += anime.watchedEpisodes;
    });
    const totalWatchTimeHours = Math.round((totalEpisodes * 24) / 60);
    res.status(200).json({ totalEpisodes, totalWatchTimeHours });
  } catch (error) {
    console.error('Fetch analytics error:', error);
    res.status(500).json({ message: 'Server error. Could not fetch analytics.' });
  }
});

// Endpoint to fetch genres from Jikan API
app.get('/api/genres', async (req, res) => {
  try {
    const response = await fetch('https://api.jikan.moe/v4/genres/anime');
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ message: data.message });
    }
    res.status(200).json({ genres: data.data });
  } catch (error) {
    console.error('Fetch genres error:', error);
    res.status(500).json({ message: 'Server error. Could not fetch genres.' });
  }
});

// Endpoint to get all users (for admin panel)
app.get('/api/admin/users', async (req, res) => {
  const { is_admin } = req.query;
  if (is_admin !== 'true') {
    return res.status(403).json({ message: 'Access denied.' });
  }
  try {
    const client = await pool.connect();
    const query = 'SELECT id, username, is_admin FROM users ORDER BY id ASC';
    const result = await client.query(query);
    client.release();
    res.status(200).json({ users: result.rows });
  } catch (error) {
    console.error('Admin users fetch error:', error);
    res.status(500).json({ message: 'Server error. Could not fetch users.' });
  }
});

// Endpoint to delete a user
app.delete('/api/admin/users/:id', async (req, res) => {
  const { id } = req.params;
  const { is_admin } = req.query;
  if (is_admin !== 'true') {
    return res.status(403).json({ message: 'Access denied.' });
  }
  try {
    const client = await pool.connect();
    const query = 'DELETE FROM users WHERE id = $1';
    await client.query(query, [id]);
    client.release();
    res.status(200).json({ message: 'User deleted successfully.' });
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ message: 'Server error. Could not delete user.' });
  }
});

// Endpoint to get all clubs (for admin panel)
app.get('/api/admin/clubs', async (req, res) => {
  const { is_admin } = req.query;
  if (is_admin !== 'true') {
    return res.status(403).json({ message: 'Access denied.' });
  }
  try {
    const client = await pool.connect();
    const query = 'SELECT * FROM clubs ORDER BY created_at DESC';
    const result = await client.query(query);
    client.release();
    res.status(200).json({ clubs: result.rows });
  } catch (error) {
    console.error('Admin clubs fetch error:', error);
    res.status(500).json({ message: 'Server error. Could not fetch clubs.' });
  }
});

// Endpoint to delete a club
app.delete('/api/admin/clubs/:id', async (req, res) => {
  const { id } = req.params;
  const { is_admin } = req.query;
  if (is_admin !== 'true') {
    return res.status(403).json({ message: 'Access denied.' });
  }
  try {
    const client = await pool.connect();
    const query = 'DELETE FROM clubs WHERE id = $1';
    await client.query(query, [id]);
    client.release();
    res.status(200).json({ message: 'Club deleted successfully.' });
  } catch (error) {
    console.error('Admin delete club error:', error);
    res.status(500).json({ message: 'Server error. Could not delete club.' });
  }
});

// Endpoint to get all reviews (for admin panel)
app.get('/api/admin/reviews', async (req, res) => {
  const { is_admin } = req.query;
  if (is_admin !== 'true') {
    return res.status(403).json({ message: 'Access denied.' });
  }
  try {
    const client = await pool.connect();
    const query = 'SELECT r.*, u.username FROM reviews r INNER JOIN users u ON r.user_id = u.id ORDER BY r.created_at DESC';
    const result = await client.query(query);
    client.release();
    res.status(200).json({ reviews: result.rows });
  } catch (error) {
    console.error('Admin reviews fetch error:', error);
    res.status(500).json({ message: 'Server error. Could not fetch reviews.' });
  }
});

// Endpoint to delete a review
app.delete('/api/admin/reviews/:id', async (req, res) => {
  const { id } = req.params;
  const { is_admin } = req.query;
  if (is_admin !== 'true') {
    return res.status(403).json({ message: 'Access denied.' });
  }
  try {
    const client = await pool.connect();
    const query = 'DELETE FROM reviews WHERE id = $1';
    await client.query(query, [id]);
    client.release();
    res.status(200).json({ message: 'Review deleted successfully.' });
  } catch (error) {
    console.error('Admin delete review error:', error);
    res.status(500).json({ message: 'Server error. Could not delete review.' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});