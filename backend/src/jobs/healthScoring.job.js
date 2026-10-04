const { supabase } = require('../config/supabase');
const { calculateHealthScore } = require('../services/healthScore.service');
const { logger } = require('../utils/logger');

async function run() {
  const { data: assets } = await supabase
    .from('assets')
    .select('id')
    .eq('status', 'active')
    .is('deleted_at', null);

  if (!assets?.length) return;

  let processed = 0;
  for (const asset of assets) {
    try {
      await calculateHealthScore(asset.id);
      processed++;
    } catch (err) {
      logger.error({ err, assetId: asset.id }, 'Health score calc failed for asset');
    }
  }

  logger.info(`Health scoring complete: ${processed}/${assets.length} assets processed`);
}

module.exports = { run };
