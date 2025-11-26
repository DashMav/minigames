# Vercel Deployment with Local Backend

## Setup Instructions

### 1. Prepare Local Backend
Your local backend services need to accept connections from Vercel:

```bash
# Start your local services
npm run dev:auth      # Port 3001
npm run dev:tictactoe # Port 3002
```

### 2. Configure CORS (Already Done)
The backend services are now configured to accept requests from:
- `localhost:3000` (local development)
- `*.vercel.app` (your Vercel deployment)
- `*.netlify.app` (backup option)

### 3. Get Your Local IP Address
For external access, you may need your local IP:

**Windows:**
```cmd
ipconfig
```
Look for "IPv4 Address" (usually 192.168.x.x)

**Mac/Linux:**
```bash
ifconfig | grep inet
```

### 4. Deploy to Vercel

#### Option A: Vercel CLI
```bash
npm install -g vercel
cd packages/web
vercel
```

#### Option B: GitHub Integration
1. Push code to GitHub
2. Connect repository in Vercel dashboard
3. Deploy automatically

### 5. Set Environment Variables in Vercel
In your Vercel dashboard → Settings → Environment Variables:

```
NEXT_PUBLIC_AUTH_URL=http://localhost:3001
NEXT_PUBLIC_GAME_URL=http://localhost:3002
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**If using local IP for external access:**
```
NEXT_PUBLIC_AUTH_URL=http://192.168.1.100:3001
NEXT_PUBLIC_GAME_URL=http://192.168.1.100:3002
```

### 6. Firewall Configuration
Ensure your local firewall allows incoming connections on ports 3001 and 3002.

**Windows Firewall:**
1. Windows Security → Firewall & network protection
2. Allow an app through firewall
3. Add Node.js or allow ports 3001, 3002

### 7. Router Configuration (If Needed)
If using local IP, you may need to configure port forwarding on your router for external access.

## Testing
1. Deploy to Vercel
2. Visit your Vercel URL
3. Try signing up/logging in
4. Test game functionality

## Troubleshooting

### CORS Errors
- Check browser console for specific CORS errors
- Verify environment variables in Vercel
- Ensure local services are running

### Connection Refused
- Verify local services are running on correct ports
- Check firewall settings
- Try using local IP instead of localhost

### Mixed Content (HTTP/HTTPS)
If Vercel (HTTPS) can't connect to local HTTP:
- Use ngrok to create HTTPS tunnel to local services
- Or deploy backend to a service with HTTPS

## Alternative: Using ngrok
For HTTPS tunneling to local services:

```bash
# Install ngrok
npm install -g ngrok

# Tunnel auth service
ngrok http 3001

# Tunnel game service (in another terminal)
ngrok http 3002
```

Then use the ngrok HTTPS URLs in Vercel environment variables.