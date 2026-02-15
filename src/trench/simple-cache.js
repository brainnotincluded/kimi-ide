// Simple file-based cache instead of SQLite
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CACHE_DIR = path.join(require('os').homedir(), '.trench', 'cache');

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function getHash(key) {
  return crypto.createHash('md5').update(key).digest('hex');
}

function getCacheFile(key) {
  return path.join(CACHE_DIR, `${getHash(key)}.json`);
}

module.exports = {
  get(key) {
    try {
      const file = getCacheFile(key);
      if (!fs.existsSync(file)) return undefined;
      
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (data.expiry && data.expiry < Date.now()) {
        fs.unlinkSync(file);
        return undefined;
      }
      return data.value;
    } catch {
      return undefined;
    }
  },
  
  set(key, value, ttlSeconds = 3600) {
    try {
      const file = getCacheFile(key);
      const data = {
        value,
        expiry: ttlSeconds > 0 ? Date.now() + (ttlSeconds * 1000) : null
      };
      fs.writeFileSync(file, JSON.stringify(data));
    } catch (err) {
      console.error('Cache write error:', err.message);
    }
  },
  
  clear() {
    try {
      fs.readdirSync(CACHE_DIR).forEach(f => {
        fs.unlinkSync(path.join(CACHE_DIR, f));
      });
    } catch {}
  }
};
