const { supabase } = require('../config/supabase');
const { logger } = require('../utils/logger');

async function calculateHealthScore(assetId) {
  const { data: asset } = await supabase.from('assets').select('*').eq('id', assetId).single();
  if (!asset) return null;

  const { data: recentTelemetry } = await supabase
    .from('telemetry')
    .select('*')
    .eq('asset_id', assetId)
    .order('timestamp', { ascending: false })
    .limit(50);

  const { data: recentWorkOrders } = await supabase
    .from('work_orders')
    .select('*')
    .eq('asset_id', assetId)
    .order('created_at', { ascending: false })
    .limit(10);

  const { data: plans } = await supabase
    .from('maintenance_plans')
    .select('*')
    .eq('asset_id', assetId)
    .eq('status', 'active');

  let runtimeScore = 100;
  if (asset.runtime_hours > 10000) runtimeScore = 40;
  else if (asset.runtime_hours > 5000) runtimeScore = 60;
  else if (asset.runtime_hours > 2000) runtimeScore = 80;

  let maintenanceScore = 100;
  const overduePlans = (plans || []).filter((p) => p.next_due && new Date(p.next_due) < new Date());
  if (overduePlans.length > 0) maintenanceScore -= overduePlans.length * 20;

  const emergencyOrders = (recentWorkOrders || []).filter((wo) => wo.type === 'emergency');
  let incidentScore = 100 - emergencyOrders.length * 15;

  let sensorScore = 100;
  if (!recentTelemetry || recentTelemetry.length === 0) sensorScore = 50;

  const weights = { runtime: 0.25, maintenance: 0.3, incidents: 0.25, sensors: 0.2 };
  const score = Math.max(0, Math.min(100,
    runtimeScore * weights.runtime +
    Math.max(0, maintenanceScore) * weights.maintenance +
    Math.max(0, incidentScore) * weights.incidents +
    sensorScore * weights.sensors
  ));

  const factors = {
    runtime: parseFloat((runtimeScore / 100).toFixed(2)),
    maintenance_adherence: parseFloat((Math.max(0, maintenanceScore) / 100).toFixed(2)),
    incident_history: parseFloat((Math.max(0, incidentScore) / 100).toFixed(2)),
    sensor_health: parseFloat((sensorScore / 100).toFixed(2)),
  };

  const { data: healthScore, error } = await supabase
    .from('health_scores')
    .insert({ asset_id: assetId, score: parseFloat(score.toFixed(2)), factors })
    .select()
    .single();

  if (error) {
    logger.error({ error }, 'Failed to insert health score');
    return null;
  }

  return healthScore;
}

module.exports = { calculateHealthScore };
