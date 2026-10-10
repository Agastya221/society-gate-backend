FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma/generated ./prisma/generated

# Run as the unprivileged 'node' user (built into node images). Files stay
# root-owned and read-only to the process; the app writes nothing to disk
# (uploads go to S3, logs to stdout).
USER node

EXPOSE 4000

CMD ["node", "dist/src/server.js"]
