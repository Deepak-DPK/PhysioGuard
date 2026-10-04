const { supabase } = require('../config/supabase');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

async function getAll(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query);

    let query = supabase
      .from('downtime_events')
      .select('*, assets(name, category)', { count: 'exact' })
      .eq('assets.org_id', req.user.org_id);

    if (req.query.asset_id) query = query.eq('asset_id', req.query.asset_id);

    const { data, error, count } = await query
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    res.json({ data, pagination: buildPaginationMeta(count, page, limit) });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('downtime_events')
      .insert(req.body)
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, create };
