require('dotenv').config({ path: '../../.env' });
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = 3004;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://localhost:3000',
    'https://minigames-web-ibcx.vercel.app',
    /^https:\/\/.*\.vercel\.app$/,
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());

// Get chat messages for a game
app.get('/chat/:gameId', async (req, res) => {
  const { gameId } = req.params;
  
  try {
    // Clean up old messages (older than 10 minutes)
    await supabase
      .from('chat_messages')
      .delete()
      .lt('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());
    
    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('id, user_email, message, created_at')
      .eq('game_id', gameId)
      .order('created_at', { ascending: true })
      .limit(50);
    
    if (error) {
      return res.status(500).send({ error: error.message });
    }
    
    res.send({ messages: messages || [] });
  } catch (err) {
    res.status(500).send({ error: 'Failed to fetch messages' });
  }
});

// Send chat message
app.post('/chat/:gameId', async (req, res) => {
  const { gameId } = req.params;
  const { message } = req.body;
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).send({ error: 'Authentication required' });
  }
  
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).send({ error: 'Invalid token' });
  }
  
  if (!message || !message.trim()) {
    return res.status(400).send({ error: 'Message cannot be empty' });
  }
  
  try {
    const { error: insertError } = await supabase
      .from('chat_messages')
      .insert([{
        game_id: gameId,
        user_id: user.id,
        user_email: user.email,
        message: message.trim()
      }]);
    
    if (insertError) {
      console.error('Insert error:', insertError);
      return res.status(500).send({ error: insertError.message });
    }
    
    res.send({ success: true });
  } catch (err) {
    res.status(500).send({ error: 'Failed to send message' });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Chat service listening at http://localhost:${port}`);
});