FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

COPY Backend/package.json Backend/package-lock.json Backend/
RUN cd Backend && npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force

COPY Backend Backend
COPY Frontend Frontend

USER node
WORKDIR /app/Backend
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://localhost:3000/session').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
