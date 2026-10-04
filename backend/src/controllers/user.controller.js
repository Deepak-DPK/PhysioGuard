const bcrypt = require('bcryptjs');
const { supabase } = require('../config/supabase');
const { notFound, conflict } = require('../utils/errors');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

async function getAll(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query);

    let query = supabase
      .from('users')
      .select('id, email, full_name, role, is_active, last_login, created_at', { count: 'exact' })
      .eq('org_id', req.user.org_id)
      .is('deleted_at', null);

    if (req.query.role) query = query.eq('role', req.query.role);
    if (req.query.search) query = query.or(`full_name.ilike.%${req.query.search}%,email.ilike.%${req.query.search}%`);

    const { data, error, count } = await query
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
    const { email, password, full_name, role } = req.body;

    const { data: existing } = await supabase.from('users').select('id').eq('email', email).single();
    if (existing) return next(conflict('Email already in use'));

    const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const password_hash = await bcrypt.hash(password, rounds);

    const { data, error } = await supabase
      .from('users')
      .insert({ email, password_hash, full_name, role, org_id: req.user.org_id })
      .select('id, email, full_name, role, is_active, created_at')
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
      .from('users')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('org_id', req.user.org_id)
      .is('deleted_at', null)
      .select('id, email, full_name, role, is_active, updated_at')
      .single();

    if (error || !data) return next(notFound('User not found'));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', req.params.id)
      .eq('org_id', req.user.org_id)
      .select()
      .single();

    if (error || !data) return next(notFound('User not found'));
    res.json({ message: 'User deactivated' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, create, update, remove };
