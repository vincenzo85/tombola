# ---- build client (React/Vite) ----
FROM node:20-alpine AS client_build
WORKDIR /app/client
COPY client/package.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# ---- build server (Node/Express/Socket.IO) ----
FROM node:20-alpine AS server_build
WORKDIR /app/server
COPY server/package.json ./
RUN npm install
COPY server/ ./

# ---- runtime ----
FROM node:20-alpine
WORKDIR /app/server
ENV NODE_ENV=production

# server code + prod deps
COPY --from=server_build /app/server ./
RUN npm install --omit=dev

# static client build served by express (public/)
COPY --from=client_build /app/client/dist ./public

EXPOSE 8080
CMD ["node", "index.js"]
