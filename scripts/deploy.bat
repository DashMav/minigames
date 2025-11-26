@echo off
echo Building images...
docker build -t minigames/web:latest ./packages/web
docker build -t minigames/auth:latest ./packages/auth
docker build -t minigames/tictactoe:latest ./packages/tictactoe
docker build -t minigames/chat:latest ./packages/chat

echo Deploying to Kubernetes...
kubectl apply -f k8s/

echo Restarting deployments...
kubectl rollout restart deployment/web -n minigames
kubectl rollout restart deployment/auth -n minigames
kubectl rollout restart deployment/tictactoe -n minigames
kubectl rollout restart deployment/chat -n minigames

echo Deployment complete!
echo Access your app at: http://localhost:30000