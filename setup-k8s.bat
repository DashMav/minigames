@echo off
echo Setting up Minigames on Docker Desktop Kubernetes...

echo.
echo 1. Building Docker images...
docker build -t minigames/web:latest ./packages/web
docker build -t minigames/auth:latest ./packages/auth
docker build -t minigames/tictactoe:latest ./packages/tictactoe
docker build -t minigames/chat:latest ./packages/chat

echo.
echo 2. Creating namespace...
kubectl create namespace minigames --dry-run=client -o yaml | kubectl apply -f -

echo.
echo 3. Applying Kubernetes manifests...
kubectl apply -f k8s/

echo.
echo 4. Waiting for pods to be ready...
kubectl wait --for=condition=ready pod -l app=web -n minigames --timeout=300s
kubectl wait --for=condition=ready pod -l app=auth -n minigames --timeout=300s
kubectl wait --for=condition=ready pod -l app=tictactoe -n minigames --timeout=300s
kubectl wait --for=condition=ready pod -l app=chat -n minigames --timeout=300s

echo.
echo 5. Getting service info...
kubectl get services -n minigames

echo.
echo Setup complete! Access the app at http://localhost:3000