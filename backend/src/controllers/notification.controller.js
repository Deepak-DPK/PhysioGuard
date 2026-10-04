const { supabase } = require('../config/supabase');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

async function getAll(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query);

    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('org_id', req.user.org_id)
      .eq('user_id', req.user.id);

    if (req.query.unread_only === 'true') query = query.eq('is_read', false);
    if (req.query.severity) query = query.eq('severity', req.query.severity);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', req.user.org_id)
      .eq('user_id', req.user.id)
      .eq('is_read', false);

    res.json({ data, pagination: buildPaginationMeta(count, page, limit), unread_count: unreadCount });
  } catch (err) {
    next(err);
  }
}

async function markRead(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', req.params.id)
      .eq('org_id', req.user.org_id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function markAllRead(req, res, next) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('org_id', req.user.org_id)
      .eq('user_id', req.user.id)
      .eq('is_read', false);

    if (error) throw error;
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, markRead, markAllRead };
