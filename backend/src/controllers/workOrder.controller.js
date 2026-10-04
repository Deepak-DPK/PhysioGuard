const { supabase } = require('../config/supabase');
const { notFound, forbidden } = require('../utils/errors');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const { parseSort } = require('../utils/helpers');

const SORTABLE = ['title', 'priority', 'status', 'type', 'opened_at', 'created_at'];

async function getAll(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const { field, direction } = parseSort(req.query.sort, SORTABLE);

    let query = supabase
      .from('work_orders')
      .select('*, assets(name, category)', { count: 'exact' })
      .eq('org_id', req.user.org_id);

    if (req.query.status) query = query.eq('status', req.query.status);
    if (req.query.priority) query = query.eq('priority', req.query.priority);
    if (req.query.type) query = query.eq('type', req.query.type);
    if (req.query.assigned_to) query = query.eq('assigned_to', req.query.assigned_to);
    if (req.query.asset_id) query = query.eq('asset_id', req.query.asset_id);
    if (req.query.search) query = query.ilike('title', `%${req.query.search}%`);

    const { data, error, count } = await query
      .order(field, { ascending: direction === 'asc' })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    res.json({ data, pagination: buildPaginationMeta(count, page, limit) });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('work_orders')
      .select('*, assets(name, category, location_id)')
      .eq('id', req.params.id)
      .eq('org_id', req.user.org_id)
      .single();

    if (error || !data) return next(notFound('Work order not found'));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('work_orders')
      .insert({ ...req.body, org_id: req.user.org_id, opened_at: new Date().toISOString() })
      .select()
      .single();

    if (error) throw error;

    if (data.assigned_to) {
      await supabase.from('notifications').insert({
        org_id: req.user.org_id,
        user_id: data.assigned_to,
        type: 'assignment',
        title: 'New Work Order Assigned',
        message: `Work order "${data.title}" has been assigned to you.`,
        related_entity_type: 'work_order',
        related_entity_id: data.id,
        severity: data.priority === 'critical' ? 'critical' : 'info',
      });
    }

    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('work_orders')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('org_id', req.user.org_id)
      .select()
      .single();

    if (error || !data) return next(notFound('Work order not found'));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function approve(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('work_orders')
      .update({
        status: 'approved',
        approved_by: req.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .eq('org_id', req.user.org_id)
      .in('status', ['pending_review', 'open'])
      .select()
      .single();

    if (error || !data) return next(notFound('Work order not found or not in reviewable state'));

    await supabase.from('audit_logs').insert({
      org_id: req.user.org_id,
      user_id: req.user.id,
      action: 'approve',
      entity_type: 'work_order',
      entity_id: data.id,
      new_value: { status: 'approved', reason: req.body.reason },
      outcome: 'success',
    });

    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function reject(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('work_orders')
      .update({
        status: 'rejected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .eq('org_id', req.user.org_id)
      .in('status', ['pending_review', 'open'])
      .select()
      .single();

    if (error || !data) return next(notFound('Work order not found or not in reviewable state'));

    await supabase.from('audit_logs').insert({
      org_id: req.user.org_id,
      user_id: req.user.id,
      action: 'reject',
      entity_type: 'work_order',
      entity_id: data.id,
      new_value: { status: 'rejected', reason: req.body.reason },
      outcome: 'success',
    });

    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function close(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('work_orders')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .eq('org_id', req.user.org_id)
      .select()
      .single();

    if (error || !data) return next(notFound('Work order not found'));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function uploadEvidence(req, res, next) {
  try {
    if (!req.file) return next(require('../utils/errors').badRequest('No file provided'));

    const fileName = `evidence/${req.params.id}/${Date.now()}-${req.file.originalname}`;
    const { error: uploadError } = await supabase.storage
      .from('attachments')
      .upload(fileName, req.file.buffer, { contentType: req.file.mimetype });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(fileName);

    const { data: wo } = await supabase
      .from('work_orders')
      .select('evidence_urls')
      .eq('id', req.params.id)
      .single();

    const urls = [...(wo?.evidence_urls || []), urlData.publicUrl];

    const { data, error } = await supabase
      .from('work_orders')
      .update({ evidence_urls: urls, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, getById, create, update, approve, reject, close, uploadEvidence };
