require('dotenv').config({ path: '../../.env' });
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = 3001;

// --- Supabase Initialization ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Middleware ---
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://localhost:3000', 
    /^https:\/\/.*\.vercel\.app$/,
    /^https:\/\/.*\.netlify\.app$/,
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());

// --- API Endpoints ---

// Health check
app.get('/', (req, res) => {
  res.send('Auth service is running!');
});

// User Signup
app.post('/signup', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).send({ error: 'Email and password are required.' });
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return res.status(400).send({ error: error.message });
  }

  res.send({ user: data.user, session: data.session });
});

// User Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).send({ error: 'Email and password are required.' });
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return res.status(401).send({ error: error.message });
  }

  res.send({ user: data.user, session: data.session });
});

// Get User Profile (protected route example)
app.get('/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1]; // Bearer token

  if (!token) {
    return res.status(401).send({ error: 'Not authenticated' });
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error) {
    return res.status(401).send({ error: error.message });
  }

  res.send({ user });
});


// --- Server Start ---
app.listen(port, '0.0.0.0', () => {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  let localIP = 'localhost';
  
  // Find local IP address
  Object.keys(interfaces).forEach(name => {
    interfaces[name].forEach(iface => {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIP = iface.address;
      }
    });
  });
  
  console.log(`Auth service listening at:`);
  console.log(`  Local:    http://localhost:${port}`);
  console.log(`  Network:  http://${localIP}:${port}`);
  console.log(`\nFor Vercel deployment, use: http://${localIP}:${port}`);
});
