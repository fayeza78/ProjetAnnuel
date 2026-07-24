# ── Étape 1 : build du front (Node + pnpm) ──────────────────────────
FROM node:24 AS build
WORKDIR /app

# Le front appelle l'API via le préfixe /api (proxifié par nginx ensuite).
ENV VITE_API_URL=/api

RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install
COPY . .
RUN pnpm build          # tsc -b && vite build -> /app/dist

# ── Étape 2 : service statique léger (nginx) ────────────────────────
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
