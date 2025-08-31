export { AstroODataHandler } from './astro-odata-handler';
export type { 
  AstroAPIContext, 
  AstroODataConfig, 
  ParsedODataQuery,
  ODataResponseOptions,
  SingleResourceResponseOptions
} from './astro-odata-handler';

// Convenience function for easy setup
export function createODataHandler(config: AstroODataConfig) {
  return new AstroODataHandler(config);
}

// Convenience function for creating universal handler
export function createUniversalODataHandler(config: AstroODataConfig) {
  const handler = new AstroODataHandler(config);
  return handler.createUniversalHandler();
}

// Convenience function for creating individual handlers
export function createODataHandlers(config: AstroODataConfig) {
  const handler = new AstroODataHandler(config);
  return {
    GET: handler.createGetHandler(),
    POST: handler.createPostHandler(),
    PUT: handler.createPutHandler(),
    DELETE: handler.createDeleteHandler()
  };
}
