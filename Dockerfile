FROM node:22-slim

WORKDIR /app

COPY app ./app
COPY transcripts ./transcripts

ENV PORT=8080
ENV DATA_DIR=/data
EXPOSE 8080

CMD ["node", "app/server.js"]
