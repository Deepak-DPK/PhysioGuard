const { supabase } = require('../config/supabase');
const { getModel } = require('../config/gemini');
const { logger } = require('../utils/logger');
const { badRequest } = require('../utils/errors');

const MODEL_VERSION = 'gemini-2.5-flash';
const MAX_HISTORY = 20;

function countBy(rows, key) {
  return rows.reduce((acc, r) => {
    const k = r[key] || 'unknown';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
}

function formatBreakdown(obj) {
  const entries = Object.entries(obj);
  return entries.length ? entries.map(([k, v]) => `${k}: ${v}`).join(', ') : 'none';
}

// Latest health score per asset (rows must be ordered by calculated_at desc)
function latestScoreMap(scoreRows) {
  const map = new Map();
  for (const s of scoreRows || []) {
    if (!map.has(s.asset_id)) map.set(s.asset_id, s);
  }
  return map;
}

async function gatherContext(orgId, userId) {
  const { data: assets } = await supabase
    .from('assets')
    .select('id, name, category, status, criticality, runtime_hours')
    .eq('org_id', orgId)
    .is('deleted_at', null);

  const assetList = assets || [];
  const assetIds = assetList.map((a) => a.id);
  const assetById = new Map(assetList.map((a) => [a.id, a]));

  const [scoresRes, woRes, predRes, runsRes, notifRes] = await Promise.all([
    assetIds.length
      ? supabase.from('health_scores').select('asset_id, score, calculated_at').in('asset_id', assetIds).order('calculated_at', { ascending: false }).limit(1000)
      : Promise.resolve({ data: [] }),
    supabase
      .from('work_orders')
      .select('id, asset_id, title, type, priority, status, opened_at')
      .eq('org_id', orgId)
      .not('status', 'in', '(closed,rejected)')
      .order('opened_at', { ascending: false })
      .limit(50),
    assetIds.length
      ? supabase
          .from('failure_predictions')
          .select('asset_id, risk_score, rul_days, confidence, explanation, predicted_at, review_decision')
          .in('asset_id', assetIds)
          .order('predicted_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
    supabase
      .from('ai_runs')
      .select('run_type, asset_id, output, confidence, created_at')
      .eq('org_id', orgId)
      .neq('run_type', 'chat')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('notifications')
      .select('type, title, severity, created_at')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const scoreMap = latestScoreMap(scoresRes.data);
  const workOrders = woRes.data || [];
  const predictions = predRes.data || [];
  const runs = runsRes.data || [];
  const notifications = notifRes.data || [];

  const criticalAssets = assetList
    .filter((a) => scoreMap.has(a.id) && Number(scoreMap.get(a.id).score) < 30)
    .map((a) => ({ name: a.name, category: a.category, criticality: a.criticality, health_score: Number(scoreMap.get(a.id).score) }))
    .sort((a, b) => a.health_score - b.health_score);

  return {
    assets: assetList,
    assetById,
    scoreMap,
    summary: {
      total: assetList.length,
      byStatus: countBy(assetList, 'status'),
      byCategory: countBy(assetList, 'category'),
      byCriticality: countBy(assetList, 'criticality'),
    },
    criticalAssets,
    workOrders,
    highPriorityWO: workOrders.filter((w) => ['high', 'critical'].includes(w.priority)),
    predictions,
    runs,
    notifications,
  };
}

async function gatherAssetDetail(asset, orgId) {
  const [scoresRes, woRes, predRes, telRes] = await Promise.all([
    supabase.from('health_scores').select('score, factors, calculated_at').eq('asset_id', asset.id).order('calculated_at', { ascending: false }).limit(5),
    supabase
      .from('work_orders')
      .select('title, type, priority, status, opened_at, closed_at, notes')
      .eq('asset_id', asset.id)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('failure_predictions')
      .select('risk_score, rul_days, confidence, explanation, predicted_at')
      .eq('asset_id', asset.id)
      .order('predicted_at', { ascending: false })
      .limit(3),
    supabase
      .from('telemetry')
      .select('value, timestamp, meters_sensors(name, unit)')
      .eq('asset_id', asset.id)
      .order('timestamp', { ascending: false })
      .limit(20),
  ]);

  const { data: full } = await supabase
    .from('assets')
    .select('name, category, model, manufacturer, install_date, warranty_expiry, criticality, status, runtime_hours, notes')
    .eq('id', asset.id)
    .single();

  return {
    asset: full || asset,
    health_scores: scoresRes.data || [],
    work_orders: woRes.data || [],
    predictions: predRes.data || [],
    recent_telemetry: (telRes.data || []).map((t) => ({
      sensor: t.meters_sensors?.name,
      unit: t.meters_sensors?.unit,
      value: t.value,
      timestamp: t.timestamp,
    })),
  };
}

function buildSystemPrompt(ctx, assetDetails) {
  const { summary, criticalAssets, workOrders, highPriorityWO, predictions, runs, notifications, assetById } = ctx;

  const critList = criticalAssets.length
    ? criticalAssets.slice(0, 10).map((a) => `${a.name} (${a.category}, score ${a.health_score})`).join('; ')
    : 'none';

  const predSummary = predictions.length
    ? predictions
        .slice(0, 8)
        .map((p) => `${assetById.get(p.asset_id)?.name || 'Unknown'}: risk ${p.risk_score}, RUL ${p.rul_days ?? 'n/a'} days (${new Date(p.predicted_at).toISOString().slice(0, 10)})`)
        .join('; ')
    : 'none';

  const woSummary = workOrders.length
    ? workOrders
        .slice(0, 10)
        .map((w) => `${w.title} [${assetById.get(w.asset_id)?.name || 'Unknown'}, ${w.priority}, ${w.status}, opened ${w.opened_at ? new Date(w.opened_at).toISOString().slice(0, 10) : 'n/a'}]`)
        .join('; ')
    : 'none';

  const runSummary = runs.length
    ? runs
        .slice(0, 5)
        .map((r) => {
          const text = r.output?.explanation || r.output?.summary || r.output?.overall_status || '';
          return `${r.run_type} on ${assetById.get(r.asset_id)?.name || 'n/a'} (${new Date(r.created_at).toISOString().slice(0, 10)}): ${String(text).slice(0, 150)}`;
        })
        .join('; ')
    : 'none';

  const alertSummary = notifications.length
    ? notifications.slice(0, 5).map((n) => `${n.title} [${n.severity}]`).join('; ')
    : 'none';

  let prompt = `You are PhysioGuard AI, an intelligent maintenance assistant for a physiotherapy equipment management system. You help maintenance teams manage their equipment proactively.

You have access to the following LIVE system data (as of ${new Date().toISOString()}):
- Total Assets: ${summary.total} (${summary.byStatus.active || 0} active, ${summary.byStatus.under_maintenance || 0} under maintenance, ${summary.byStatus.inactive || 0} inactive, ${summary.byStatus.decommissioned || 0} decommissioned)
- Asset Categories: ${formatBreakdown(summary.byCategory)}
- Asset Criticality: ${formatBreakdown(summary.byCriticality)}
- Critical Risk Assets (health score < 30): ${critList}
- Open Work Orders: ${workOrders.length} (${highPriorityWO.length} high priority). Recent: ${woSummary}
- Recent AI Predictions: ${predSummary}
- Recent AI Analyses: ${runSummary}
- Unread Alerts: ${notifications.length}${notifications.length ? ` (${alertSummary})` : ''}`;

  if (assetDetails.length) {
    prompt += `\n\nThe user is asking about specific asset(s). Detailed data:\n${JSON.stringify(assetDetails, null, 2)}`;
  }

  prompt += `

Based on this data, help the user with:
1. Asset health inquiries ("How is [asset name] doing?")
2. Maintenance prioritization ("What should I fix first?")
3. Risk assessment ("Which assets are at risk?")
4. Work order guidance ("Should I create a work order for...?")
5. Trend analysis ("Are therapy beds degrading faster than normal?")
6. General maintenance advice for physiotherapy equipment

Always be specific with data. Reference actual asset names, scores, and dates. If you don't have enough data, say so honestly.
Respond concisely. Use bullet points for lists. Be actionable.`;

  return prompt;
}

function sanitizeHistory(conversationHistory) {
  if (!Array.isArray(conversationHistory)) return [];
  const mapped = conversationHistory
    .filter((m) => m && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_HISTORY)
    .map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

  // Gemini requires history to start with a user turn and alternate roles
  const cleaned = [];
  for (const m of mapped) {
    if (!cleaned.length && m.role !== 'user') continue;
    if (cleaned.length && cleaned[cleaned.length - 1].role === m.role) {
      cleaned[cleaned.length - 1] = m;
      continue;
    }
    cleaned.push(m);
  }
  if (cleaned.length && cleaned[cleaned.length - 1].role === 'user') cleaned.pop();
  return cleaned;
}

async function chat(req, res, next) {
  const startTime = Date.now();
  const orgId = req.user.org_id;
  let matchedAssetId = null;

  try {
    const { message, conversationHistory } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return next(badRequest('message is required'));
    }

    const ctx = await gatherContext(orgId, req.user.id);

    // Detect asset-specific queries by asset name
    const lowerMsg = message.toLowerCase();
    const mentioned = ctx.assets
      .filter((a) => a.name && lowerMsg.includes(a.name.toLowerCase()))
      .slice(0, 3);
    const assetDetails = await Promise.all(mentioned.map((a) => gatherAssetDetail(a, orgId)));
    if (mentioned.length) matchedAssetId = mentioned[0].id;

    const systemPrompt = buildSystemPrompt(ctx, assetDetails);

    const model = getModel();
    const chatSession = model.startChat({ history: sanitizeHistory(conversationHistory) });
    const result = await chatSession.sendMessage(`${systemPrompt}\n\nUser question: ${message}`);
    const reply = result.response.text();

    const latencyMs = Date.now() - startTime;

    await supabase.from('ai_runs').insert({
      org_id: orgId,
      run_type: 'chat',
      asset_id: matchedAssetId,
      input_snapshot: { message, user_id: req.user.id, matched_assets: mentioned.map((a) => a.name), total_assets: ctx.summary.total },
      output: { response: reply },
      model_version: MODEL_VERSION,
      latency_ms: latencyMs,
      status: 'completed',
    });

    res.json({
      data: {
        response: reply,
        referenced_assets: mentioned.map((a) => ({ id: a.id, name: a.name })),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error({ err }, 'AI chat failed');
    try {
      await supabase.from('ai_runs').insert({
        org_id: orgId,
        run_type: 'chat',
        asset_id: matchedAssetId,
        input_snapshot: { message: req.body?.message, user_id: req.user?.id },
        model_version: MODEL_VERSION,
        latency_ms: Date.now() - startTime,
        status: 'failed',
        error_message: err.message,
      });
    } catch (logErr) {
      logger.error({ err: logErr }, 'Failed to log chat failure');
    }
    const status = err.status || err.statusCode || 500;
    const msg =
      err.message?.includes('API_KEY') || err.message?.includes('not configured')
        ? 'Gemini AI is not configured. Please check the GEMINI_API_KEY in backend/.env'
        : err.message?.includes('quota') || err.message?.includes('429')
          ? 'AI rate limit reached. Please wait a moment and try again.'
          : err.message?.includes('model') || err.message?.includes('not found')
            ? 'AI model unavailable. Please check Gemini API configuration.'
            : `AI chat error: ${err.message}`;
    res.status(status >= 400 && status < 600 ? status : 500).json({ error: msg, details: err.message });
  }
}

async function getSuggestions(req, res, next) {
  try {
    const orgId = req.user.org_id;
    const now = new Date().toISOString();
    const since = new Date(Date.now() - 7 * 24 * 3600000).toISOString();

    const { data: assets } = await supabase.from('assets').select('id').eq('org_id', orgId).is('deleted_at', null);
    const assetIds = (assets || []).map((a) => a.id);

    const [scoresRes, overdueRes, anomalyRes, woRes] = await Promise.all([
      assetIds.length
        ? supabase.from('health_scores').select('asset_id, score, calculated_at').in('asset_id', assetIds).order('calculated_at', { ascending: false }).limit(1000)
        : Promise.resolve({ data: [] }),
      supabase.from('maintenance_plans').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'active').lt('next_due', now),
      supabase.from('ai_runs').select('output').eq('org_id', orgId).eq('run_type', 'anomaly_detection').eq('status', 'completed').gte('created_at', since).limit(50),
      supabase.from('work_orders').select('id', { count: 'exact', head: true }).eq('org_id', orgId).in('priority', ['high', 'critical']).not('status', 'in', '(closed,rejected,approved)'),
    ]);

    const hasCritical = [...latestScoreMap(scoresRes.data).values()].some((s) => Number(s.score) < 30);
    const hasOverdue = (overdueRes.count || 0) > 0;
    const hasAnomalies = (anomalyRes.data || []).some((r) => r.output?.overall_status && r.output.overall_status !== 'normal');
    const hasHighPriorityWO = (woRes.count || 0) > 0;

    const suggestions = [];
    if (hasCritical) suggestions.push('Which assets need urgent attention?');
    if (hasOverdue) suggestions.push('Show me overdue maintenance');
    if (hasAnomalies) suggestions.push('What anomalies were detected recently?');
    if (hasHighPriorityWO) suggestions.push('Which high priority work orders should I handle first?');
    suggestions.push('Give me a system health summary', 'What should I prioritize today?');

    res.json({ data: { suggestions } });
  } catch (err) {
    next(err);
  }
}

module.exports = { chat, getSuggestions };
