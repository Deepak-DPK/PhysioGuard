const { getModel } = require('../config/gemini');
const { supabase } = require('../config/supabase');
const { logger } = require('../utils/logger');

async function runAI(orgId, runType, assetId, prompt, inputSnapshot) {
  const startTime = Date.now();
  const modelVersion = 'gemini-2.5-flash';

  try {
    const model = getModel();
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    let output;
    try {
      const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/) || responseText.match(/\{[\s\S]*\}/);
      output = JSON.parse(jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : responseText);
    } catch {
      output = { raw_response: responseText };
    }

    const latencyMs = Date.now() - startTime;
    const confidence = output.confidence ?? output.risk_score ? (output.risk_score > 50 ? 0.8 : 0.9) : 0.75;

    const { data: aiRun } = await supabase
      .from('ai_runs')
      .insert({
        org_id: orgId,
        run_type: runType,
        asset_id: assetId,
        input_snapshot: inputSnapshot,
        output,
        model_version: modelVersion,
        confidence,
        latency_ms: latencyMs,
        status: 'completed',
      })
      .select()
      .single();

    return { ...output, ai_run_id: aiRun?.id, model_version: modelVersion, confidence, latency_ms: latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    await supabase.from('ai_runs').insert({
      org_id: orgId,
      run_type: runType,
      asset_id: assetId,
      input_snapshot: inputSnapshot,
      model_version: modelVersion,
      latency_ms: latencyMs,
      status: 'failed',
      error_message: err.message,
    });
    logger.error({ err }, `AI ${runType} failed`);
    throw err;
  }
}

async function predictFailure(orgId, asset, telemetry, history) {
  const prompt = `You are a predictive maintenance AI for physiotherapy equipment.
Analyze the following asset data and predict failure risk.

Asset: ${JSON.stringify({ name: asset.name, category: asset.category, runtime_hours: asset.runtime_hours, criticality: asset.criticality, install_date: asset.install_date })}
Recent Telemetry (last 30 days): ${JSON.stringify(telemetry.slice(0, 50))}
Maintenance History: ${JSON.stringify(history.slice(0, 20))}

Respond ONLY with valid JSON:
{
  "risk_score": <0-100 number>,
  "confidence": <0-1 number>,
  "explanation": "<concise explanation of risk factors>",
  "factors": ["<factor1>", "<factor2>"],
  "recommended_action": "<what to do next>",
  "urgency": "<low|medium|high|critical>"
}`;

  return runAI(orgId, 'predict_failure', asset.id, prompt, { asset_id: asset.id, telemetry_count: telemetry.length });
}

async function estimateRUL(orgId, asset, meterReadings, serviceHistory) {
  const prompt = `You are a remaining useful life (RUL) estimation AI for physiotherapy equipment.

Asset: ${JSON.stringify({ name: asset.name, category: asset.category, runtime_hours: asset.runtime_hours, install_date: asset.install_date, manufacturer: asset.manufacturer })}
Meter Readings: ${JSON.stringify(meterReadings.slice(0, 30))}
Service History: ${JSON.stringify(serviceHistory.slice(0, 20))}

Respond ONLY with valid JSON:
{
  "rul_days": <estimated remaining useful life in days>,
  "confidence": <0-1 number>,
  "explanation": "<concise explanation>",
  "factors": ["<factor1>", "<factor2>"],
  "recommended_maintenance_date": "<ISO date string>"
}`;

  return runAI(orgId, 'estimate_rul', asset.id, prompt, { asset_id: asset.id });
}

async function detectAnomalies(orgId, assetId, telemetry) {
  const prompt = `You are an anomaly detection AI for physiotherapy equipment sensors.

Telemetry Data: ${JSON.stringify(telemetry.slice(0, 100))}

Analyze for anomalies (sudden spikes, drifts, out-of-range values, unusual patterns).

Respond ONLY with valid JSON:
{
  "anomalies": [{"timestamp": "<ISO>", "sensor": "<name>", "value": <num>, "expected_range": "<range>", "severity": "<low|medium|high>", "description": "<what's wrong>"}],
  "overall_status": "<normal|warning|critical>",
  "confidence": <0-1 number>,
  "explanation": "<summary>"
}`;

  return runAI(orgId, 'anomaly_detection', assetId, prompt, { asset_id: assetId, data_points: telemetry.length });
}

async function recogniseDefects(orgId, assetId, imageBase64, assetCategory) {
  const prompt = `You are a visual defect recognition AI for physiotherapy equipment (category: ${assetCategory}).

Analyze the provided image for visible defects, wear, damage, or safety concerns.

Respond ONLY with valid JSON:
{
  "defects": [{"type": "<defect type>", "location": "<where on equipment>", "severity": "<low|medium|high|critical>", "description": "<details>"}],
  "overall_condition": "<good|fair|poor|critical>",
  "confidence": <0-1 number>,
  "explanation": "<summary>",
  "recommended_action": "<what to do>"
}`;

  try {
    const model = getModel();
    const imagePart = { inlineData: { data: imageBase64, mimeType: 'image/jpeg' } };
    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text();

    let output;
    try {
      const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/) || responseText.match(/\{[\s\S]*\}/);
      output = JSON.parse(jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : responseText);
    } catch {
      output = { raw_response: responseText };
    }

    await supabase.from('ai_runs').insert({
      org_id: orgId,
      run_type: 'defect_recognition',
      asset_id: assetId,
      output,
      model_version: 'gemini-2.5-flash',
      confidence: output.confidence ?? 0.75,
      status: 'completed',
    });

    return output;
  } catch (err) {
    logger.error({ err }, 'Defect recognition failed');
    throw err;
  }
}

async function summariseRepairNotes(orgId, assetId, workOrders) {
  const notes = workOrders.map((wo) => ({
    title: wo.title,
    type: wo.type,
    notes: wo.notes,
    status: wo.status,
    date: wo.opened_at,
  }));

  const prompt = `You are a repair note summarisation AI for physiotherapy equipment maintenance.

Work Orders / Repair Notes: ${JSON.stringify(notes)}

Provide a concise summary of all repair activities.

Respond ONLY with valid JSON:
{
  "summary": "<overall summary paragraph>",
  "key_findings": ["<finding1>", "<finding2>"],
  "recurring_issues": ["<issue1>"],
  "recommendation": "<overall recommendation>",
  "confidence": <0-1 number>
}`;

  return runAI(orgId, 'summarise_notes', assetId, prompt, { asset_id: assetId, work_order_count: workOrders.length });
}

module.exports = { predictFailure, estimateRUL, detectAnomalies, recogniseDefects, summariseRepairNotes };
