const { supabase } = require('../config/supabase');

async function createNotification({ orgId, userId, type, title, message, relatedEntityType, relatedEntityId, severity = 'info' }) {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      org_id: orgId,
      user_id: userId,
      type,
      title,
      message,
      related_entity_type: relatedEntityType,
      related_entity_id: relatedEntityId,
      severity,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

module.exports = { createNotification };
