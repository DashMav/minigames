# Kubernetes Deployment

## Deploy to Kubernetes

1. **Create namespace:**
   ```bash
   kubectl create namespace minigames
   ```

2. **Apply configurations:**
   ```bash
   kubectl apply -f k8s/
   ```

3. **Check status:**
   ```bash
   kubectl get pods -n minigames
   kubectl get services -n minigames
   ```

## Build and Push Images

```bash
# Build images
docker build -t minigames/web:latest ./packages/web
docker build -t minigames/auth:latest ./packages/auth
docker build -t minigames/tictactoe:latest ./packages/tictactoe
docker build -t minigames/chat:latest ./packages/chat

# Push to registry (replace with your registry)
docker push minigames/web:latest
docker push minigames/auth:latest
docker push minigames/tictactoe:latest
docker push minigames/chat:latest
```

## Features

- **High Availability**: 2 replicas per service
- **Load Balancing**: Automatic traffic distribution
- **Service Discovery**: Internal service communication
- **Scalability**: Easy horizontal scaling