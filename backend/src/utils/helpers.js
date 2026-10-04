const { v4: uuidv4 } = require('uuid');

function generateUUID() {
  return uuidv4();
}

function sanitiseString(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[<>]/g, '');
}

function parseSort(sortParam, allowedFields) {
  if (!sortParam) return { field: 'created_at', direction: 'desc' };
  const desc = sortParam.startsWith('-');
  const field = desc ? sortParam.slice(1) : sortParam;
  if (!allowedFields.includes(field)) return { field: 'created_at', direction: 'desc' };
  return { field, direction: desc ? 'desc' : 'asc' };
}

module.exports = { generateUUID, sanitiseString, parseSort };
