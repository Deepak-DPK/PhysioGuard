const { supabase } = require('../config/supabase');
const { requireAsset, requireChild } = require('../utils/assetScope');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

async function getByAsset(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    await requireAsset(req.params.assetId, req.user.org_id);

    const { data, error, count } = await supabase
      .from('warranties')
      .select('*', { count: 'exact' })
      .eq('asset_id', req.params.assetId)
      .order('end_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    res.json({ data, pagination: buildPaginationMeta(count, page, limit) });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    await requireAsset(req.params.assetId, req.user.org_id);
    const { data, error } = await supabase
      .from('warranties')
      .insert({ ...req.body, asset_id: req.params.assetId })
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
    await requireChild('warranties', req.params.id, req.user.org_id, 'Warranty');
    const { data, error } = await supabase
      .from('warranties')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

module.exports = { getByAsset, create, update };
