FROM node:24 as build

# Chromium systeme + polices : pilote par puppeteer-core pour convertir le
# contrat HTML en PDF (aucun navigateur n'est telecharge par npm)
RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium fonts-liberation \
    && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./

RUN npm i

COPY tsconfig.json ./

COPY src ./src/

# gabarit HTML du contrat, lu a l'execution par le generateur de PDF
COPY templates ./templates/

RUN npm run build

EXPOSE 3000

CMD [ "npm", "start" ]