/**
 * Query Strategy Helper - Permanent solution for manual item visibility
 * 
 * This utility provides consistent query strategy logic across all services.
 * It ensures manually created items are always visible by forcing database queries
 * when manual items exist. All queries now use the database directly
 * (OpenSearch has been removed).
 */

import { IServiceOptions } from '../services/IServiceOptions'

// Use any type for logger to avoid winston dependency issues
type Logger = any

export interface QueryStrategyOptions {
  tableName: string
  tenantId: string
  database: any
  logger: Logger
}

export interface QueryResult {
  count: number
  rows: any[]
}

/**
 * Determines if database query should be used instead of OpenSearch
 * Always returns true since OpenSearch has been removed.
 */
export async function shouldUseDatabaseQuery(
  options: QueryStrategyOptions
): Promise<{ useDatabase: boolean; manualCount: number }> {
  return { useDatabase: true, manualCount: 0 }
}

/**
 * Ensures query result count matches actual rows returned
 * Fixes common count mismatch issues in database queries
 */
export function normalizeQueryResult(
  result: QueryResult,
  logger: Logger,
  context: string = 'query'
): QueryResult {
  if (!result || typeof result !== 'object') {
    logger.warn({ result }, 'Invalid query result structure')
    return { count: 0, rows: [] }
  }
  
  const actualRows = Array.isArray(result.rows) ? result.rows : []
  const reportedCount = parseInt(result.count?.toString() || '0', 10)
  
  if (reportedCount !== actualRows.length) {
    logger.warn(
      { 
        context,
        originalCount: reportedCount, 
        actualRows: actualRows.length 
      }, 
      'Count mismatch detected - correcting to match actual data'
    )
    
    return {
      count: actualRows.length,
      rows: actualRows
    }
  }
  
  return result
}

/**
 * Creates a unified query strategy that always uses the database.
 * OpenSearch has been removed; this class is kept for API compatibility.
 */
export class UnifiedQueryStrategy {
  constructor(
    private options: IServiceOptions,
    private tableName: string,
    private logger: Logger
  ) {}
  
  async executeQuery<T>(
    _opensearchQuery: () => Promise<QueryResult>,
    databaseQuery: () => Promise<QueryResult>,
    context: string = 'query'
  ): Promise<QueryResult> {
    this.logger.info({ context }, 'Using database query')
    const result = await databaseQuery()
    return normalizeQueryResult(result, this.logger, context)
  }
}

export default {
  shouldUseDatabaseQuery,
  normalizeQueryResult,
  UnifiedQueryStrategy
}