FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install

COPY src ./src
COPY server ./server
COPY lexicons ./lexicons
COPY public ./public
COPY vite.config.ts tsconfig.json eslint.config.js ./

RUN bun run build

FROM oven/bun:1
WORKDIR /app

# Required environment variables:
#   APP_URL       - Public URL of the app (e.g. https://cozy-corner.fly.dev)
#   SERVICE_DID   - AT Protocol service DID for authentication

COPY --from=build /app/.output ./.output

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/api/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

EXPOSE 3000
CMD ["bun", ".output/server/index.mjs"]
