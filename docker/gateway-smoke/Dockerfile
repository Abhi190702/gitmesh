# GitMesh gateway smoke test container
FROM node:22-alpine

WORKDIR /app
COPY server.mjs /app/server.mjs

EXPOSE 8787

CMD ["node", "/app/server.mjs"]
