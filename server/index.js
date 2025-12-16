const express = require('express');
const cors = require('cors');
const { Pool } = require('pg'); // fine if you're using it elsewhere
const bcrypt = require('bcrypt');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // ✅ fixed here
});

// Middleware
app.use(cors());
app.use(express.json());

// Chat route
app.post("/api/chat", async (req, res) => {
  console.log("Incoming body:", req.body); // 👈 debug log

  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant for an anime tracker website. Respond to user queries about the website, anime, or general topics in a friendly manner." },
        { role: "user", content: message }
      ],
    });

    const aiResponse = completion.choices[0].message.content;
    res.status(200).json({ reply: aiResponse });
  } catch (err) {
    console.error("OpenAI API error:", err);
    res.status(500).json({ message: "Server error. Could not connect to the AI service." });
  }
});


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
        const usersSubscribedResult = await client.query(usersSubscribedQuery, [animeId]);
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
  } catch (error) {
    console.error('Error during background job:', error);
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

// Endpoint to get all clubs (for frontend display)
app.get('/api/clubs', async (req, res) => {
  try {
    const client = await pool.connect();
    // This is the updated query with a JOIN to get the username
    const query = 'SELECT c.*, u.username FROM clubs c INNER JOIN users u ON c.created_by = u.id ORDER BY c.created_at DESC';
    const result = await client.query(query);
    client.release();
    res.status(200).json({ clubs: result.rows });
  } catch (error) {
    console.error('Fetch clubs error:', error);
    res.status(500).json({ message: 'Server error. Could not fetch clubs.' });
  }
});

// Endpoint to create a new club
app.post('/api/clubs', async (req, res) => {
  const { name, description, created_by } = req.body;
  if (!name || !created_by) {
    return res.status(400).json({ message: 'Club name and creator are required.' });
  }
  try {
    const client = await pool.connect();
    const query = 'INSERT INTO clubs (name, description, created_by) VALUES ($1, $2, $3) RETURNING *';
    const result = await client.query(query, [name, description, created_by]);
    client.release();
    res.status(201).json({ message: 'Club created successfully!', club: result.rows[0] });
  } catch (error) {
    console.error('Create club error:', error);
    res.status(500).json({ message: 'Server error. Could not create club.' });
  }
});
// Endpoint to get a single club by its ID
app.get('/api/clubs/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const client = await pool.connect();
    const query = 'SELECT * FROM clubs WHERE id = $1';
    const result = await client.query(query, [id]);
    client.release();
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Club not found.' });
    }
    res.status(200).json({ club: result.rows[0] });
  } catch (error) {
    console.error('Fetch club error:', error);
    res.status(500).json({ message: 'Server error. Could not fetch club.' });
  }
});

// Endpoint to get discussions for a club
app.get('/api/discussions/:clubId', async (req, res) => {
  const { clubId } = req.params;
  try {
    const client = await pool.connect();
    const query = 'SELECT d.*, u.username FROM discussions d INNER JOIN users u ON d.user_id = u.id WHERE d.club_id = $1 ORDER BY d.created_at ASC';
    const result = await client.query(query, [clubId]);
    client.release();
    res.status(200).json({ discussions: result.rows });
  } catch (error) {
    console.error('Fetch discussions error:', error);
    res.status(500).json({ message: 'Server error. Could not fetch discussions.' });
  }
});

// Endpoint to post a new discussion message
app.post('/api/discussions', async (req, res) => {
  const { club_id, user_id, content } = req.body;
  if (!club_id || !user_id || !content) {
    return res.status(400).json({ message: 'Club ID, user ID, and content are required.' });
  }
  try {
    const client = await pool.connect();
    const query = 'INSERT INTO discussions (club_id, user_id, content) VALUES ($1, $2, $3) RETURNING *';
    const result = await client.query(query, [club_id, user_id, content]);
    client.release();
    res.status(201).json({ message: 'Message posted successfully!', discussion: result.rows[0] });
  } catch (error) {
    console.error('Post discussion error:', error);
    res.status(500).json({ message: 'Server error. Could not post message.' });
  }
});

// Endpoint to get all polls for a specific club
app.get('/api/polls/:clubId', async (req, res) => {
  const { clubId } = req.params;
  try {
    const client = await pool.connect();

    const pollsQuery = 'SELECT * FROM polls WHERE club_id = $1 ORDER BY created_at DESC';
    const pollsResult = await client.query(pollsQuery, [clubId]);

    const polls = await Promise.all(pollsResult.rows.map(async (poll) => {
      const optionsQuery = 'SELECT * FROM poll_options WHERE poll_id = $1';
      const optionsResult = await client.query(optionsQuery, [poll.id]);

      const votesQuery = 'SELECT option_id, COUNT(*) AS votes FROM votes WHERE poll_id = $1 GROUP BY option_id';
      const votesResult = await client.query(votesQuery, [poll.id]);

      const optionsWithVotes = optionsResult.rows.map(option => {
        const vote = votesResult.rows.find(v => v.option_id === option.id);
        return { ...option, votes: vote ? parseInt(vote.votes) : 0 };
      });

      return { ...poll, options: optionsWithVotes };
    }));

    client.release();
    res.status(200).json({ polls });
  } catch (error) {
    console.error('Fetch polls error:', error);
    res.status(500).json({ message: 'Server error. Could not fetch polls.' });
  }
});

app.post('/api/votes', async (req, res) => {
  const { poll_id, user_id, option_id } = req.body;
  try {
    const client = await pool.connect();

    const checkQuery = 'SELECT * FROM votes WHERE poll_id = $1 AND user_id = $2';
    const checkResult = await client.query(checkQuery, [poll_id, user_id]);

    if (checkResult.rows.length > 0) {
      client.release();
      return res.status(409).json({ message: 'You have already voted on this poll.' });
    }

    const voteQuery = 'INSERT INTO votes (poll_id, user_id, option_id) VALUES ($1, $2, $3)';
    await client.query(voteQuery, [poll_id, user_id, option_id]);

    client.release();
    res.status(201).json({ message: 'Vote submitted successfully!' });

  } catch (error) {
    console.error('Vote submission error:', error);
    res.status(500).json({ message: 'Server error. Could not submit vote.' });
  }
});

// Endpoint to post a new poll with options
app.post('/api/polls', async (req, res) => {
  const { club_id, question, options, created_by } = req.body;
  if (!club_id || !question || !options || options.length < 2 || !created_by) {
    return res.status(400).json({ message: 'Missing required fields or not enough options.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const pollQuery = 'INSERT INTO polls (club_id, question, created_by) VALUES ($1, $2, $3) RETURNING id';
    const pollResult = await client.query(pollQuery, [club_id, question, created_by]);
    const pollId = pollResult.rows[0].id;

    for (const optionText of options) {
      const optionQuery = 'INSERT INTO poll_options (poll_id, option_text) VALUES ($1, $2)';
      await client.query(optionQuery, [pollId, optionText]);
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Poll created successfully!', pollId });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create poll error:', error);
    res.status(500).json({ message: 'Server error. Could not create poll.' });
  } finally {
    client.release();
  }
});

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

// Endpoint to get a user's vote list
app.get('/api/votes/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const client = await pool.connect();
    const query = 'SELECT poll_id, option_id FROM votes WHERE user_id = $1';
    const result = await client.query(query, [userId]);
    client.release();
    res.status(200).json({ votes: result.rows });
  } catch (error) {
    console.error('Fetch votes error:', error);
    res.status(500).json({ message: 'Server error. Could not fetch votes.' });
  }
});



app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});