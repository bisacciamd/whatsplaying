# --- build stage: compile the SPA from source ---
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies against the lockfile first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- runtime stage: serve the built static files ---
FROM node:20-alpine

WORKDIR /app

RUN npm install -g serve

# Only the built output is needed at runtime. A mounted /app/config.json overlays
# this directory and is served at /config.json.
COPY --from=build /app/dist ./

ENV PORT=5000

EXPOSE $PORT

# Use the environment variable in the command
CMD serve -s . -l $PORT
