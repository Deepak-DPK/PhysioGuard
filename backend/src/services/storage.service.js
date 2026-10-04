const { supabase } = require('../config/supabase');
const crypto = require('crypto');

async function uploadFile(bucket, path, buffer, contentType) {
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, { contentType, upsert: false });

  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);

  return { url: data.publicUrl, checksum };
}

module.exports = { uploadFile };
