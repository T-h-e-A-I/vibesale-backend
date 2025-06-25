#!/bin/bash

# Quick Update Script for Vibesale Backend

echo "🔄 Quick update - pulling latest changes and redeploying..."

# Pull latest changes
git pull origin main

# Run deployment
./deploy.sh 