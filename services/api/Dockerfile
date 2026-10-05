# Build context is the repository root:  docker build -f services/api/Dockerfile -t scm-api .
FROM node:22-alpine AS build
WORKDIR /repo
COPY scripts/vendor-domain.mjs scripts/
COPY packages/domain/src packages/domain/src
COPY services/api/package.json services/api/tsconfig.json services/api/tsconfig.build.json services/api/
COPY services/api/src services/api/src
WORKDIR /repo/services/api
RUN npm install --no-audit --no-fund && npm run build

FROM node:22-alpine
ENV NODE_ENV=production PORT=4100
WORKDIR /app
COPY --from=build /repo/services/api/dist ./dist
USER node
EXPOSE 4100
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:4100/api/v1/health || exit 1
CMD ["node", "dist/server.js"]
