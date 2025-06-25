#!/bin/bash

# Vibesale Backend Docker Deployment Script

set -e

echo "🚀 Starting Vibesale Backend deployment..."

# Stop existing containers
echo "📦 Stopping existing containers..."
docker-compose down || true

# Clean up unused Docker resources
echo "🧹 Cleaning up Docker resources..."
docker system prune -f

# Build and start containers
echo "🔨 Building and starting containers..."
docker-compose build --no-cache
docker-compose up -d

# Wait for application to be ready
echo "⏳ Waiting for application to be ready..."
sleep 30

# Check if application is running
echo "🔍 Checking application health..."
if curl -f http://localhost:2020/health; then
    echo "✅ Application is healthy and running!"
    echo "📊 Application URL: http://localhost:2020"
    echo "📚 API Docs: http://localhost:2020/api-docs"
    echo "📈 Prometheus: http://localhost:9090"
    echo "📊 Grafana: http://localhost:3000 (admin/admin)"
else
    echo "❌ Application health check failed!"
    echo "📋 Container logs:"
    docker-compose logs app
    exit 1
fi

echo "🎉 Deployment completed successfully!" 