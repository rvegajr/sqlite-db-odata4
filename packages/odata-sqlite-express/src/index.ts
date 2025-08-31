import { ExpressODataHandler, ExpressODataConfig } from './express-odata-handler';

export { ExpressODataHandler } from './express-odata-handler';
export type { 
  ExpressODataConfig, 
  ODataQuery,
  ParsedODataQuery,
  ODataFilterExpression,
  ODataResponseOptions,
  ODataResult
} from './express-odata-handler';

// Convenience function for easy setup
export function createODataRouter(config: ExpressODataConfig, resourceName: string, basePath: string) {
  const handler = new ExpressODataHandler(config);
  return handler.createODataRouter(resourceName, basePath);
}

// Convenience function for registering OData endpoints
export function registerOData(
  app: any,
  basePath: string,
  resourceName: string,
  connection: any,
  schema: any,
  options?: {
    relationships?: any[];
    searchConfig?: Array<{
      table: string;
      ftsTable: string;
      columns: string[];
    }>;
  }
) {
  ExpressODataHandler.registerOData(app, basePath, resourceName, connection, schema, options);
}
