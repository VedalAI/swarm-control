FROM node:20-alpine

WORKDIR /frontend

COPY package.json /frontend

RUN npm install

COPY . /frontend

EXPOSE 8080

CMD ["npm", "start"]
