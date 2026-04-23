import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { pool, initDB } from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

// Serve built frontend
app.use(express.static(path.join(__dirname, 'dist')))

// ─── API ROUTES ──────────────────────────────────

// GET all servers
app.get('/api/servers', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM servers ORDER BY id')
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch servers' })
  }
})

// GET channels for a server
app.get('/api/servers/:serverId/channels', async (req, res) => {
  try {
    const { rows: channels } = await pool.query(
      'SELECT * FROM channels WHERE server_id = $1 ORDER BY position',
      [req.params.serverId]
    )

    // Get voice presence for each voice channel
    for (const ch of channels) {
      if (ch.type === 'voice') {
        const { rows: presence } = await pool.query(
          `SELECT u.name, u.status FROM voice_presence vp
           JOIN users u ON u.id = vp.user_id
           WHERE vp.channel_id = $1`,
          [ch.id]
        )
        ch.voice_users = presence.map(p => p.name)
      }
    }

    res.json(channels)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch channels' })
  }
})

// GET messages for a channel
app.get('/api/channels/:channelId/messages', async (req, res) => {
  try {
    const { rows: messages } = await pool.query(
      `SELECT m.id, m.content, m.created_at, m.user_id,
              u.name as user_name, u.tag as user_tag, u.color as user_color
       FROM messages m
       JOIN users u ON u.id = m.user_id
       WHERE m.channel_id = $1
       ORDER BY m.created_at ASC
       LIMIT 100`,
      [req.params.channelId]
    )

    // Get reactions for each message
    for (const msg of messages) {
      const { rows: reactions } = await pool.query(
        `SELECT emoji, COUNT(*) as count
         FROM reactions WHERE message_id = $1
         GROUP BY emoji`,
        [msg.id]
      )
      msg.reactions = reactions.map(r => ({ emoji: r.emoji, count: parseInt(r.count) }))
    }

    res.json(messages)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch messages' })
  }
})

// POST a new message
app.post('/api/channels/:channelId/messages', async (req, res) => {
  try {
    const { content, userId } = req.body
    const { rows } = await pool.query(
      `INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3)
       RETURNING id, content, created_at, user_id`,
      [req.params.channelId, userId || 1, content]
    )
    const msg = rows[0]

    // Get user info
    const { rows: users } = await pool.query(
      'SELECT name, tag, color FROM users WHERE id = $1', [msg.user_id]
    )
    msg.user_name = users[0]?.name
    msg.user_tag = users[0]?.tag
    msg.user_color = users[0]?.color
    msg.reactions = []

    res.json(msg)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to send message' })
  }
})

// POST a reaction
app.post('/api/messages/:messageId/reactions', async (req, res) => {
  try {
    const { emoji, userId } = req.body
    await pool.query(
      'INSERT INTO reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)',
      [req.params.messageId, userId || 1, emoji]
    )
    // Return updated counts
    const { rows } = await pool.query(
      `SELECT emoji, COUNT(*) as count FROM reactions
       WHERE message_id = $1 GROUP BY emoji`,
      [req.params.messageId]
    )
    res.json(rows.map(r => ({ emoji: r.emoji, count: parseInt(r.count) })))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to add reaction' })
  }
})

// GET all users
app.get('/api/users', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM users ORDER BY id')
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})

// SPA fallback — serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

// ─── START ──────────────────────────────────────
initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[CHAT_CMD] server running on port ${PORT}`)
    })
  })
  .catch(err => {
    console.error('[DB] Init failed:', err)
    process.exit(1)
  })
