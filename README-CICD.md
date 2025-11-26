# CI/CD Setup Guide

## GitHub Actions (Cloud CI/CD)

### Setup Steps:

1. **Create Docker Hub account** and get your username

2. **Add GitHub Secrets:**
   - Go to your GitHub repo → Settings → Secrets and variables → Actions
   - Add these secrets:
     - `DOCKER_USERNAME`: Your Docker Hub username
     - `DOCKER_PASSWORD`: Your Docker Hub password/token

3. **Update kustomization.yaml:**
   - Replace `your-dockerhub-username` with your actual Docker Hub username

4. **Push to trigger deployment:**
   ```bash
   git add .
   git commit -m "Add CI/CD pipeline"
   git push
   ```

## Local CI/CD (Quick Deploy)

For local development with instant deployment:

```bash
# Windows
scripts\deploy.bat

# The script will:
# 1. Build all Docker images
# 2. Deploy to Kubernetes
# 3. Restart all services
# 4. Show access URL
```

## Features

- **Automatic builds** on every push to master/main
- **Docker image versioning** with git commit SHA
- **Zero-downtime deployments** with rolling updates
- **Local development** script for instant testing

## Workflow

1. **Code** → Push to GitHub
2. **GitHub Actions** → Build & push Docker images
3. **Kubernetes** → Pull new images & deploy
4. **Access** → http://localhost:30000

This gives you Vercel-like instant deployments for your Kubernetes setup!