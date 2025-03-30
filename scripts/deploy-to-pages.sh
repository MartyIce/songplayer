#!/bin/bash

# Exit on any error
set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
SOURCE_DIR="$(pwd)/build"
TARGET_DIR="/Users/martymavis/Develop/martyice.github.io/tabs"
GITHUB_PAGES_DIR="/Users/martymavis/Develop/martyice.github.io"

echo -e "${GREEN}🚀 Starting deployment process...${NC}"

# Build the project
echo -e "\n${GREEN}📦 Building project...${NC}"
npm run build

# Ensure target directory exists
echo -e "\n${GREEN}📁 Preparing target directory...${NC}"
rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"

# Copy files
echo -e "\n${GREEN}📋 Copying build files...${NC}"
cp -R "$SOURCE_DIR"/* "$TARGET_DIR/"

# Git operations
echo -e "\n${GREEN}🔄 Committing changes to GitHub Pages...${NC}"
cd "$GITHUB_PAGES_DIR"

# Check if there are changes to commit
if [[ -n $(git status -s) ]]; then
    git add .
    git commit -m "Update tabs directory with latest build $(date '+%Y-%m-%d %H:%M:%S')"
    git push
    echo -e "\n${GREEN}✅ Deployment successful!${NC}"
else
    echo -e "\n${GREEN}ℹ️ No changes to deploy${NC}"
fi

# Return to original directory
cd - > /dev/null

echo -e "\n${GREEN}🎉 All done!${NC}" 