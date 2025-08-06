#!/bin/sh
echo "🚀 Starting Poker Score App..."
echo "📂 Current directory: $(pwd)"
echo "📁 Contents: $(ls -la)"

# Ensure database directory exists
mkdir -p /app/db

# Run database migrations
echo "🔧 Running database migrations..."
npx prisma db push --accept-data-loss || {
  echo "❌ Database migration failed, trying to create database..."
  npx prisma migrate deploy || echo "⚠️ Migration failed, will try to continue..."
}

# Start the application
echo "🎯 Starting application..."
exec tsx server.ts