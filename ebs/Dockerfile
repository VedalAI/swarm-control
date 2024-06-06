FROM node:20-alpine

WORKDIR /app

COPY dist/index.js .

EXPOSE 3000

CMD ["node", "--enable-source-maps", "index.js"]
