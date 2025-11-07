// backend/routes/config.js
const storage = require('../models/storage');

const DEFAULTS = {
  max_retries: 3,
  backoff_base: 2
};

async function getConfig() {
  const cfg = await storage.getMeta('config');
  if (!cfg) {
    await storage.setMeta('config', DEFAULTS);
    return DEFAULTS;
  }
  return { ...DEFAULTS, ...cfg };
}

async function setConfig(key, value) {
  const cfg = await getConfig();
  cfg[key] = isNaN(value) ? value : Number(value);
  await storage.setMeta('config', cfg);
  console.log("✅ Updated config:", cfg);
  return cfg;
}

module.exports = { getConfig, setConfig };
