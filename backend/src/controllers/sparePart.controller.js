const { supabase } = require('../config/supabase');
const { notFound } = require('../utils/errors');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

async function getAll(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query);

    let query = supabase
      .from('spare_parts')
      .select('*', { count: 'exact' })
      .eq('org_id', req.user.org_id);

    if (req.query.search) query = query.ilike('name', `%${req.query.search}%`);
    if (req.query.low_stock) query = query.lte('quantity_on_hand', supabase.rpc ? 0 : 5);

    const { data, error, count } = await query
      .order('name', { ascending: true })
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
      .from('spare_parts')
      .insert({ ...req.body, org_id: req.user.org_id })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('spare_parts')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('org_id', req.user.org_id)
      .select()
      .single();

    if (error || !data) return next(notFound('Spare part not found'));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, create, update };
