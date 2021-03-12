FROM node:14.15.0-alpine3.12 as build

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --production \
  && cp -R node_modules prod_node_modules \
  && npm install
COPY . .
RUN npm run build

FROM node:14.15.0-alpine3.12 as release

WORKDIR /usr/src/app
RUN mkdir data
COPY --from=build /usr/src/app/prod_node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/docker-entrypoint.sh ./docker-entrypoint.sh
COPY package*.json ./
ENTRYPOINT ["sh", "/usr/src/app/docker-entrypoint.sh"]
EXPOSE 4000
CMD [ "npm", "run", "start" ]