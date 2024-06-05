FROM node:20-alpine

WORKDIR /ebs

COPY package.json /ebs

RUN npm install

COPY . /ebs

EXPOSE 3000

CMD ["npm", "start"]
