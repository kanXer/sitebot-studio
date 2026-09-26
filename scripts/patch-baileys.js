/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '../node_modules/whatsapp-rust-bridge/package.json');
if (fs.existsSync(pkgPath)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    let changed = false;
    if (!pkg.main) {
      pkg.main = './dist/index.js';
      changed = true;
    }
    if (pkg.exports && pkg.exports['.'] && !pkg.exports['.'].require) {
      pkg.exports['.'].require = './dist/index.js';
      pkg.exports['.'].default = './dist/index.js';
      changed = true;
    }
    if (changed) {
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 4));
      console.log('[Patch] Successfully patched whatsapp-rust-bridge package.json exports');
    }
  } catch (e) {
    console.warn('[Patch] Warning patching whatsapp-rust-bridge:', e);
  }
}
