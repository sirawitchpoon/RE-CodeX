# Re:CodeX backoffice SPA. Built from repo root with workspaces awareness.
#   docker build -f apps/web/Dockerfile -t recodex-web .

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm install --no-audit --no-fund

FROM deps AS build
COPY apps/web/ apps/web/
WORKDIR /app/apps/web
# VITE_API_BASE / VITE_GUILD_ID can be baked at build time. In Compose
# they are passed via build.args; if not set, the SPA falls back to mock.
ARG VITE_API_BASE=""
ARG VITE_GUILD_ID=""
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_GUILD_ID=$VITE_GUILD_ID
RUN npm run build

FROM nginx:alpine AS runtime
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx","-g","daemon off;"]
