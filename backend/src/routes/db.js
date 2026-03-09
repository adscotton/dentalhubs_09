const express = require('express');
const { createSupabaseClient } = require('../supabase');
const { requireAccessToken } = require('../middleware/auth');
const { sendSupabaseError } = require('../lib/response');
const { assertTableName, applyFilters, applyOrder } = require('../lib/dbQuery');

const router = express.Router();

router.use(requireAccessToken);

function parseLimit(value) {
  if (value === undefined || value === null) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error('limit must be an integer greater than 0.');
  }
  return parsed;
}

function parseOffset(value) {
  if (value === undefined || value === null) return 0;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error('offset must be an integer greater than or equal to 0.');
  }
  return parsed;
}

router.post('/select', async (req, res) => {
  try {
    const table = assertTableName(req.body?.table);
    const columns =
      typeof req.body?.columns === 'string' && req.body.columns.trim()
        ? req.body.columns.trim()
        : '*';
    const filters = Array.isArray(req.body?.filters) ? req.body.filters : [];
    const orderBy = req.body?.orderBy || [];
    const limit = parseLimit(req.body?.limit);
    const offset = parseOffset(req.body?.offset);
    const single = Boolean(req.body?.single);
    const count = req.body?.count;

    const client = createSupabaseClient({ accessToken: req.accessToken });

    let query;
    if (typeof count === 'string' && count.trim()) {
      query = client.from(table).select(columns, { count: count.trim() });
    } else {
      query = client.from(table).select(columns);
    }

    query = applyFilters(query, filters);
    query = applyOrder(query, orderBy);

    if (limit !== null) {
      query = query.range(offset, offset + limit - 1);
    } else if (offset > 0) {
      return res.status(400).json({ error: 'offset requires limit.' });
    }

    if (single) query = query.single();

    const { data, error, count: resultCount } = await query;
    if (error) return sendSupabaseError(res, error);

    return res.json({ data, count: resultCount ?? null });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Invalid request.' });
  }
});

router.post('/insert', async (req, res) => {
  try {
    const table = assertTableName(req.body?.table);
    const values = req.body?.values;
    const returning = req.body?.returning === 'minimal' ? 'minimal' : 'representation';
    const select =
      typeof req.body?.select === 'string' && req.body.select.trim()
        ? req.body.select.trim()
        : '*';

    if (!values || typeof values !== 'object') {
      return res.status(400).json({ error: 'values must be an object or an array of objects.' });
    }

    const client = createSupabaseClient({ accessToken: req.accessToken });
    let query = client.from(table).insert(values);

    if (returning !== 'minimal') {
      query = query.select(select);
    }

    const { data, error } = await query;
    if (error) return sendSupabaseError(res, error);

    return res.json({ data });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Invalid request.' });
  }
});

router.post('/upsert', async (req, res) => {
  try {
    const table = assertTableName(req.body?.table);
    const values = req.body?.values;
    const onConflict =
      typeof req.body?.onConflict === 'string' && req.body.onConflict.trim()
        ? req.body.onConflict.trim()
        : undefined;
    const ignoreDuplicates = Boolean(req.body?.ignoreDuplicates);
    const returning = req.body?.returning === 'minimal' ? 'minimal' : 'representation';
    const select =
      typeof req.body?.select === 'string' && req.body.select.trim()
        ? req.body.select.trim()
        : '*';

    if (!values || typeof values !== 'object') {
      return res.status(400).json({ error: 'values must be an object or an array of objects.' });
    }

    const client = createSupabaseClient({ accessToken: req.accessToken });
    let query = client.from(table).upsert(values, {
      onConflict,
      ignoreDuplicates,
    });

    if (returning !== 'minimal') {
      query = query.select(select);
    }

    const { data, error } = await query;
    if (error) return sendSupabaseError(res, error);

    return res.json({ data });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Invalid request.' });
  }
});

router.post('/update', async (req, res) => {
  try {
    const table = assertTableName(req.body?.table);
    const values = req.body?.values;
    const filters = Array.isArray(req.body?.filters) ? req.body.filters : [];
    const returning = req.body?.returning === 'minimal' ? 'minimal' : 'representation';
    const select =
      typeof req.body?.select === 'string' && req.body.select.trim()
        ? req.body.select.trim()
        : '*';

    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      return res.status(400).json({ error: 'values must be an object.' });
    }
    if (filters.length === 0) {
      return res.status(400).json({ error: 'At least one filter is required for update.' });
    }

    const client = createSupabaseClient({ accessToken: req.accessToken });
    let query = client.from(table).update(values);
    query = applyFilters(query, filters);

    if (returning !== 'minimal') {
      query = query.select(select);
    }

    const { data, error } = await query;
    if (error) return sendSupabaseError(res, error);

    return res.json({ data });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Invalid request.' });
  }
});

router.post('/delete', async (req, res) => {
  try {
    const table = assertTableName(req.body?.table);
    const filters = Array.isArray(req.body?.filters) ? req.body.filters : [];
    const returning = req.body?.returning === 'representation' ? 'representation' : 'minimal';
    const select =
      typeof req.body?.select === 'string' && req.body.select.trim()
        ? req.body.select.trim()
        : '*';

    if (filters.length === 0) {
      return res.status(400).json({ error: 'At least one filter is required for delete.' });
    }

    const client = createSupabaseClient({ accessToken: req.accessToken });
    let query = client.from(table).delete();
    query = applyFilters(query, filters);

    if (returning === 'representation') {
      query = query.select(select);
    }

    const { data, error } = await query;
    if (error) return sendSupabaseError(res, error);

    return res.json({ data });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Invalid request.' });
  }
});

module.exports = router;
