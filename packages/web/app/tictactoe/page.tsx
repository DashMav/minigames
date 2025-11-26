'use client';

import { useState, useEffect, useCallback, useMemo, memo, lazy, Suspense } from 'react';
import { createClient } from '@supabase/supabase-js';

// --- Supabase Client (for Realtime) ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bgiiiaxjairvwzqzbtjs.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnaWlpYXhqYWlydnd6cXpidGpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMTcxMTIsImV4cCI6MjA3OTY5MzExMn0.aWywOUilDqRTSnJXj9YLAMWTn084huSNs4nr1g14KmY';
const supabase = createClient(supabaseUrl, supabaseKey);

// Add CSS animations
const addCSSAnimations = () => {
  if (typeof document !== 'undefined' && !document.getElementById('game-animations')) {
    const style = document.createElement('style');
    style.id = 'game-animations';
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        50% { opacity: 0.7; transform: translate(-50%, -50%) scale(1.1); }
      }
      @keyframes cooldownCountdown {
        0% { transform: translate(-50%, -50%) scale(1) rotate(0deg); }
        100% { transform: translate(-50%, -50%) scale(1) rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
};

// Initialize animations
if (typeof window !== 'undefined') {
  addCSSAnimations();
}

// Connection pooling for fetch requests
const fetchWithPool = (() => {
  const controller = new AbortController();
  return (url: string, options: RequestInit = {}) => {
    return fetch(url, {
      ...options,
      signal: controller.signal,
      keepalive: true
    });
  };
})();


// --- Helper Components ---
const Square = memo(({ value, onClick, disabled, isCooldown }: { value: string | null; onClick: () => void; disabled: boolean; isCooldown?: boolean }) => {
  const getSquareStyle = () => {
    let bgColor = '#ffffff';
    let borderColor = '#e2e8f0';
    let shadow = '0 2px 4px rgba(0,0,0,0.1)';
    
    if (disabled && !value) {
      bgColor = '#f8fafc';
      borderColor = '#cbd5e1';
    } else if (isCooldown) {
      bgColor = '#fee2e2';
      borderColor = '#ef4444';
      shadow = '0 0 15px rgba(239, 68, 68, 0.5)';
    } else if (!disabled) {
      shadow = '0 4px 8px rgba(0,0,0,0.15)';
    }
    
    return {
      width: '100px',
      height: '100px',
      fontSize: '2.5rem',
      fontWeight: 'bold',
      border: `3px solid ${borderColor}`,
      borderRadius: '12px',
      backgroundColor: bgColor,
      color: value === 'X' ? '#ef4444' : value === 'O' ? '#3b82f6' : '#64748b',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'all 0.2s ease',
      boxShadow: shadow,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transform: disabled ? 'scale(0.95)' : 'scale(1)',
    };
  };
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={getSquareStyle()}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.2)';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
        }
      }}
    >
      {isCooldown && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '1rem',
          color: '#ef4444',
          fontWeight: 'bold',
          animation: 'pulse 1.5s infinite'
        }}>
          🚫
        </div>
      )}
      {value && !isCooldown && value}
    </button>
  );
});

// --- Type Definitions ---
interface GameState {
  board: (string | null)[];
  currentPlayer: 'X' | 'O';
  moves: { X: { position: number; moveIndex: number }[]; O: { position: number; moveIndex: number }[] };
  cooldownSpot: number | null;
  winner: 'X' | 'O' | null;
}

