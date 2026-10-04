const { supabase } = require('../config/supabase');

async function getAll(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('technicians')
      .select('*, users(full_name, email)')
      .eq('org_id', req.user.org_id);

    if (error) throw error;
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function getQueue(req, res, next) {
  try {
    const { data: technicians, error: techError } = await supabase
      .from('technicians')
      .select('*, users(full_name, email)')
      .eq('org_id', req.user.org_id);

    if (techError) throw techError;

    const techUserIds = technicians.map((t) => t.user_id);
    const { data: workOrders, error: woError } = await supabase
      .from('work_orders')
      .select('*')
      .eq('org_id', req.user.org_id)
      .in('assigned_to', techUserIds)
      .in('status', ['assigned', 'in_progress'])
      .order('priority', { ascending: true });

    if (woError) throw woError;

    const queue = technicians.map((tech) => ({
      ...tech,
      assigned_work_orders: workOrders.filter((wo) => wo.assigned_to === tech.user_id),
    }));

    res.json({ data: queue });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, getQueue };
