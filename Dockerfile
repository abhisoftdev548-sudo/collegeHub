# ---------------------------------------------------------------------------
# CollegeHub — single-image deployment
#
#   Stage 1 (build)   compiles the Express/TypeScript API and statically
#                     exports the Next.js frontend, then copies the export
#                     into backend/public so one process serves everything.
#   Stage 2 (runtime) ships only production dependencies + compiled output.
#
#   docker build -t collegehub .
#   docker run -p 5000:5000 --env-file backend/.env collegehub
#
# The image listens on 0.0.0.0:5000 (override with PORT) and expects
# MONGODB_URI to point at a reachable MongoDB instance.
# ---------------------------------------------------------------------------

ARG NODE_VERSION=20

# ------------------------------- build stage -------------------------------
FROM node:${NODE_VERSION}-alpine AS build

WORKDIR /app

# Install dependencies first so Docker can cache this layer across source edits.
COPY package.json ./
COPY backend/package.json backend/
COPY backend/package-lock.json backend/
COPY frontend/package.json frontend/
COPY frontend/package-lock.json frontend/

RUN npm --prefix backend ci --no-audit --no-fund \
 && npm --prefix frontend ci --no-audit --no-fund

# Source
COPY backend backend
COPY frontend frontend
COPY scripts scripts

# Compile the API, export the frontend, and merge the export into backend/public.
RUN npm run build

# Prune dev dependencies from the backend before copying to the runtime stage.
RUN npm --prefix backend prune --omit=dev --no-audit --no-fund

# ------------------------------ runtime stage ------------------------------
FROM node:${NODE_VERSION}-alpine AS runtime

ENV NODE_ENV=production \
    PORT=5000

WORKDIR /app

# Only what the API needs to run: compiled output, prod node_modules, uploads.
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/public ./public
COPY --from=build /app/backend/package.json ./package.json
COPY --from=build /app/backend/.env.example ./.env.example

RUN mkdir -p /app/uploads && chown -R node:node /app

USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# `npm start` → node dist/server.js
CMD ["node", "dist/server.js"]
