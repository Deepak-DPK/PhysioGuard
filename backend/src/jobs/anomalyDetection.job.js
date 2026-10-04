const { supabase } = require('../config/supabase');
const { logger } = require('../utils/logger');

async function run() {
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

  const { data: readings } = await supabase
    .from('telemetry')
    .select('*, meters_sensors(name, unit, asset_id)')
    .gte('timestamp', oneHourAgo);

  if (!readings?.length) return;

  const bySensor = {};
  readings.forEach((r) => {
    const key = r.sensor_id;
    if (!bySensor[key]) bySensor[key] = { readings: [], sensor: r.meters_sensors };
    bySensor[key].readings.push(r);
  });

  let anomaliesFound = 0;

  for (const [sensorId, { readings: sensorReadings, sensor }] of Object.entries(bySensor)) {
    if (sensorReadings.length < 2) continue;

    const values = sensorReadings.map((r) => r.value);
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / values.length);

    const anomalies = sensorReadings.filter((r) => Math.abs(r.value - avg) > 2 * stdDev);

    if (anomalies.length > 0 && sensor?.asset_id) {
      anomaliesFound += anomalies.length;

      const { data: admins } = await supabase
        .from('users')
        .select('id, org_id')
        .in('role', ['maintenance_admin', 'operations_manager'])
        .limit(5);

      for (const admin of admins || []) {
        await supabase.from('notifications').insert({
          org_id: admin.org_id,
          user_id: admin.id,
          type: 'anomaly_detected',
          title: `Anomaly detected: ${sensor.name}`,
          message: `${anomalies.length} anomalous readings detected in the last hour. Latest value: ${anomalies[0].value} ${sensor.unit}`,
          related_entity_type: 'asset',
          related_entity_id: sensor.asset_id,
          severity: 'warning',
        });
      }
    }
  }

  logger.info(`Anomaly detection complete: ${anomaliesFound} anomalies found in ${Object.keys(bySensor).length} sensors`);
}

module.exports = { run };
