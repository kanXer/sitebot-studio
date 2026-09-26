/**
 * Next.js Server Instrumentation
 * Runs once upon server startup to guarantee background services,
 * such as the 24/7 WhatsApp Baileys socket heartbeat and auto-reconnection,
 * are immediately active without waiting for an admin to log in or open the panel.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { startGlobalWhatsAppHeartbeat } = await import('@/lib/whatsapp/baileysManager');
      startGlobalWhatsAppHeartbeat();
      console.log('[Instrumentation] WhatsApp 24/7 background manager registered.');
    } catch (err) {
      console.warn('[Instrumentation] Failed to register WhatsApp background manager:', err);
    }
  }
}
