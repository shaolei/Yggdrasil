#!/bin/bash
set -e

echo "=== Setting up Yggdrasil development environment ==="

# Ensure named volumes are writable by the node user
sudo chown node:node source/cli/node_modules source/cli/dist docs/node_modules

# Make scripts executable (repo-check.sh etc.)
chmod +x scripts/*.sh 2>/dev/null || true

# Install CLI dependencies and link globally
cd source/cli
npm install
npm run build
npm link
cd ../..

# Install docs dependencies
cd docs
npm install
cd ..

echo "=== yg CLI linked globally ==="
yg --version

echo "=== Setup complete ==="
