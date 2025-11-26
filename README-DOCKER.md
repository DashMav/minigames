# Docker Self-Hosting Guide

## Quick Start

1. **Copy environment file:**
   ```bash
   cp .env.docker .env
   ```

2. **Edit `.env` with your Supabase credentials:**
   - Get your service role key from Supabase dashboard
   - Set a secure JWT_SECRET

3. **Build and run:**
   ```bash
   docker-compose up --build
   ```

4. **Access the application:**
   - Web: http://localhost:3000
   - Auth API: http://localhost:3001
   - Game API: http://localhost:3002
   - Chat API: http://localhost:3003

## Production Deployment

For production, update the environment variables in docker-compose.yml to use your domain:

```yaml
environment:
  - NEXT_PUBLIC_AUTH_URL=https://your-domain.com:3001
  - NEXT_PUBLIC_GAME_URL=https://your-domain.com:3002
  - NEXT_PUBLIC_CHAT_URL=https://your-domain.com:3003
```

## Services

- **web**: Next.js frontend (port 3000)
- **auth**: Authentication service (port 3001)
- **tictactoe**: Game logic service (port 3002)
- **chat**: Chat messaging service (port 3003)

All services connect to your existing Supabase database.