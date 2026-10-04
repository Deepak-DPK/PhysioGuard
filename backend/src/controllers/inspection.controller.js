const { supabase } = require('../config/supabase');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

async function getAll(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query);

    let query = supabase
      .from('inspections')
      .select('*, assets(name, category), users!inspections_performed_by_fkey(full_name)', { count: 'exact' })
      .eq('org_id', req.user.org_id);

    if (req.query.asset_id) query = query.eq('asset_id', req.query.asset_id);
    if (req.query.status) query = query.eq('status', req.query.status);

    const { data, error, count } = await query
      .order('performed_at', { ascending: false })
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
      .from('inspections')
      .insert({
        ...req.body,
        org_id: req.user.org_id,
        performed_by: req.user.id,
        performed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, create };
