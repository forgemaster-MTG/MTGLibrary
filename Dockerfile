# Build Stage
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies (cache mount for speed if using BuildKit, otherwise standard)
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build React Frontend
# This creates the /dist folder

# Pass build args for Vite
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_MEASUREMENT_ID
# Optional: Frontend API URL (if needed during build, usually not for relative)
ARG VITE_API_URL

ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID
ENV VITE_FIREBASE_MEASUREMENT_ID=$VITE_FIREBASE_MEASUREMENT_ID
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Production Stage
FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built artifacts and necessary server files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
# Copy migrations/seeds if needed for auto-migration
COPY --from=builder /app/migrations ./migrations
# COPY KNEXFILE (Crucial Fix)
COPY --from=builder /app/knexfile.cjs ./knexfile.cjs

EXPOSE 3000

# Start Monolithic Server
CMD ["npm", "run", "start:server"]
