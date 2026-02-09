# --- Stage 1: Build Phase ---
FROM node:18-slim AS builder

WORKDIR /app

# Copy root configurations
COPY package*.json ./
COPY tsconfig.json ./

# Copy each package json to its destination to cache layers
COPY client/package*.json ./client/
COPY server/package*.json ./server/
COPY shared/package*.json ./shared/

# Install root dependencies (including workspaces)
RUN npm install

# Copy source code
COPY . .

# Build Client
RUN npm run build:client

# Build Server (TypeScript compilation)
RUN npm run build:server

# --- Stage 2: Production Phase ---
FROM node:18-slim

# Install Puppeteer dependencies
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/
COPY shared/package*.json ./shared/

# Install ONLY production dependencies
RUN npm install --omit=dev

# Copy built assets and necessary runtime files
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/shared/dist ./shared/dist
# If shared doesn't have a build step (just TS), copy the src or shared files
# COPY --from=builder /app/shared ./shared

# Re-copy shared if it's needed by server at runtime (as peer)
COPY --from=builder /app/shared ./shared

# Create directory for persisted brain data
RUN mkdir -p /app/server/brain

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Start the server
CMD ["npm", "run", "start", "--workspace=server"]
