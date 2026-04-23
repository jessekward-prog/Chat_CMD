import pg from 'pg'
const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false
})

async function initDB() {
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS servers (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT DEFAULT '▪',
        color TEXT DEFAULT '#4af626',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS channels (
        id SERIAL PRIMARY KEY,
        server_id INT REFERENCES servers(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT DEFAULT 'text',
        position INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        tag TEXT NOT NULL,
        status TEXT DEFAULT 'offline',
        activity TEXT,
        color TEXT DEFAULT '#4af626',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        channel_id INT REFERENCES channels(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS reactions (
        id SERIAL PRIMARY KEY,
        message_id INT REFERENCES messages(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id),
        emoji TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS voice_presence (
        id SERIAL PRIMARY KEY,
        channel_id INT REFERENCES channels(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        joined_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(channel_id, user_id)
      );
    `)

    // Seed default data if empty
    const { rows } = await client.query('SELECT COUNT(*) FROM servers')
    if (parseInt(rows[0].count) === 0) {
      console.log('[DB] Seeding default data...')

      // Servers
      await client.query(`
        INSERT INTO servers (name, icon, color) VALUES
        ('SYS_OPS', '⚡', '#4af626'),
        ('AUDIO_LAB', '◈', '#ffb627'),
        ('DEV_CORE', '▣', '#00d4ff'),
        ('PIXEL_FX', '◉', '#c084fc'),
        ('CHILL_NET', '▪', '#ff4444')
      `)

      // Channels
      await client.query(`
        INSERT INTO channels (server_id, name, type, position) VALUES
        (1, 'general', 'text', 0), (1, 'ranked-queue', 'text', 1), (1, 'strats', 'text', 2),
        (1, 'GAME_NIGHT', 'voice', 3), (1, 'AFK', 'voice', 4),
        (2, 'tracks', 'text', 0), (2, 'production', 'text', 1),
        (2, 'SESSION_01', 'voice', 2),
        (3, 'general', 'text', 0), (3, 'frontend', 'text', 1), (3, 'backend', 'text', 2),
        (3, 'STANDUP', 'voice', 3),
        (4, 'showcase', 'text', 0), (4, 'feedback', 'text', 1),
        (4, 'STREAM', 'voice', 2),
        (5, 'lounge', 'text', 0), (5, 'shitpost', 'text', 1),
        (5, 'HANGOUT', 'voice', 2)
      `)

      // Users
      await client.query(`
        INSERT INTO users (name, tag, status, activity, color) VALUES
        ('root_user', '#0001', 'online', NULL, '#4af626'),
        ('Pixel', '#4521', 'online', '> playing VALORANT', '#ffb627'),
        ('Nova', '#7788', 'online', '> spotify:listening', '#00d4ff'),
        ('Echo', '#3344', 'idle', NULL, '#c084fc'),
        ('Prism', '#9012', 'dnd', '> OBS:streaming', '#ff4444'),
        ('Haze', '#5678', 'online', NULL, '#4af626'),
        ('Zephyr', '#2233', 'offline', NULL, '#ffb627'),
        ('Bolt', '#1122', 'online', '> vscode:active', '#00d4ff')
      `)

      // Seed some messages (channel 1 = general in SYS_OPS)
      await client.query(`
        INSERT INTO messages (channel_id, user_id, content) VALUES
        (1, 2, 'anyone down for ranked tonight?'),
        (1, 3, 'im in. been grinding all week'),
        (1, 4, 'maybe later, grabbing food rn'),
        (1, 2, 'need a 5th — @Echo ping me when back'),
        (1, 6, 'i can fill. what rank?'),
        (1, 3, 'diamond 2 but we dont care honestly, just vibes'),
        (1, 2, 'yeah hop in voice whenever'),
        (10, 8, 'pushed the new component library to main'),
        (10, 2, 'does it include dark mode tokens?'),
        (10, 8, 'yep full theme support. check /docs'),
        (17, 6, 'when the code compiles on the first try'),
        (17, 4, 'lies. that never happens.'),
        (17, 7, 'once had a program work first try... then i woke up'),
        (6, 3, 'new aphex twin dropped. go listen rn.'),
        (6, 4, 'the second track is insane'),
        (13, 5, 'finished the portrait series. thoughts?'),
        (13, 6, 'the lighting on #3 is unreal')
      `)

      // Seed some reactions
      await client.query(`
        INSERT INTO reactions (message_id, user_id, emoji) VALUES
        (1, 3, '▲'), (1, 4, '▲'), (1, 6, '▲'), (1, 5, '◉'),
        (3, 2, '◈'), (3, 8, '◈'),
        (6, 2, '▲'), (6, 4, '▲'), (6, 5, '▲'), (6, 6, '▲'),
        (8, 2, '▲'), (8, 3, '▲'), (8, 4, '▲'), (8, 5, '▲'), (8, 6, '▲'),
        (11, 2, '▲'), (11, 3, '▲'), (11, 4, '▲'), (11, 5, '▲'),
        (11, 6, '▲'), (11, 7, '▲'), (11, 8, '▲'), (11, 1, '▲'),
        (11, 2, '◉'), (11, 3, '◉'), (11, 4, '◉'),
        (12, 2, '▲'), (12, 3, '▲'), (12, 5, '▲'), (12, 6, '▲'),
        (13, 2, '▲'), (13, 3, '▲'), (13, 4, '▲'), (13, 5, '▲'), (13, 6, '▲'), (13, 8, '▲'),
        (14, 2, '◉'), (14, 3, '◉'), (14, 4, '◉'), (14, 5, '◉'),
        (14, 6, '◉'), (14, 7, '◉'), (14, 8, '◉'),
        (16, 2, '▲'), (16, 3, '▲'), (16, 4, '▲'), (16, 5, '▲'),
        (16, 6, '▲'), (16, 7, '▲'), (16, 8, '▲'), (16, 1, '▲'), (16, 2, '▲')
      `)

      // Voice presence
      await client.query(`
        INSERT INTO voice_presence (channel_id, user_id) VALUES
        (4, 2), (4, 3),
        (8, 4),
        (15, 5), (15, 6),
        (18, 7)
      `)

      console.log('[DB] Seed complete')
    }
  } finally {
    client.release()
  }
}

export { pool, initDB }
