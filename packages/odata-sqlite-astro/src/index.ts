import { AstroODataHandler } from './astro-odata-handler';
import type { 
  AstroAPIContext, 
  AstroODataConfig, 
  ParsedODataQuery, 
  ODataResponseOptions, 
  SingleResourceResponseOptions 
} from './astro-odata-handler';

export { AstroODataHandler };
export type { 
  AstroAPIContext, 
  AstroODataConfig, 
  ParsedODataQuery, 
  ODataResponseOptions, 
  SingleResourceResponseOptions 
};

// Convenience functions for creating handlers
export function createODataHandler(config: AstroODataConfig) {
  return new AstroODataHandler(config);
}

export function createUniversalODataHandler(config: AstroODataConfig) {
  const handler = new AstroODataHandler(config);
  return handler.handleRequest.bind(handler);
}

export function createODataHandlers(config: AstroODataConfig) {
  const handler = new AstroODataHandler(config);
  return {
    get: handler.createGetHandler(),
    post: handler.createPostHandler(),
    put: handler.createPutHandler(),
    delete: handler.createDeleteHandler(),
    universal: handler.handleRequest.bind(handler)
  };
}
