FROM node:14.15.0-alpine3.12 as build

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --production \
  && cp -R node_modules prod_node_modules \
  && npm install
COPY . .
RUN npm run build

FROM node:14.15.0-alpine3.12 as release

RUN apk update && apk upgrade && \
  apk add --no-cache bash curl postgresql-client

WORKDIR /usr/src/app
RUN mkdir data
COPY --from=build /usr/src/app/prod_node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY package*.json ./
ENV NODE_ENV=production
EXPOSE 4000
CMD [ "npm", "run", "start" ]
