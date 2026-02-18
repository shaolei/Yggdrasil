FROM mcr.microsoft.com/devcontainers/typescript-node:22

# Install prerequisites
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    ca-certificates \
    wget \
    apt-transport-https \
    && mkdir -p /etc/apt/keyrings

# Configure path
ENV PATH="/usr/local/bin:/usr/bin:${PATH}"

# Clean up
RUN apt-get clean && rm -rf /var/lib/apt/lists/*

ENV SHELL=/bin/bash
