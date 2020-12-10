FROM node:14.15.0-alpine3.12

WORKDIR /usr/src/app

COPY . .

RUN npm install
RUN npm run-script build

COPY docker-entrypoint.sh /
ENTRYPOINT ["sh", "/docker-entrypoint.sh"]

EXPOSE 4000

CMD [ "node", "./dist/server.js" ]