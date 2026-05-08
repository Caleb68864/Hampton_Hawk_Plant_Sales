# Stage 1: Build
FROM node:22-alpine AS build
WORKDIR /app

# Copy package manifests + lockfile + scripts referenced by lifecycle hooks.
# The package.json `postinstall` script runs scripts/generate-pwa-icons.mjs,
# so scripts/ must be present before `npm install` (or install must skip
# lifecycle scripts).
COPY package.json package-lock.json* ./
COPY scripts ./scripts
RUN npm install
COPY . .
RUN rm -rf node_modules/.cache
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
