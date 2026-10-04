const { supabase } = require('../config/supabase');
const { notFound } = require('../utils/errors');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const { parseSort } = require('../utils/helpers');

const SORTABLE = ['name', 'category', 'status', 'criticality', 'runtime_hours', 'created_at'];

async function getAll(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const { field, direction } = parseSort(req.query.sort, SORTABLE);
    const orgId = req.user.org_id;

    let query = supabase
      .from('assets')
      .select('*, locations(name, building, floor)', { count: 'exact' })
      .eq('org_id', orgId)
      .is('deleted_at', null);

    if (req.query.category) query = query.eq('category', req.query.category);
    if (req.query.status) query = query.eq('status', req.query.status);
    if (req.query.criticality) query = query.eq('criticality', req.query.criticality);
    if (req.query.location_id) query = query.eq('location_id', req.query.location_id);
    if (req.query.search) query = query.ilike('name', `%${req.query.search}%`);

    const { data, error, count } = await query
      .order(field, { ascending: direction === 'asc' })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    let enriched = data;
    const assetIds = data.map((a) => a.id);
    if (assetIds.length > 0) {
      const { data: healthScores } = await supabase
        .from('health_scores')
        .select('asset_id, score, calculated_at')
        .in('asset_id', assetIds)
        .order('calculated_at', { ascending: false });

      const latestScores = {};
      (healthScores || []).forEach((hs) => {
        if (!latestScores[hs.asset_id]) latestScores[hs.asset_id] = hs;
      });

      enriched = data.map((asset) => ({
        ...asset,
        healthScore: latestScores[asset.id]?.score ?? null,
        location: asset.locations || asset.location || null,
      }));
    }

    res.json({ data: enriched, pagination: buildPaginationMeta(count, page, limit) });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('assets')
      .select('*, locations(name, building, floor), warranties(*), meters_sensors(*), asset_components(*)')
      .eq('id', req.params.id)
      .eq('org_id', req.user.org_id)
      .is('deleted_at', null)
      .single();

    if (error || !data) return next(notFound('Asset not found'));

    const { data: healthScore } = await supabase
      .from('health_scores')
      .select('*')
      .eq('asset_id', data.id)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single();

    const { data: openWorkOrders } = await supabase
      .from('work_orders')
      .select('id, title, type, priority, status, assigned_to, opened_at')
      .eq('asset_id', data.id)
      .neq('status', 'closed')
      .order('opened_at', { ascending: false });

    res.json({
      data: {
        ...data,
        health_score: healthScore || null,
        open_work_orders: openWorkOrders || [],
      },
    });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('assets')
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
      .from('assets')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('org_id', req.user.org_id)
      .select()
      .single();

    if (error || !data) return next(notFound('Asset not found'));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('assets')
      .update({ deleted_at: new Date().toISOString(), status: 'decommissioned' })
      .eq('id', req.params.id)
      .eq('org_id', req.user.org_id)
      .select()
      .single();

    if (error || !data) return next(notFound('Asset not found'));
    res.json({ message: 'Asset decommissioned', data });
  } catch (err) {
    next(err);
  }
}

async function getTelemetry(req, res, next) {
  try {
    let query = supabase
      .from('telemetry')
      .select('*, meters_sensors(name, unit)')
      .eq('asset_id', req.params.id)
      .order('timestamp', { ascending: false })
      .limit(100);

    if (req.query.sensor) query = query.eq('sensor_id', req.query.sensor);
    if (req.query.from) query = query.gte('timestamp', req.query.from);
    if (req.query.to) query = query.lte('timestamp', req.query.to);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getHealthScore(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('health_scores')
      .select('*')
      .eq('asset_id', req.params.id)
      .order('calculated_at', { ascending: false })
      .limit(10);

    if (error) throw error;
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getWorkOrders(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('work_orders')
      .select('*')
      .eq('asset_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getInspections(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('inspections')
      .select('*')
      .eq('asset_id', req.params.id)
      .order('performed_at', { ascending: false });

    if (error) throw error;
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, getById, create, update, remove, getTelemetry, getHealthScore, getWorkOrders, getInspections };
