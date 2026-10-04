const { supabase } = require('../config/supabase');
const { notFound } = require('./errors');

// Verifies an asset belongs to the org; returns the asset row or throws notFound.
async function requireAsset(assetId, orgId) {
  const { data, error } = await supabase
    .from('assets')
    .select('id')
    .eq('id', assetId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .single();
  if (error || !data) throw notFound('Asset not found');
  return data;
}

// Verifies a child row (component, warranty, meter) belongs to an asset in the org.
async function requireChild(table, id, orgId, label) {
  const { data, error } = await supabase
    .from(table)
    .select('id, asset_id, assets!inner(org_id)')
    .eq('id', id)
    .eq('assets.org_id', orgId)
    .single();
  if (error || !data) throw notFound(`${label} not found`);
  return data;
}

module.exports = { requireAsset, requireChild };
