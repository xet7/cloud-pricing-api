/* eslint no-shadow: ["error", { "allow": ["requestContext"] }] */

const prettier = require('prettier');
const config = require('../config.js');

module.exports = {
  requestDidStart(requestContext) {
    if (requestContext.request.query.startsWith('query IntrospectionQuery')) {
      return {};
    }

    config.logger.debug(requestContext.context, `GraphQL request started:\n${prettier.format(requestContext.request.query, { parser: 'graphql' })}\nvariables:\n${JSON.stringify(requestContext.request.variables, null, 2)}`);

    return {
      didEncounterErrors(requestContext) {
        config.logger.error(requestContext.context, `GraphQL encountered errors:\n${JSON.stringify(requestContext.errors)}`);
      },
      willSendResponse(requestContext) {
        config.logger.debug(requestContext.context, `GraphQL request completed:\n${JSON.stringify(requestContext.response.data, null, 2)}`);
      },
    };
  },
};
