const { supabase } = require('../config/supabase');
const { requireAsset, requireChild } = require('../utils/assetScope');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

async function getByAsset(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    await requireAsset(req.params.assetId, req.user.org_id);

    const { data, error, count } = await supabase
      .from('meters_sensors')
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
      .from('meters_sensors')
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
    await requireChild('meters_sensors', req.params.id, req.user.org_id, 'Meter');
    const { data, error } = await supabase
      .from('meters_sensors')
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

// Telemetry ingestion: stores a reading and updates the meter's current value.
async function postReading(req, res, next) {
  try {
    const meter = await requireChild('meters_sensors', req.params.id, req.user.org_id, 'Meter');
    const timestamp = req.body.timestamp || new Date().toISOString();

    const { data, error } = await supabase
      .from('telemetry')
      .insert({
        sensor_id: meter.id,
        asset_id: meter.asset_id,
        value: req.body.value,
        timestamp,
        raw: req.body.raw || null,
      })
      .select()
      .single();

    if (error) throw error;

    const { error: updateError } = await supabase
      .from('meters_sensors')
      .update({ current_value: req.body.value, last_read_at: timestamp })
      .eq('id', meter.id);

    if (updateError) throw updateError;
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

module.exports = { getByAsset, create, update, postReading };
