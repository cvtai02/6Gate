# ---- Build stage ----
# Debian-slim (NOT alpine) so better-sqlite3's native build/prebuild works against glibc.
FROM node:22-bookworm-slim AS build
WORKDIR /src

# Toolchain for compiling better-sqlite3 if no prebuilt binary is available.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build          # nest build -> dist/app/src/main.js
RUN npm prune --omit=dev   # drop devDeps, keep compiled better-sqlite3

# ---- Runtime stage ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /src/node_modules ./node_modules
COPY --from=build /src/dist ./dist
COPY --from=build /src/package.json ./package.json
# .env is provided at runtime via a bind mount / volume (see docker-compose.yml)

# The app hardcodes its data dir to <homedir>/AppData/Local/6Gate.
# In this image homedir is /root, so we persist that path as a volume.
VOLUME ["/root/AppData/Local/6Gate"]

EXPOSE 20130
CMD ["node", "dist/main.js"]
