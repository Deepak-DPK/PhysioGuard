const { supabase } = require('../config/supabase');
const { requireAsset, requireChild } = require('../utils/assetScope');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

async function getByAsset(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    await requireAsset(req.params.assetId, req.user.org_id);

    const { data, error, count } = await supabase
      .from('asset_components')
      .select('*', { count: 'exact' })
      .eq('asset_id', req.params.assetId)
      .order('created_at', { ascending: false })
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
      .from('asset_components')
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
    await requireChild('asset_components', req.params.id, req.user.org_id, 'Component');
    const { data, error } = await supabase
      .from('asset_components')
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

async function remove(req, res, next) {
  try {
    await requireChild('asset_components', req.params.id, req.user.org_id, 'Component');
    const { error } = await supabase
      .from('asset_components')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Component removed' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getByAsset, create, update, remove };
