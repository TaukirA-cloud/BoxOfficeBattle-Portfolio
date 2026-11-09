FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATABASE_PATH=/app/var/battle.sqlite
WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev && mkdir -p var && chown node:node var
COPY --chown=node:node server ./server
COPY --chown=node:node data ./data
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node index.html app.js styles.css icon.svg manifest.webmanifest sw.js offline.html robots.txt ./
COPY --chown=node:node icon-192.png icon-512.png ./
USER node
EXPOSE 3000
VOLUME ["/app/var"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server/index.js"]
