# Docker Desktop Kubernetes Setup

## Prerequisites

1. **Install Docker Desktop**
2. **Enable Kubernetes in Docker Desktop:**
   - Open Docker Desktop
   - Go to Settings → Kubernetes
   - Check "Enable Kubernetes"
   - Click "Apply & Restart"

## Quick Setup

Run the setup script:
```bash
./setup-k8s.bat
```

## Manual Setup

1. **Build images:**
   ```bash
   docker build -t minigames/web:latest ./packages/web
   docker build -t minigames/auth:latest ./packages/auth
   docker build -t minigames/tictactoe:latest ./packages/tictactoe
   docker build -t minigames/chat:latest ./packages/chat
   ```

2. **Deploy to Kubernetes:**
   ```bash
   kubectl create namespace minigames
   kubectl apply -f k8s/
   ```

3. **Check status:**
   ```bash
   kubectl get pods -n minigames
   kubectl get services -n minigames
   ```

## Access Points

- **Web App**: http://localhost:30000
- **Auth API**: http://localhost:30001
- **Game API**: http://localhost:30002
- **Chat API**: http://localhost:30003

## Cleanup

```bash
kubectl delete namespace minigames
```