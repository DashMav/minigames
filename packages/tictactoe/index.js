require('dotenv').config({ path: '../../.env' });
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = 3002;

// --- Supabase Initialization ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Performance: In-memory cache ---
const gameCache = new Map();
const CACHE_TTL = 30000; // 30 seconds

// --- Middleware ---
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://localhost:3000',
    'https://minigames-web-ibcx.vercel.app',
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

// --- Game Logic Helpers ---

const checkWinner = (board) => {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  for (let i = 0; i < lines.length; i++) {
    const [a, b, c] = lines[i];
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
};

// Reconstructs the game state from a list of moves and game info
const reconstructGameState = (moves, gameInfo) => {
  const board = Array(9).fill(null);
  const playerMoves = { 'X': [], 'O': [] };
  
  // Sort moves by created_at timestamp
  moves.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  moves.forEach((move, index) => {
    // Determine player symbol based on game assignment
    let player;
    if (move.player_id === gameInfo.player1_id) {
      player = 'X';
    } else if (move.player_id === gameInfo.player2_id) {
      player = 'O';
    } else {
      return; // Skip invalid moves
    }
    
    playerMoves[player].push({ position: move.position, moveIndex: index });
  });

  // Apply the 3-move limit - keep only last 3 moves per player
  const activeXMoves = playerMoves['X'].slice(-3);
  const activeOMoves = playerMoves['O'].slice(-3);
  
  activeXMoves.forEach(move => board[move.position] = 'X');
  activeOMoves.forEach(move => board[move.position] = 'O');

  const currentPlayer = moves.length % 2 === 0 ? 'X' : 'O';
  const winner = checkWinner(board);
  
  // Determine cooldown spot - position that was just removed when a player exceeded 3 moves
  let cooldownSpot = null;
  
  // The cooldown spot is the position of the move that was just removed
  // This happens when a player has exactly 3 moves on the board but had 4+ total moves
  if (moves.length >= 7) { // At least 7 total moves means someone has made 4+ moves
    // Find which player just made a move that caused removal
    const lastMove = moves[moves.length - 1];
    const lastPlayer = lastMove.player_id === gameInfo.player1_id ? 'X' : 'O';
    
    // Count how many moves this player has made total
    const playerTotalMoves = moves.filter(move => {
      const movePlayer = move.player_id === gameInfo.player1_id ? 'X' : 'O';
      return movePlayer === lastPlayer;
    }).length;
    
    // If this player has made 4+ moves, find what was removed
    if (playerTotalMoves >= 4) {
      // Find the oldest move by this player that's not on the current board
      const playerAllMoves = moves.filter(move => {
        const movePlayer = move.player_id === gameInfo.player1_id ? 'X' : 'O';
        return movePlayer === lastPlayer;
      }).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      
      // The removed position is the oldest move that's not in the current active moves
      const activeMoves = playerMoves[lastPlayer];
      const removedMove = playerAllMoves.find(move => 
        !activeMoves.some(activeMove => activeMove.position === move.position)
      );
      
      if (removedMove) {
        cooldownSpot = removedMove.position;
      }
    }
  }

  return { board, currentPlayer, winner, cooldownSpot, moves: { X: playerMoves['X'], O: playerMoves['O'] } };
};


// --- API Endpoints ---

// Join a specific game by ID
app.post('/games/:gameId/join', async (req, res) => {
  const { gameId } = req.params;
  const token = req.headers.authorization?.split(' ')[1];
  
  console.log('Join request for game:', gameId);
  
  if (!token) {
    return res.status(401).send({ error: 'Authentication required' });
  }
  
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    console.log('Auth error:', authError);
    return res.status(401).send({ error: 'Invalid token' });
  }
  
  const player_id = user.id;
  console.log('Player trying to join:', player_id);

  // Get the specific game
  const { data: gameData, error: gameError } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single();

  if (gameError || !gameData) {
    console.log('Game not found:', gameError);
    return res.status(404).send({ error: 'Game not found' });
  }

  console.log('Game data:', gameData);

  if (gameData.status !== 'waiting') {
    console.log('Game status is not waiting:', gameData.status);
    return res.status(400).send({ error: `Game is not available to join. Status: ${gameData.status}` });
  }

  if (gameData.player1_id === player_id) {
    console.log('Player is already player1, returning existing game');
    return res.status(200).send({
      gameId: gameData.id,
      playerSymbol: 'X',
      gameState: {
        board: Array(9).fill(null),
        currentPlayer: 'X',
        winner: null,
        cooldownSpot: null,
        moves: { X: [], O: [] }
      }
    });
  }

  if (gameData.player2_id) {
    console.log('Game already has player2:', gameData.player2_id);
    return res.status(400).send({ error: 'Game is already full' });
  }

  // Join the game as player 2
  const { data: updatedGame, error: updateError } = await supabase
    .from('games')
    .update({ player2_id: player_id, status: 'active' })
    .eq('id', gameId)
    .select()
    .single();
  
  if (updateError) {
    return res.status(500).send({ error: updateError.message });
  }

  // Clear cache to ensure fresh state
  gameCache.delete(gameId);
  console.log('Player 2 joined, game status updated to active');

  res.status(200).send({
    gameId: updatedGame.id,
    playerSymbol: 'O', // Second player is always O
    gameState: {
      board: Array(9).fill(null),
      currentPlayer: 'X',
      winner: null,
      cooldownSpot: null,
      moves: { X: [], O: [] }
    }
  });
});

