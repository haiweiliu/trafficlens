#!/bin/bash
# Script to push TrafficLens to GitHub

echo "🚀 Setting up Git repository..."

# Initialize git if not already done
if [ ! -d .git ]; then
    echo "📦 Initializing git repository..."
    git init
    git branch -M main
fi

# Add GitHub remote (update if your username is different)
echo "🔗 Adding GitHub remote..."
git remote remove origin 2>/dev/null
git remote add origin https://github.com/haiweiliu/trafficlens.git

# Add all files
echo "📝 Adding files..."
git add .

# Create commit
echo "💾 Creating commit..."
git commit -m "Initial commit: Traffic Bulk Extractor with parallel processing"

# Push to GitHub
echo "⬆️  Pushing to GitHub..."
echo ""
echo "⚠️  You may be prompted for GitHub credentials"
echo ""

git push -u origin main

echo ""
echo "✅ Done! Your code is now on GitHub"
echo "📋 Next step: Go to https://vercel.com/new and import your repository"
