# syntax=docker/dockerfile:1

# Build the static site once on the build machine's own platform; the output
# is plain HTML/JS/CSS, so it works for every target architecture.
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.js ./
COPY src ./src
RUN npm run build

# Serve it with nginx as a non-root user (uid 101) on port 8080.
FROM nginxinc/nginx-unprivileged:1.29-alpine
# The base image can lag behind Alpine security fixes, so pull them in and
# drop curl, which nothing here needs.
USER root
RUN apk upgrade --no-cache && apk del --no-cache curl
USER 101
ENV BACKEND_URL=http://backend:8000 \
    NGINX_ENVSUBST_FILTER=BACKEND_
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