// Create a new game or join existing one
app.post('/games', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).send({ error: 'Authentication required' });
  }
  
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).send({ error: 'Invalid token' });
  }
  
  const player_id = user.id;

  // Create new game as player 1 (no auto-matching for now)
  const { data: gameData, error } = await supabase
    .from('games')
    .insert([{ player1_id: player_id, player2_id: null, status: 'waiting' }])
    .select()
    .single();

  if (error) {
    return res.status(500).send({ error: error.message });
  }

  // Send back the initial state
  res.status(201).send({
    gameId: gameData.id,
    playerSymbol: gameData.player1_id === player_id ? 'X' : 'O',
    gameState: {
      board: Array(9).fill(null),
      currentPlayer: 'X',
      winner: null,
      cooldownSpot: null,
      moves: { X: [], O: [] }
    }
  });
});

// Get game state with caching
app.get('/games/:gameId', async (req, res) => {
    const { gameId } = req.params;
    
    // Check cache first
    const cached = gameCache.get(gameId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return res.send(cached.data);
    }
    
    // Single query to get both game and moves
    const [gameResult, movesResult] = await Promise.all([
        supabase.from('games').select('*').eq('id', gameId).single(),
        supabase.from('moves').select('*').eq('game_id', gameId).order('created_at')
    ]);
    
    if (gameResult.error) {
        return res.status(500).send({ error: gameResult.error.message });
    }
    
    if (movesResult.error) {
        return res.status(500).send({ error: movesResult.error.message });
    }

    const gameState = reconstructGameState(movesResult.data || [], gameResult.data);
    const response = { gameId, gameState, gameInfo: gameResult.data };
    
    // Cache the result
    gameCache.set(gameId, { data: response, timestamp: Date.now() });
    
    res.send(response);
});

// Make a move
app.post('/games/:gameId/move', async (req, res) => {
  const { gameId } = req.params;
  const { position } = req.body;
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).send({ error: 'Authentication required' });
  }
  
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).send({ error: 'Invalid token' });
  }
  
  const player_id = user.id;

  // 1. Get game info
  const { data: gameInfo, error: gameError } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single();
  
  if (gameError) {
    return res.status(500).send({ error: gameError.message });
  }
  
  // 2. Check if game is active and player is part of it
  if (gameInfo.status !== 'active') {
    return res.status(400).send({ error: 'Game is not active. Waiting for second player.' });
  }
  
  if (player_id !== gameInfo.player1_id && player_id !== gameInfo.player2_id) {
    return res.status(403).send({ error: 'You are not part of this game.' });
  }

  // 3. Fetch current moves (optimized query)
  const { data: moves, error: fetchError } = await supabase
    .from('moves')
    .select('player_id, position, created_at')
    .eq('game_id', gameId)
    .order('created_at');

  if (fetchError) {
    return res.status(500).send({ error: fetchError.message });
  }

  const { board, currentPlayer, winner, cooldownSpot } = reconstructGameState(moves || [], gameInfo);
  
  // 4. Determine player symbol and validate turn
  const playerSymbol = player_id === gameInfo.player1_id ? 'X' : 'O';
  
  if (playerSymbol !== currentPlayer) {
    return res.status(400).send({ error: 'It is not your turn.' });
  }

  // 5. Validate the move
  if (winner) {
    return res.status(400).send({ error: 'Game is already over.' });
  }
  
  if (position < 0 || position > 8) {
    return res.status(400).send({ error: 'Invalid position.' });
  }
  
  if (board[position] !== null) {
    return res.status(400).send({ error: 'Spot is already taken.' });
  }
  
  if (position === cooldownSpot) {
    return res.status(400).send({ error: 'This position is blocked - it was just cleared from an old move!' });
  }

  // 6. Insert the new move
  const { error: insertError } = await supabase
    .from('moves')
    .insert([{ game_id: gameId, player_id, position }]);
  
  if (insertError) {
    return res.status(500).send({ error: insertError.message });
  }
  
  // 7. Clear cache and return optimized state
  gameCache.delete(gameId);
  
  // Optimized: reconstruct state from existing moves + new move
  const newMove = { player_id, position, created_at: new Date().toISOString() };
  const allMoves = [...(moves || []), newMove];
  const newGameState = reconstructGameState(allMoves, gameInfo);
  
  // 8. If there's a winner, update the games table
  if (newGameState.winner) {
    const winnerId = newGameState.winner === 'X' ? gameInfo.player1_id : gameInfo.player2_id;
    await supabase
      .from('games')
      .update({ status: 'completed', winner_id: winnerId })
      .eq('id', gameId);
  }

  res.send({ gameState: newGameState });
});

// Quit game
app.post('/games/:gameId/quit', async (req, res) => {
  const { gameId } = req.params;
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).send({ error: 'Authentication required' });
  }
  
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).send({ error: 'Invalid token' });
  }
  
  const player_id = user.id;

  // Get game info
  const { data: gameInfo, error: gameError } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single();
  
  if (gameError) {
    return res.status(500).send({ error: gameError.message });
  }
  
  // Check if player is part of the game
  if (player_id !== gameInfo.player1_id && player_id !== gameInfo.player2_id) {
    return res.status(403).send({ error: 'You are not part of this game.' });
  }

  // Determine winner (the other player)
  const winnerId = player_id === gameInfo.player1_id ? gameInfo.player2_id : gameInfo.player1_id;
  
  // Update game status to completed with winner
  const { error: updateError } = await supabase
    .from('games')
    .update({ status: 'completed', winner_id: winnerId })
    .eq('id', gameId);
  
  if (updateError) {
    return res.status(500).send({ error: updateError.message });
  }
  
  // Clear cache
  gameCache.delete(gameId);
  
  res.send({ message: 'Game quit successfully' });
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
  
  console.log(`TicTacToe service listening at:`);
  console.log(`  Local:    http://localhost:${port}`);
  console.log(`  Network:  http://${localIP}:${port}`);
  console.log(`\nFor Vercel deployment, use: http://${localIP}:${port}`);
});
