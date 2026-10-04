const { supabase } = require('../config/supabase');
const { notFound } = require('../utils/errors');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

async function getAll(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const { data, error, count } = await supabase
      .from('locations')
      .select('*', { count: 'exact' })
      .eq('org_id', req.user.org_id)
      .is('deleted_at', null)
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
      .from('locations')
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
      .from('locations')
      .update(req.body)
      .eq('id', req.params.id)
      .eq('org_id', req.user.org_id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !data) return next(notFound('Location not found'));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('locations')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('org_id', req.user.org_id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !data) return next(notFound('Location not found'));
    res.json({ message: 'Location deleted', data });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, create, update, remove };
