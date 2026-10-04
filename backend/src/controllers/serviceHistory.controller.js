const { supabase } = require('../config/supabase');
const { requireAsset } = require('../utils/assetScope');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

async function getByAsset(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    await requireAsset(req.params.assetId, req.user.org_id);

    const { data, error, count } = await supabase
      .from('service_history')
      .select('*', { count: 'exact' })
      .eq('asset_id', req.params.assetId)
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
    await requireAsset(req.params.assetId, req.user.org_id);
    const { data, error } = await supabase
      .from('service_history')
      .insert({
        ...req.body,
        asset_id: req.params.assetId,
        performed_by: req.body.performed_by || req.user.id,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

module.exports = { getByAsset, create };
