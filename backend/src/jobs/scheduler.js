const cron = require('node-cron');
const { logger } = require('../utils/logger');
const healthScoringJob = require('./healthScoring.job');
const remainingLifeJob = require('./remainingLife.job');
const anomalyDetectionJob = require('./anomalyDetection.job');
const effectivenessJob = require('./maintenanceEffectiveness.job');

function initScheduler() {
  cron.schedule('0 */6 * * *', async () => {
    logger.info('Running health scoring job');
    await healthScoringJob.run().catch((err) => logger.error({ err }, 'Health scoring job failed'));
  });

  cron.schedule('0 2 * * *', async () => {
    logger.info('Running remaining useful life estimation job');
    await remainingLifeJob.run().catch((err) => logger.error({ err }, 'RUL job failed'));
  });

  cron.schedule('0 * * * *', async () => {
    logger.info('Running anomaly detection job');
    await anomalyDetectionJob.run().catch((err) => logger.error({ err }, 'Anomaly detection job failed'));
  });

  cron.schedule('0 3 * * 1', async () => {
    logger.info('Running maintenance effectiveness job');
    await effectivenessJob.run().catch((err) => logger.error({ err }, 'Effectiveness job failed'));
  });

  logger.info('Scheduled jobs initialized');
}

module.exports = { initScheduler };
