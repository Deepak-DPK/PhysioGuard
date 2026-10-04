const { supabase } = require('../config/supabase');
const aiService = require('../services/geminiAI.service');
const { notFound, badRequest } = require('../utils/errors');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

async function predictFailure(req, res, next) {
  try {
    const { asset_id } = req.body;
    const { data: asset } = await supabase.from('assets').select('*').eq('id', asset_id).eq('org_id', req.user.org_id).single();
    if (!asset) return next(notFound('Asset not found'));

    const { data: telemetry } = await supabase.from('telemetry').select('*').eq('asset_id', asset_id).order('timestamp', { ascending: false }).limit(50);
    const { data: history } = await supabase.from('work_orders').select('*').eq('asset_id', asset_id).order('created_at', { ascending: false }).limit(20);

    const result = await aiService.predictFailure(req.user.org_id, asset, telemetry || [], history || []);
    res.json({ data: { ...result, asset_id, timestamp: new Date().toISOString() } });
  } catch (err) {
    next(err);
  }
}

async function estimateRUL(req, res, next) {
  try {
    const { asset_id } = req.body;
    const { data: asset } = await supabase.from('assets').select('*').eq('id', asset_id).eq('org_id', req.user.org_id).single();
    if (!asset) return next(notFound('Asset not found'));

    const { data: meters } = await supabase.from('meters_sensors').select('*').eq('asset_id', asset_id);
    const { data: serviceHistory } = await supabase.from('service_history').select('*').eq('asset_id', asset_id).order('performed_at', { ascending: false }).limit(20);

    const result = await aiService.estimateRUL(req.user.org_id, asset, meters || [], serviceHistory || []);
    res.json({ data: { ...result, asset_id, timestamp: new Date().toISOString() } });
  } catch (err) {
    next(err);
  }
}

async function detectAnomalies(req, res, next) {
  try {
    const { asset_id, window_hours } = req.body;
    const since = new Date(Date.now() - window_hours * 3600000).toISOString();

    const { data: telemetry } = await supabase
      .from('telemetry')
      .select('*, meters_sensors(name, unit)')
      .eq('asset_id', asset_id)
      .gte('timestamp', since)
      .order('timestamp', { ascending: true });

    const result = await aiService.detectAnomalies(req.user.org_id, asset_id, telemetry || []);
    res.json({ data: { ...result, asset_id, window_hours, timestamp: new Date().toISOString() } });
  } catch (err) {
    next(err);
  }
}

async function recogniseDefect(req, res, next) {
  try {
    if (!req.file) return next(badRequest('No image file provided'));
    const assetId = req.body.asset_id;
    const { data: asset } = await supabase.from('assets').select('category').eq('id', assetId).single();

    const imageBase64 = req.file.buffer.toString('base64');
    const result = await aiService.recogniseDefects(req.user.org_id, assetId, imageBase64, asset?.category || 'unknown');
    res.json({ data: { ...result, asset_id: assetId, timestamp: new Date().toISOString() } });
  } catch (err) {
    next(err);
  }
}

async function summariseNotes(req, res, next) {
  try {
    const { asset_id } = req.body;
    const { data: workOrders } = await supabase
      .from('work_orders')
      .select('*')
      .eq('asset_id', asset_id)
      .eq('org_id', req.user.org_id)
      .order('created_at', { ascending: false })
      .limit(30);

    const result = await aiService.summariseRepairNotes(req.user.org_id, asset_id, workOrders || []);
    res.json({ data: { ...result, asset_id, timestamp: new Date().toISOString() } });
  } catch (err) {
    next(err);
  }
}

async function reviewAIRun(req, res, next) {
  try {
    const { decision, reason } = req.body;
    const { data, error } = await supabase
      .from('ai_runs')
      .select('*')
      .eq('id', req.params.runId)
      .eq('org_id', req.user.org_id)
      .single();

    if (error || !data) return next(notFound('AI run not found'));

    await supabase.from('ai_feedback').insert({
      ai_run_id: data.id,
      user_id: req.user.id,
      was_correct: decision === 'approved',
      feedback_text: reason,
    });

    if (data.asset_id) {
      await supabase
        .from('failure_predictions')
        .update({ review_decision: decision, review_reason: reason, reviewed_by: req.user.id, reviewed_at: new Date().toISOString() })
        .eq('asset_id', data.asset_id)
        .eq('review_decision', 'pending');
    }

    await supabase.from('audit_logs').insert({
      org_id: req.user.org_id,
      user_id: req.user.id,
      action: `ai_review_${decision}`,
      entity_type: 'ai_run',
      entity_id: data.id,
      new_value: { decision, reason },
      outcome: 'success',
    });

    res.json({ message: `AI run ${decision}`, data: { decision, reason } });
  } catch (err) {
    next(err);
  }
}

async function getRuns(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query);

    let query = supabase
      .from('ai_runs')
      .select('*, assets(name, category)', { count: 'exact' })
      .eq('org_id', req.user.org_id);

    if (req.query.run_type) query = query.eq('run_type', req.query.run_type);
    if (req.query.asset_id) query = query.eq('asset_id', req.query.asset_id);
    if (req.query.status) query = query.eq('status', req.query.status);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    res.json({ data, pagination: buildPaginationMeta(count, page, limit) });
  } catch (err) {
    next(err);
  }
}

module.exports = { predictFailure, estimateRUL, detectAnomalies, recogniseDefect, summariseNotes, reviewAIRun, getRuns };
