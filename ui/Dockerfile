# NOTE: build context for this image is the REPO ROOT (see docker-compose.yml),
# because ui/package.json depends on ../api-clients/sixgate-api-client-0.1.0.tgz.

# ---- Build stage ----
FROM node:22-bookworm-slim AS build
WORKDIR /src

# Local tarball dependency must be present before `npm ci`.
COPY api-clients ./api-clients
COPY ui/package*.json ./ui/
WORKDIR /src/ui
RUN npm ci

COPY ui/ ./
RUN npm run build          # next build

# ---- Runtime stage ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /src/ui/node_modules ./node_modules
COPY --from=build /src/ui/.next ./.next
COPY --from=build /src/ui/public ./public
COPY --from=build /src/ui/package.json ./package.json
COPY --from=build /src/ui/next.config.ts ./next.config.ts

EXPOSE 20129
CMD ["npm", "run", "start"]   # next start --port 20129
