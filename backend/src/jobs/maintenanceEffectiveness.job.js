const { supabase } = require('../config/supabase');
const { logger } = require('../utils/logger');

async function run() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const { data: predictions } = await supabase
    .from('failure_predictions')
    .select('*')
    .gte('predicted_at', thirtyDaysAgo)
    .in('review_decision', ['approved', 'overridden']);

  const { data: workOrders } = await supabase
    .from('work_orders')
    .select('*')
    .gte('created_at', thirtyDaysAgo)
    .eq('status', 'closed');

  const predictedAssets = new Set((predictions || []).map((p) => p.asset_id));
  const maintainedAssets = new Set((workOrders || []).map((wo) => wo.asset_id));

  const { data: emergencies } = await supabase
    .from('work_orders')
    .select('asset_id')
    .eq('type', 'emergency')
    .gte('created_at', thirtyDaysAgo);

  const emergencyAssets = new Set((emergencies || []).map((e) => e.asset_id));

  const missedFailures = [...emergencyAssets].filter((id) => !predictedAssets.has(id));
  const falseAlarms = [...predictedAssets].filter(
    (id) => !emergencyAssets.has(id) && !maintainedAssets.has(id)
  );

  const metrics = {
    total_predictions: predictions?.length || 0,
    total_closed_work_orders: workOrders?.length || 0,
    total_emergencies: emergencies?.length || 0,
    missed_failures: missedFailures.length,
    false_alarms: falseAlarms.length,
    period: '30_days',
    calculated_at: new Date().toISOString(),
  };

  logger.info({ metrics }, 'Maintenance effectiveness metrics calculated');

  await supabase.from('system_config').upsert({
    org_id: null,
    key: 'maintenance_effectiveness_metrics',
    value: metrics,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'org_id,key' });
}

module.exports = { run };
