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

# Copy startup script (as root)
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start with the initialization script
CMD ["/app/start.sh"]