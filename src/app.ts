import express, { Application, Request, Response, NextFunction } from 'express';
import { ApolloServer, ApolloServerExpressConfig } from 'apollo-server-express';
import { ApolloServerPluginLandingPageGraphQLPlayground } from 'apollo-server-core';
import { makeExecutableSchema } from 'graphql-tools';
import pinoHttp from 'pino-http';
import config from './config';
import ApolloLogger from './utils/apolloLogger';
import resolvers from './resolvers';
import typeDefs from './typeDefs';
import health from './health';
import auth from './auth';

type ApplicationOptions = {
  apolloConfigOverrides?: ApolloServerExpressConfig;
};

interface ResponseError extends Error {
  status?: number;
}

async function createApp(opts: ApplicationOptions = {}): Promise<Application> {
  const app = express();

  app.use(
    pinoHttp({
      logger: config.logger,
      customLogLevel(res, err) {
        if (err || res.statusCode === 500) {
          return 'error';
        }
        return 'info';
      },
      autoLogging: {
        ignorePaths: ['/health'],
      },
    })
  );

  app.use(express.json());
  app.use(
    (err: ResponseError, _req: Request, res: Response, next: NextFunction) => {
      if (err instanceof SyntaxError && err.status === 400) {
        res.status(400).send({ error: 'Bad request' });
      } else {
        next();
      }
    }
  );

  app.use(health);

  app.use(auth);

  const apolloConfig: ApolloServerExpressConfig = {
    schema: makeExecutableSchema({
      typeDefs,
      resolvers,
    }),
    introspection: true,
    plugins: [
      ApolloServerPluginLandingPageGraphQLPlayground(),
      () => new ApolloLogger(config.logger),
    ],
    ...opts.apolloConfigOverrides,
  };

  const apollo = new ApolloServer(apolloConfig);
  await apollo.start();

  apollo.applyMiddleware({ app });

  return app;
}

export default createApp;
