const { supabase } = require('../config/supabase');

async function assetHealth(req, res, next) {
  try {
    const { data: assets } = await supabase
      .from('assets')
      .select('id, name, category, status, criticality, runtime_hours')
      .eq('org_id', req.user.org_id)
      .is('deleted_at', null);

    const assetIds = (assets || []).map((a) => a.id);
    const { data: scores } = await supabase
      .from('health_scores')
      .select('asset_id, score, calculated_at')
      .in('asset_id', assetIds)
      .order('calculated_at', { ascending: false });

    const latestScores = {};
    (scores || []).forEach((s) => {
      if (!latestScores[s.asset_id]) latestScores[s.asset_id] = s;
    });

    const summary = {
      total_assets: assets.length,
      by_status: {},
      by_category: {},
      by_criticality: {},
      health_distribution: { good: 0, fair: 0, poor: 0, critical: 0 },
      assets: assets.map((a) => ({ ...a, health_score: latestScores[a.id]?.score ?? null })),
    };

    assets.forEach((a) => {
      summary.by_status[a.status] = (summary.by_status[a.status] || 0) + 1;
      summary.by_category[a.category] = (summary.by_category[a.category] || 0) + 1;
      summary.by_criticality[a.criticality] = (summary.by_criticality[a.criticality] || 0) + 1;
      const score = latestScores[a.id]?.score;
      if (score >= 80) summary.health_distribution.good++;
      else if (score >= 60) summary.health_distribution.fair++;
      else if (score >= 40) summary.health_distribution.poor++;
      else if (score != null) summary.health_distribution.critical++;
    });

    res.json({ data: summary });
  } catch (err) {
    next(err);
  }
}

async function downtime(req, res, next) {
  try {
    let query = supabase
      .from('downtime_events')
      .select('*, assets(name, category)')
      .order('started_at', { ascending: false });

    if (req.query.from) query = query.gte('started_at', req.query.from);
    if (req.query.to) query = query.lte('started_at', req.query.to);

    const { data, error } = await query;
    if (error) throw error;

    const totalHours = (data || []).reduce((sum, d) => {
      if (d.started_at && d.ended_at) {
        return sum + (new Date(d.ended_at) - new Date(d.started_at)) / 3600000;
      }
      return sum;
    }, 0);

    const totalCost = (data || []).reduce((sum, d) => sum + (d.cost_impact || 0), 0);

    res.json({ data: { events: data, total_downtime_hours: parseFloat(totalHours.toFixed(2)), total_cost_impact: totalCost } });
  } catch (err) {
    next(err);
  }
}

async function maintenanceEffectiveness(req, res, next) {
  try {
    const { data: workOrders } = await supabase
      .from('work_orders')
      .select('*')
      .eq('org_id', req.user.org_id)
      .order('created_at', { ascending: false })
      .limit(200);

    const total = workOrders?.length || 0;
    const byType = {};
    const byStatus = {};
    const byPriority = {};

    (workOrders || []).forEach((wo) => {
      byType[wo.type] = (byType[wo.type] || 0) + 1;
      byStatus[wo.status] = (byStatus[wo.status] || 0) + 1;
      byPriority[wo.priority] = (byPriority[wo.priority] || 0) + 1;
    });

    const preventive = byType.preventive || 0;
    const corrective = byType.corrective || 0;
    const preventiveRatio = total > 0 ? parseFloat((preventive / total * 100).toFixed(1)) : 0;

    res.json({
      data: {
        total_work_orders: total,
        by_type: byType,
        by_status: byStatus,
        by_priority: byPriority,
        preventive_ratio_pct: preventiveRatio,
        corrective_count: corrective,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function modelPerformance(req, res, next) {
  try {
    const { data: models } = await supabase.from('model_versions').select('*').eq('is_active', true);

    const { data: runs } = await supabase
      .from('ai_runs')
      .select('run_type, status, confidence, latency_ms, created_at')
      .eq('org_id', req.user.org_id)
      .order('created_at', { ascending: false })
      .limit(100);

    const { data: feedback } = await supabase
      .from('ai_feedback')
      .select('was_correct, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    const totalRuns = runs?.length || 0;
    const completedRuns = (runs || []).filter((r) => r.status === 'completed').length;
    const failedRuns = (runs || []).filter((r) => r.status === 'failed').length;
    const avgLatency = totalRuns > 0 ? Math.round((runs || []).reduce((s, r) => s + (r.latency_ms || 0), 0) / totalRuns) : 0;
    const avgConfidence = totalRuns > 0 ? parseFloat(((runs || []).reduce((s, r) => s + (r.confidence || 0), 0) / totalRuns).toFixed(4)) : 0;

    const totalFeedback = feedback?.length || 0;
    const correctCount = (feedback || []).filter((f) => f.was_correct).length;
    const accuracy = totalFeedback > 0 ? parseFloat((correctCount / totalFeedback * 100).toFixed(1)) : null;

    res.json({
      data: {
        models,
        total_runs: totalRuns,
        completed_runs: completedRuns,
        failed_runs: failedRuns,
        avg_latency_ms: avgLatency,
        avg_confidence: avgConfidence,
        user_feedback_accuracy_pct: accuracy,
        total_feedback: totalFeedback,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function exportReport(req, res, next) {
  try {
    const { type, format } = req.body;
    const rows = [];

    if (type === 'asset_health') {
      const { data } = await supabase.from('assets').select('name, category, status, criticality, runtime_hours').eq('org_id', req.user.org_id).is('deleted_at', null);
      rows.push(...(data || []));
    } else if (type === 'work_orders') {
      const { data } = await supabase.from('work_orders').select('title, type, priority, status, opened_at, closed_at').eq('org_id', req.user.org_id);
      rows.push(...(data || []));
    } else if (type === 'downtime') {
      const { data } = await supabase.from('downtime_events').select('*, assets(name)');
      rows.push(...(data || []));
    }

    if (format === 'csv') {
      if (rows.length === 0) return res.status(200).send('No data');
      const headers = Object.keys(rows[0]).join(',');
      const csvRows = rows.map((r) => Object.values(r).map((v) => typeof v === 'object' ? JSON.stringify(v) : v).join(','));
      const csv = [headers, ...csvRows].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${type}_report.csv`);
      return res.send(csv);
    }

    res.json({ data: rows, report_type: type, generated_at: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

module.exports = { assetHealth, downtime, maintenanceEffectiveness, modelPerformance, exportReport };
