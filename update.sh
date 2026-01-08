#!/bin/bash

# Messaging Matrix - Production Update Script
# Usage: ./update.sh
# Or with npm: npm run update

set -e  # Exit on any error

echo "========================================"
echo "  Messaging Matrix - Production Update"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory (works even if called from different location)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${YELLOW}[1/4]${NC} Pulling latest changes from git..."
git pull
echo -e "${GREEN}Done!${NC}"
echo ""

echo -e "${YELLOW}[2/4]${NC} Installing dependencies (if any new)..."
npm install --production=false
echo -e "${GREEN}Done!${NC}"
echo ""

echo -e "${YELLOW}[3/4]${NC} Building frontend..."
npm run build
echo -e "${GREEN}Done!${NC}"
echo ""

echo -e "${YELLOW}[4/4]${NC} Restarting PM2 processes..."
pm2 restart all
echo -e "${GREEN}Done!${NC}"
echo ""

echo "========================================"
echo -e "${GREEN}  Update complete!${NC}"
echo "========================================"
echo ""
echo "PM2 Status:"
pm2 list
