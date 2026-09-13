# Use a stable Ubuntu release
FROM ubuntu:22.04

# Avoid prompts from apt
ENV DEBIAN_FRONTEND=noninteractive

# Update and install system dependencies and all compilers
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    default-jdk \
    python3 \
    golang-go \
    rustc \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js (v20)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install npm dependencies
RUN npm install

# Copy Prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy server code
COPY server ./server/

# Set environment variables
ENV PORT=8080
ENV DATABASE_URL="file:./dev.db"

# Expose the port Cloud Run expects
EXPOSE 8080

# Sync the database schema and start the server
# Note: In a real production deployment, you'd use a managed DB (like Cloud SQL)
# and run migrations separately. Here we push the schema to local sqlite on startup.
CMD ["sh", "-c", "npx prisma db push && npx tsx server/server.ts"]
