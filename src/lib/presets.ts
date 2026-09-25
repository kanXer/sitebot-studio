export interface LauncherPreset {
  id: string;
  label: string;
  desc: string;
  emoji?: string;
}

export interface QuickLinkPreset {
  label: string;
  url: string;
  emoji: string;
}

export const LAUNCHER_PRESETS: LauncherPreset[] = [
  { id: 'standard', label: 'Halo Bubble', desc: 'Round with rotating halo & ping badge', emoji: '🔘' },
  { id: 'minimal', label: 'Minimal', desc: 'Clean round button, no effects', emoji: '⚪' },
  { id: 'pill', label: 'Pill Chat', desc: 'Elongated with "Chat with us" text' },
  { id: 'chat', label: 'Chat Ring', desc: 'White button with brand ring & glow' },
  { id: 'chatbox', label: 'Bubble Chat', desc: 'Speech-bubble shape, bold gradient' },
  { id: 'heart', label: 'Heartbeat', desc: 'Heart pulse with love vibe', emoji: '💗' },
  { id: 'gradient-ring', label: 'Gradient Ring', desc: 'Rotating rainbow ring around icon' },
  { id: 'neon-glow', label: 'Neon Glow', desc: 'Cyber neon outer glow' },
  { id: 'emoji', label: 'Emoji Wave', desc: 'Big friendly 👋 emoji pop' },
  { id: 'square', label: 'Rounded Square', desc: 'Modern squircle, no circle' },
  { id: 'beacon', label: 'Beacon', desc: 'Minimal dot with radar pings' },
  { id: 'text-button', label: 'Action Text', desc: '"Chat" text pill' },
];

export const QUICK_LINK_PRESETS: QuickLinkPreset[] = [
  { label: 'Book a Demo', url: '/demo', emoji: '📅' },
  { label: 'Our Services', url: '/services', emoji: '🛠️' },
  { label: 'Our Products', url: '/products', emoji: '🛍️' },
  { label: 'Contact Us', url: '/contact', emoji: '📍' },
  { label: 'About Us', url: '/about', emoji: 'ℹ️' },
  { label: 'FAQ / Help', url: '/faq', emoji: '❓' },
  { label: 'Career / Jobs', url: '/careers', emoji: '💼' },
  { label: 'Track Order', url: '/track-order', emoji: '📦' },
  { label: 'Reviews', url: '/reviews', emoji: '⭐' },
  { label: 'Our Work', url: '/work', emoji: '🎨' },
  { label: 'Blog', url: '/blog', emoji: '📰' },
  { label: 'Our Locations', url: '/locations', emoji: '🗺️' },
];