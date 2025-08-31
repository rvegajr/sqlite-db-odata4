export type ODataSortDirection = 'asc' | 'desc';

export type ODataFilterOperator = 
  | 'eq' | 'ne' | 'lt' | 'le' | 'gt' | 'ge'  // Comparison operators
  | 'and' | 'or' | 'not'                      // Logical operators
  | 'in' | 'contains' | 'startswith' | 'endswith'; // Collection and string operators

export interface ODataOrderByField {
  field: string;
  direction: ODataSortDirection;
}

export interface ODataExpandField {
  path: string;
  select?: string[];
  filter?: ODataFilterExpression;
  top?: number;
  skip?: number;
  orderBy?: ODataOrderByField[];
  nested?: ODataExpandField[];
}

export interface ODataFilterExpression {
  operator: ODataFilterOperator;
  field?: string;
  value?: any;
  left?: ODataFilterExpression;
  right?: ODataFilterExpression;
}

export interface ODataQuery {
  top?: number;
  skip?: number;
  filter?: ODataFilterExpression;
  orderBy?: ODataOrderByField[];
  select?: string[];
  expand?: ODataExpandField[];
  count?: boolean;
  search?: string;
  apply?: {
    groupByFields?: string[];
    aggregates?: Array<{ 
      source: string; 
      op: 'sum' | 'avg' | 'min' | 'max' | 'count'; 
      as: string 
    }>;
  };
  compute?: Array<{
    expression: string;
    as: string;
  }>;
}

export interface ODataResult<T> {
  value: T[];
  count?: number;
  nextLink?: string;
}

export interface ODataError {
  code: string;
  message: string;
  target?: string;
  details?: ODataError[];
}

export interface ODataResponse<T> {
  '@odata.context'?: string;
  '@odata.count'?: number;
  '@odata.nextLink'?: string;
  value: T[];
  error?: ODataError;
}
