const { supabase } = require('../config/supabase');
const { notFound } = require('../utils/errors');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

async function getAll(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query);

    let query = supabase
      .from('maintenance_plans')
      .select('*, assets(name, category)', { count: 'exact' })
      .eq('org_id', req.user.org_id);

    if (req.query.status) query = query.eq('status', req.query.status);
    if (req.query.asset_id) query = query.eq('asset_id', req.query.asset_id);

    const { data, error, count } = await query
      .order('next_due', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    res.json({ data, pagination: buildPaginationMeta(count, page, limit) });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + req.body.frequency_days);

    const { data, error } = await supabase
      .from('maintenance_plans')
      .insert({
        ...req.body,
        org_id: req.user.org_id,
        created_by: req.user.id,
        next_due: nextDue.toISOString(),
      })
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
      .from('maintenance_plans')
      .update(req.body)
      .eq('id', req.params.id)
      .eq('org_id', req.user.org_id)
      .select()
      .single();

    if (error || !data) return next(notFound('Maintenance plan not found'));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getCalendar(req, res, next) {
  try {
    const from = req.query.from || new Date().toISOString();
    const to = req.query.to || new Date(Date.now() + 90 * 86400000).toISOString();

    const { data, error } = await supabase
      .from('maintenance_plans')
      .select('*, assets(name, category)')
      .eq('org_id', req.user.org_id)
      .eq('status', 'active')
      .gte('next_due', from)
      .lte('next_due', to)
      .order('next_due', { ascending: true });

    if (error) throw error;
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, create, update, getCalendar };
