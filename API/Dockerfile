FROM node:24 as build

WORKDIR /app

COPY package*.json ./

RUN npm i

COPY tsconfig.json ./

COPY src ./src/

RUN npm run build

EXPOSE 3000

CMD [ "npm", "start" ]