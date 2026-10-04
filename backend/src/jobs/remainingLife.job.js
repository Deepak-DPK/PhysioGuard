const { supabase } = require('../config/supabase');
const { logger } = require('../utils/logger');

async function run() {
  const { data: assets } = await supabase
    .from('assets')
    .select('id, name, category, runtime_hours, install_date, manufacturer, org_id')
    .eq('status', 'active')
    .is('deleted_at', null)
    .in('criticality', ['high', 'critical']);

  if (!assets?.length) return;

  logger.info(`RUL estimation: ${assets.length} high-criticality assets queued`);

  for (const asset of assets) {
    try {
      const { data: meters } = await supabase.from('meters_sensors').select('*').eq('asset_id', asset.id);
      const { data: history } = await supabase.from('service_history').select('*').eq('asset_id', asset.id).limit(20);

      const runtimeYears = asset.install_date
        ? (Date.now() - new Date(asset.install_date).getTime()) / (365.25 * 86400000)
        : null;

      const estimatedTotalLife = asset.category === 'electrotherapy_unit' ? 5 : 8;
      const rulDays = runtimeYears
        ? Math.max(0, Math.round((estimatedTotalLife - runtimeYears) * 365))
        : 365;

      const confidence = meters?.length > 0 ? 0.75 : 0.5;

      await supabase.from('failure_predictions').insert({
        asset_id: asset.id,
        model_version: 'rule-based-v1',
        rul_days: rulDays,
        confidence,
        explanation: `Rule-based estimate: ${rulDays} days remaining based on ${runtimeYears?.toFixed(1) || 'unknown'} years in service`,
        review_decision: 'pending',
      });
    } catch (err) {
      logger.error({ err, assetId: asset.id }, 'RUL estimation failed');
    }
  }
}

module.exports = { run };
