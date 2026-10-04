const { supabase } = require('../config/supabase');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

async function getAll(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query);

    let query = supabase
      .from('audit_logs')
      .select('*, users(full_name, email)', { count: 'exact' })
      .eq('org_id', req.user.org_id);

    if (req.query.user_id) query = query.eq('user_id', req.query.user_id);
    if (req.query.action) query = query.eq('action', req.query.action);
    if (req.query.entity_type) query = query.eq('entity_type', req.query.entity_type);
    if (req.query.from) query = query.gte('created_at', req.query.from);
    if (req.query.to) query = query.lte('created_at', req.query.to);
    if (req.query.outcome) query = query.eq('outcome', req.query.outcome);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    res.json({ data, pagination: buildPaginationMeta(count, page, limit) });
  } catch (err) {
    next(err);
  }
}

async function getSystemConfig(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('system_config')
      .select('*')
      .eq('org_id', req.user.org_id);

    if (error) throw error;
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function updateSystemConfig(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('system_config')
      .upsert({
        org_id: req.user.org_id,
        key: req.params.key,
        value: req.body.value,
        updated_by: req.user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'org_id,key' })
      .select()
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, getSystemConfig, updateSystemConfig };