// --- Main Game Component ---
export default function TicTacToePage() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [optimisticMove, setOptimisticMove] = useState<{position: number, player: 'X' | 'O'} | null>(null);
  const [error, setError] = useState('');
  const [playerSymbol, setPlayerSymbol] = useState<'X' | 'O' | null>(null);
  const [gameStatus, setGameStatus] = useState<'waiting' | 'active' | 'completed'>('waiting');
  const [joinGameId, setJoinGameId] = useState('');
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [gameInitialized, setGameInitialized] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<{id: string, user_email: string, message: string, created_at: string}[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showChat, setShowChat] = useState(false);


  // Get user info on component mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      window.location.href = '/login';
      return;
    }
    
    // Decode token to get user email (simple JWT decode)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setUserEmail(payload.email || 'User');
    } catch (err) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    window.location.href = '/login';
  };

  const createOrJoinGame = async (specificGameId?: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const gameServiceUrl = process.env.NEXT_PUBLIC_GAME_URL;

      let url = `${gameServiceUrl}/games`;
      if (specificGameId) {
        url = `${gameServiceUrl}/games/${specificGameId}/join`;
      }
      
      const res = await fetchWithPool(url, { 
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();

      if (res.ok) {
        setGameId(data.gameId);
        setGameState(data.gameState);
        setPlayerSymbol(data.playerSymbol);
        setGameStatus(data.gameState?.currentPlayer ? 'active' : 'waiting');
        setGameInitialized(true);
        setError('');
        setShowJoinForm(false);

        return data.gameId;
      } else {
        console.error('Join/Create game failed:', res.status, data);
        if (res.status === 401) {
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
          return null;
        }
        setError('Failed to join/create game: ' + (data.error || 'Unknown error.'));
        return null;
      }
    } catch (err) {
      setError('Could not connect to the game service.');
      return null;
    }
  };

  // Global fetch functions
  const fetchChatMessages = useCallback(async () => {
    if (!gameId || !process.env.NEXT_PUBLIC_CHAT_URL) return;
    try {
      const chatServiceUrl = process.env.NEXT_PUBLIC_CHAT_URL;
      console.log('Fetching chat for gameId:', gameId);
      const res = await fetchWithPool(`${chatServiceUrl}/chat/${gameId}`);
      if (res.ok) {
        const data = await res.json();
        console.log('Chat messages received:', data.messages?.length || 0);
        setChatMessages(data.messages || []);
      } else {
        console.error('Chat fetch failed:', res.status);
      }
    } catch (err) {
      console.error('Chat fetch error:', err);
    }
  }, [gameId]);

  // Effect to subscribe to real-time updates when game is initialized
  useEffect(() => {
    if (!gameId || !gameInitialized) return;

    const setupRealtime = async () => {
      // Debounced fetch to prevent excessive API calls
      let fetchTimeout: NodeJS.Timeout;
      const fetchGameState = async () => {
        clearTimeout(fetchTimeout);
        fetchTimeout = setTimeout(async () => {
          // Skip fetch if component is unmounting
          if (!gameId) return;
          try {
            const gameServiceUrl = process.env.NEXT_PUBLIC_GAME_URL;
            const res = await fetchWithPool(`${gameServiceUrl}/games/${gameId}`);
            const data = await res.json();
            if (res.ok) {
              console.log('Game state updated:', data.gameInfo?.status);
              setGameState(data.gameState);
              setGameStatus(data.gameInfo?.status || 'waiting');
              setError('');
            } else {
              console.error('Game fetch failed:', res.status, data);
              setError('Failed to fetch game state: ' + (data.error || 'Unknown error.'));
            }
          } catch (err) {
            setError('Could not connect to the game service to fetch state.');
          }
        }, 100); // Faster response
      };
      
      // Fetch initial state
      fetchGameState();
      fetchChatMessages();

      // Event-driven real-time subscriptions
      const channel = supabase
        .channel(`game_${gameId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'moves', filter: `game_id=eq.${gameId}` },
          () => {
            console.log('Move detected, updating game state');
            setOptimisticMove(null);
            fetchGameState();
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
          () => {
            console.log('Game updated, fetching state');
            fetchGameState();
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `game_id=eq.${gameId}` },
          (payload) => {
            console.log('New chat message detected:', payload);
            fetchChatMessages();
          }
        )
        .subscribe();

      // Fallback polling every 10 seconds to catch missed events
      const fallbackInterval = setInterval(() => {
        fetchGameState();
        fetchChatMessages(); // Also poll chat messages
      }, 10000);
      
      // 1-second chat polling for near real-time updates
      const chatPollInterval = setInterval(() => {
        fetchChatMessages();
      }, 1000);

      // Cleanup subscription on component unmount
      return () => {
        clearInterval(fallbackInterval);
        clearInterval(chatPollInterval);
        supabase.removeChannel(channel);
      };
    };

    setupRealtime();
  }, [gameId, gameInitialized, gameStatus, fetchChatMessages]);

  const handleJoinGame = async () => {
    if (!joinGameId.trim()) {
      setError('Please enter a game ID');
      return;
    }
    await createOrJoinGame(joinGameId.trim());
  };

  const handleCreateNewGame = async () => {
    setGameId(null);
    setGameState(null);
    setPlayerSymbol(null);
    setGameStatus('waiting');
    setGameInitialized(false);
    await createOrJoinGame();
  };

  const handleQuitGame = async () => {
    if (!gameId) return;
    
    try {
      const token = localStorage.getItem('auth_token');
      const gameServiceUrl = process.env.NEXT_PUBLIC_GAME_URL;
      const res = await fetchWithPool(`${gameServiceUrl}/games/${gameId}/quit`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        // Reset to initial state
        setGameId(null);
        setGameState(null);
        setPlayerSymbol(null);
        setGameStatus('waiting');
        setGameInitialized(false);
        setError('');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to quit game');
      }
    } catch (err) {
      setError('Could not connect to the game service.');
    }
  };

  const handleMove = useCallback(async (position: number) => {
    if (!gameId || !gameState || gameState.winner) return;

    // Optimistic update
    setOptimisticMove({ position, player: playerSymbol! });
    
    try {
      const token = localStorage.getItem('auth_token');
      const gameServiceUrl = process.env.NEXT_PUBLIC_GAME_URL;
      const res = await fetchWithPool(`${gameServiceUrl}/games/${gameId}/move`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ position }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOptimisticMove(null); // Revert optimistic update
        setError(data.error || 'Invalid move.');
      } else {
        setError('');
        // Update game state immediately with server response
        if (data.gameState) {
          setGameState(data.gameState);
          setOptimisticMove(null);
        }
      }
    } catch (err) {
      setOptimisticMove(null); // Revert optimistic update
      setError('Could not connect to the game service.');
    }
  }, [gameId, gameState, playerSymbol]);

  const sendChatMessage = async () => {
    if (!newMessage.trim() || !gameId || !process.env.NEXT_PUBLIC_CHAT_URL) return;
    
    const messageText = newMessage.trim();
    
    // Optimistic update - show message immediately
    const optimisticMessage = {
      id: `temp-${Date.now()}`,
      user_email: userEmail || 'You',
      message: messageText,
      created_at: new Date().toISOString()
    };
    setChatMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');
    
    try {
      const token = localStorage.getItem('auth_token');
      const chatServiceUrl = process.env.NEXT_PUBLIC_CHAT_URL;
      const res = await fetchWithPool(`${chatServiceUrl}/chat/${gameId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: messageText })
      });
      
      if (!res.ok) {
        // Revert optimistic update on failure
        setChatMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
        setNewMessage(messageText); // Restore message
      }
    } catch (err) {
      // Revert optimistic update on error
      setChatMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
      setNewMessage(messageText); // Restore message
    }
  };



  const renderSquare = useCallback((i: number) => {
    const isCooldown = gameState?.cooldownSpot === i;
    const isMyTurn = gameState?.currentPlayer === playerSymbol;
    const gameNotActive = gameStatus !== 'active';
    
    // Show optimistic move if it exists
    let displayValue = gameState ? gameState.board[i] : null;
    if (optimisticMove && optimisticMove.position === i) {
      displayValue = optimisticMove.player;
    }
    
    return (
      <Square
        key={i}
        value={displayValue}
        onClick={() => handleMove(i)}
        disabled={!isMyTurn || isCooldown || !gameState || gameState.board[i] !== null || !!gameState.winner || gameNotActive}
        isCooldown={isCooldown}
      />
    );
  }, [gameState, playerSymbol, gameStatus, handleMove, optimisticMove]);

  // Memoize game board to prevent unnecessary re-renders
  const gameBoard = useMemo(() => {
    if (!gameState) return null;
    return (
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(3, 100px)',
        gap: '8px',
        padding: '20px',
        backgroundColor: '#f1f5f9',
        borderRadius: '16px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
      }}>
        {Array.from({ length: 9 }, (_, i) => renderSquare(i))}
      </div>
    );
  }, [gameState, renderSquare]);

  // --- Render Logic ---
  if (error) {
    return (
      <div style={{ textAlign: 'center', marginTop: '50px' }}>
        <div style={{ color: 'red', marginBottom: '20px' }}>Error: {error}</div>
        <button onClick={() => setError('')} style={{ padding: '10px 20px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '4px' }}>
          Try Again
        </button>
      </div>
    );
  }
  
  if (!gameInitialized) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        {/* User Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '14px', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '50%' }}></div>
            Logged in as: <strong style={{ color: '#1e293b' }}>{userEmail}</strong>
          </div>
          <button 
            onClick={handleLogout}
            style={{ padding: '8px 16px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
          >
            Logout
          </button>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px' }}>
          <h1 style={{ color: 'white', fontSize: '3.5rem', fontWeight: 'bold', marginBottom: '16px', textShadow: '0 4px 8px rgba(0,0,0,0.3)' }}>Infinite Tic-Tac-Toe</h1>
          <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '1.2rem', marginBottom: '40px', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>Choose an option to start playing:</div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
          <button 
            onClick={() => createOrJoinGame()}
            style={{ padding: '15px 30px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', fontSize: '16px', marginRight: '10px' }}
          >
            Create New Game
          </button>
        </div>
        
        <div style={{ marginTop: '20px' }}>
          <button 
            onClick={() => setShowJoinForm(!showJoinForm)}
            style={{ padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            {showJoinForm ? 'Cancel' : 'Join Existing Game'}
          </button>
          {showJoinForm && (
            <div style={{ marginTop: '20px' }}>
              <input
                type="text"
                placeholder="Enter Game ID"
                value={joinGameId}
                onChange={(e) => setJoinGameId(e.target.value)}
                style={{ padding: '8px', marginRight: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
              <button 
                onClick={handleJoinGame}
                style={{ padding: '8px 16px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '4px' }}
              >
                Join Game
              </button>
            </div>
          )}
        </div>
        </div>
      </div>
    );
  }
  
  if (!gameState) {
    return <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading Game...</div>;
  }

  let status;
  if (gameStatus === 'waiting') {
    status = 'Waiting for second player to join...';
  } else if (gameState.winner) {
    status = gameState.winner === playerSymbol ? 'You Win!' : `Player ${gameState.winner} Wins!`;
  } else {
    status = gameState.currentPlayer === playerSymbol ? 'Your Turn' : `Player ${gameState.currentPlayer}'s Turn`;
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      {/* User Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
        <div style={{ fontSize: '14px', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '50%' }}></div>
          Logged in as: <strong style={{ color: '#1e293b' }}>{userEmail}</strong>
        </div>
        <button 
          onClick={handleLogout}
          style={{ padding: '8px 16px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
        >
          Logout
        </button>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px' }}>
        <h1 style={{ color: 'white', fontSize: '3rem', fontWeight: 'bold', marginBottom: '20px', textShadow: '0 4px 8px rgba(0,0,0,0.3)' }}>Infinite Tic-Tac-Toe</h1>
        
        <div style={{ backgroundColor: 'rgba(255,255,255,0.9)', padding: '16px 24px', borderRadius: '12px', marginBottom: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          <div style={{ fontSize: '1.1rem', color: '#475569', marginBottom: '8px' }}>You are playing as:</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: playerSymbol === 'X' ? '#ef4444' : '#3b82f6', textAlign: 'center' }}>{playerSymbol}</div>
        </div>
        
        <div style={{ 
          fontSize: '1.3rem', 
          fontWeight: '600', 
          color: 'white', 
          marginBottom: '30px', 
          padding: '12px 24px', 
          backgroundColor: gameStatus === 'active' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)', 
          borderRadius: '8px',
          border: `2px solid ${gameStatus === 'active' ? '#10b981' : '#f59e0b'}`,
          textShadow: '0 2px 4px rgba(0,0,0,0.3)'
        }}>
          {status}
        </div>
        {gameBoard}
        
        {/* Quit Game Button */}
        {(gameStatus === 'active' || gameStatus === 'waiting') && (
          <div style={{ marginTop: '20px' }}>
            <button 
              onClick={handleQuitGame}
              style={{ 
                padding: '10px 20px', 
                backgroundColor: '#dc2626', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
            >
              Quit Game
            </button>
          </div>
        )}
        
        {gameState.cooldownSpot !== null && (
          <div style={{ 
            marginTop: '20px', 
            padding: '16px 24px', 
            backgroundColor: 'rgba(239, 68, 68, 0.1)', 
            border: '2px solid #ef4444', 
            borderRadius: '12px',
            color: '#dc2626',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)'
          }}>
            <div style={{ 
              width: '16px', 
              height: '16px', 
              backgroundColor: '#ef4444', 
              borderRadius: '50%', 
              animation: 'pulse 1.5s infinite',
              boxShadow: '0 0 8px rgba(239, 68, 68, 0.4)'
            }}></div>
            <span>🚫 Position {gameState.cooldownSpot + 1} is blocked - oldest move removed!</span>
          </div>
        )}
        

        
        {/* Debug: Manual Refresh */}
        <button 
          onClick={() => { fetchChatMessages(); }}
          style={{
            position: 'fixed',
            top: '100px',
            right: '20px',
            padding: '8px',
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: 'pointer',
            zIndex: 1000
          }}
        >
          Refresh Chat
        </button>
        
        {/* Chat Toggle */}
        {gameId && process.env.NEXT_PUBLIC_CHAT_URL && (
          <button 
            onClick={() => setShowChat(!showChat)}
            style={{
              position: 'fixed',
              bottom: '20px',
              right: '20px',
              padding: '12px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              fontSize: '20px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              zIndex: 1000
            }}
          >
            💬
          </button>
        )}
        
        {/* Chat Box */}
        {showChat && gameStatus === 'active' && (
          <div style={{
            position: 'fixed',
            bottom: '80px',
            right: '20px',
            width: '300px',
            height: '400px',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1000
          }}>
            <div style={{
              padding: '16px',
              borderBottom: '1px solid #e2e8f0',
              fontWeight: '600',
              color: '#1e293b',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              Chat
              <button 
                onClick={() => setShowChat(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  color: '#64748b'
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{
              flex: 1,
              padding: '12px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              {chatMessages.map((msg) => (
                <div key={msg.id} style={{
                  padding: '8px 12px',
                  backgroundColor: msg.user_email === userEmail ? '#dbeafe' : '#f1f5f9',
                  borderRadius: '8px',
                  fontSize: '14px',
                  alignSelf: msg.user_email === userEmail ? 'flex-end' : 'flex-start',
                  maxWidth: '80%'
                }}>
                  <div style={{ fontWeight: '600', fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>
                    {msg.user_email === userEmail ? 'You' : msg.user_email}
                  </div>
                  <div style={{ color: '#000000' }}>{msg.message}</div>
                </div>
              ))}
            </div>
            
            <div style={{
              padding: '12px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              gap: '8px'
            }}>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                placeholder="Type a message..."
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none',
                  color: '#000000'
                }}
              />
              <button
                onClick={sendChatMessage}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Send
              </button>
            </div>
          </div>
        )}
        
        {gameStatus === 'waiting' && (
          <div style={{ marginTop: '30px', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.9)', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
            <div style={{ fontSize: '1.1rem', color: '#475569', marginBottom: '12px' }}>Share this Game ID with a friend:</div>
            <div style={{ 
              fontSize: '1.5rem', 
              fontWeight: 'bold', 
              color: '#1e293b', 
              backgroundColor: '#f1f5f9', 
              padding: '12px 20px', 
              borderRadius: '8px', 
              marginBottom: '16px',
              fontFamily: 'monospace',
              letterSpacing: '1px'
            }}>
              {gameId}
            </div>
            <button 
              onClick={handleCreateNewGame}
              style={{ 
                padding: '12px 24px', 
                backgroundColor: '#6366f1', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4f46e5'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6366f1'}
            >
              Create New Game
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
