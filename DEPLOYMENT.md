# Deployment Guide

## Prerequisites
- Node.js 18+ 
- Supabase account and project
- Domain/hosting service (Vercel, Netlify, Railway, etc.)

## Environment Setup

### 1. Supabase Configuration
1. Create a Supabase project at https://supabase.com
2. Go to Settings > API to get your keys
3. Create these tables in SQL Editor:

```sql
-- Games table
CREATE TABLE games (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player1_id UUID REFERENCES auth.users(id),
  player2_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'completed')),
  winner_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Moves table  
CREATE TABLE moves (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID REFERENCES auth.users(id),
  position INTEGER CHECK (position >= 0 AND position <= 8),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE moves ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view games they're part of" ON games
  FOR SELECT USING (player1_id = auth.uid() OR player2_id = auth.uid());

CREATE POLICY "Users can create games" ON games
  FOR INSERT WITH CHECK (player1_id = auth.uid());

CREATE POLICY "Users can update games they're part of" ON games
  FOR UPDATE USING (player1_id = auth.uid() OR player2_id = auth.uid());

CREATE POLICY "Users can view moves for their games" ON moves
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM games 
      WHERE games.id = moves.game_id 
      AND (games.player1_id = auth.uid() OR games.player2_id = auth.uid())
    )
  );

CREATE POLICY "Users can create moves for their games" ON moves
  FOR INSERT WITH CHECK (
    player_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM games 
      WHERE games.id = moves.game_id 
      AND (games.player1_id = auth.uid() OR games.player2_id = auth.uid())
    )
  );
```

### 2. Environment Variables
Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

## Local Development
```bash
npm install
npm run dev:auth    # Terminal 1 - Auth service (port 3001)
npm run dev:tictactoe # Terminal 2 - Game service (port 3002)  
npm run dev:web     # Terminal 3 - Frontend (port 3000)
```

## Production Deployment

### Option 1: Vercel (Recommended for Frontend)
1. Deploy frontend to Vercel
2. Deploy backend services to Railway/Render
3. Update environment variables

### Option 2: Railway (Full Stack)
1. Connect GitHub repository
2. Deploy all services together
3. Configure environment variables

### Option 3: Docker
```bash
# Build and run with Docker Compose
docker-compose up --build
```

## Environment Variables for Production
- `NEXT_PUBLIC_AUTH_URL` - Auth service URL
- `NEXT_PUBLIC_GAME_URL` - Game service URL  
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

## Post-Deployment Checklist
- [ ] Supabase tables created
- [ ] RLS policies enabled
- [ ] Environment variables set
- [ ] All services running
- [ ] Email verification working
- [ ] Real-time updates working
- [ ] Game creation/joining working