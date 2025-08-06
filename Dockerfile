# Simple Dockerfile for Next.js + Socket.IO app
FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (dev dependencies needed for build)
RUN npm ci

# Copy only necessary files first for better layer caching
COPY prisma ./prisma
COPY src ./src
COPY public ./public
COPY next.config.ts tsconfig.json tailwind.config.ts postcss.config.mjs ./
COPY server.ts ./

# Generate Prisma client
RUN npx prisma generate

# Build the application
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Install Prisma CLI globally (needed for database operations)
RUN npm install -g prisma

# Remove dev dependencies after build (but keep Prisma)
RUN npm prune --omit=dev

# Create app user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Create necessary directories
RUN mkdir -p db logs
RUN chown -R nextjs:nodejs /app

# Install tsx globally
RUN npm install -g tsx

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create startup script that handles database initialization
RUN echo '#!/bin/sh\n\
echo "🚀 Starting Poker Score App..."\n\
echo "📂 Current directory: $(pwd)"\n\
echo "📁 Contents: $(ls -la)"\n\
\n\
# Ensure database directory exists\n\
mkdir -p /app/db\n\
\n\
# Run database migrations\n\
echo "🔧 Running database migrations..."\n\
npx prisma db push --accept-data-loss || {\n\
  echo "❌ Database migration failed, trying to create database..."\n\
  npx prisma migrate deploy || echo "⚠️ Migration failed, will try to continue..."\n\
}\n\
\n\
# Start the application\n\
echo "🎯 Starting application..."\n\
exec tsx server.ts' > /app/start.sh && chmod +x /app/start.sh

# Start with the initialization script
CMD ["/app/start.sh"]