const TABLE_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

const SUPPORTED_OPERATORS = new Set([
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'like',
  'ilike',
  'in',
  'is',
  'contains',
  'containedBy',
  'overlaps',
  'textSearch',
]);

function assertTableName(tableName) {
  if (typeof tableName !== 'string' || !TABLE_PATTERN.test(tableName.trim())) {
    throw new Error('Invalid table name. Use letters, numbers, and underscores only.');
  }
  return tableName.trim();
}

function assertIdentifier(value, fieldName) {
  if (typeof value !== 'string' || !IDENTIFIER_PATTERN.test(value.trim())) {
    throw new Error(`Invalid ${fieldName}. Use letters, numbers, and underscores only.`);
  }
  return value.trim();
}

function normalizeOrderBy(orderBy) {
  if (!orderBy) return [];
  if (Array.isArray(orderBy)) return orderBy;
  return [orderBy];
}

function applyOrder(query, orderBy) {
  const orderItems = normalizeOrderBy(orderBy);

  for (const item of orderItems) {
    if (!item || typeof item !== 'object') continue;
    const column = assertIdentifier(item.column, 'orderBy.column');
    query = query.order(column, {
      ascending: item.ascending !== false,
      nullsFirst: item.nullsFirst,
      foreignTable: item.foreignTable,
    });
  }

  return query;
}

function applyFilters(query, filters) {
  if (!Array.isArray(filters)) {
    throw new Error('filters must be an array.');
  }

  for (const filter of filters) {
    if (!filter || typeof filter !== 'object') continue;

    const operator = filter.operator || 'eq';
    if (!SUPPORTED_OPERATORS.has(operator)) {
      throw new Error(`Unsupported filter operator: ${operator}`);
    }

    const column = assertIdentifier(filter.column, 'filter.column');
    const value = filter.value;

    switch (operator) {
      case 'eq':
        query = query.eq(column, value);
        break;
      case 'neq':
        query = query.neq(column, value);
        break;
      case 'gt':
        query = query.gt(column, value);
        break;
      case 'gte':
        query = query.gte(column, value);
        break;
      case 'lt':
        query = query.lt(column, value);
        break;
      case 'lte':
        query = query.lte(column, value);
        break;
      case 'like':
        query = query.like(column, value);
        break;
      case 'ilike':
        query = query.ilike(column, value);
        break;
      case 'in':
        if (!Array.isArray(value)) {
          throw new Error('The "in" operator requires value to be an array.');
        }
        query = query.in(column, value);
        break;
      case 'is':
        query = query.is(column, value);
        break;
      case 'contains':
        query = query.contains(column, value);
        break;
      case 'containedBy':
        query = query.containedBy(column, value);
        break;
      case 'overlaps':
        query = query.overlaps(column, value);
        break;
      case 'textSearch':
        if (typeof value !== 'string') {
          throw new Error('The "textSearch" operator requires value to be a string.');
        }
        query = query.textSearch(column, value, {
          type: filter.type || 'plain',
          config: filter.config,
        });
        break;
      default:
        break;
    }
  }

  return query;
}

module.exports = {
  assertTableName,
  applyFilters,
  applyOrder,
};
