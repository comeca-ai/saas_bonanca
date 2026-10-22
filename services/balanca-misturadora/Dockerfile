FROM node:24-bookworm-slim

WORKDIR /srv/balanca
ENV NODE_ENV=production \
    PORT=8080 \
    DB_PATH=/data/mixer.sqlite

COPY package.json ./
COPY src ./src
RUN useradd --system --uid 10002 bonanca && mkdir -p /data && chown -R bonanca:bonanca /srv/balanca /data
USER bonanca

EXPOSE 8080
CMD ["node", "src/server.js"]
