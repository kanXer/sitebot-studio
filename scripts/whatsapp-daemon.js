/**
 * WhatsApp 24/7 Background Relay Daemon
 * Run this standalone worker on any persistent server (Railway, Render, VPS, PM2, Docker, or Local)
 * to maintain a continuous 24/7 WhatsApp connection for two-way live support handoff.
 * 
 * Usage:
 *   npm run whatsapp:daemon
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path');
const fs = require('fs');

// Load environment variables from .env or .env.local if present
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

console.log('─────────────────────────────────────────────────────────────');
console.log('🤖 Rivafy Studio WhatsApp Relay Daemon starting...');
console.log('─────────────────────────────────────────────────────────────');

async function startDaemon() {
  try {
    // Dynamic import of the compiled/TS baileysManager module
    const { initializeWhatsApp, getWhatsAppStatus } = await import('../src/lib/whatsapp/baileysManager.ts');

    const status = await getWhatsAppStatus();
    console.log(`[Daemon] Current session status: ${status.status}`);

    if (status.status === 'connected' || status.phoneNumber) {
      console.log(`[Daemon] Found existing session for +${status.phoneNumber || 'Admin'}. Connecting socket...`);
    } else {
      console.log('[Daemon] No existing session found. Visit Admin > WhatsApp on your site to scan QR code.');
    }

    await initializeWhatsApp({ forceNew: false });
    console.log('[Daemon] WhatsApp socket running. Listening for live support incoming messages...');
  } catch (err) {
    console.error('[Daemon] Error in WhatsApp daemon:', err);
    setTimeout(startDaemon, 5000);
  }
}

// Keep Node process running
process.on('uncaughtException', (err) => {
  console.error('[Daemon] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Daemon] Unhandled rejection:', reason);
});

startDaemon();
