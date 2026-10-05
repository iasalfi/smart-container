# Build context is the repository root:  docker build -f web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=http://localhost:4100 -t scm-web .
FROM node:22-alpine AS build
ARG NEXT_PUBLIC_API_URL=http://localhost:4100
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
WORKDIR /repo
COPY scripts/vendor-domain.mjs scripts/
COPY packages/domain/src packages/domain/src
COPY web web
WORKDIR /repo/web
RUN npm install --no-audit --no-fund && npm run build

FROM nginx:1.27-alpine
COPY --from=build /repo/web/out /usr/share/nginx/html
EXPOSE 80
