import React from 'react';
import {
  Gem,
  Headphones,
  Gamepad2,
  Zap,
  CreditCard,
  Wallet,
  ShoppingBag,
  Store,
  Package,
  Megaphone,
  Key,
  Globe,
  Rocket,
  Star,
  Flame,
  FileText,
  MessageSquare,
  Bot,
  Film,
  Smartphone,
  ShieldCheck,
  Tag,
  Coins,
  Sparkles,
  Award,
} from 'lucide-react';

// Registry of supported icons
export const ICON_MAP = {
  gem: Gem,
  headphones: Headphones,
  gamepad: Gamepad2,
  zap: Zap,
  'credit-card': CreditCard,
  wallet: Wallet,
  'shopping-bag': ShoppingBag,
  store: Store,
  package: Package,
  megaphone: Megaphone,
  key: Key,
  globe: Globe,
  rocket: Rocket,
  star: Star,
  flame: Flame,
  'file-text': FileText,
  message: MessageSquare,
  bot: Bot,
  film: Film,
  smartphone: Smartphone,
  shield: ShieldCheck,
  tag: Tag,
  coins: Coins,
  sparkles: Sparkles,
  award: Award,
};

// Fallback mapping for legacy emojis stored in older configurations
export const LEGACY_EMOJI_MAP = {
  '💎': Gem,
  '🎧': Headphones,
  '🎮': Gamepad2,
  '⚡': Zap,
  '💳': CreditCard,
  '🛍️': ShoppingBag,
  '🛍': ShoppingBag,
  '📦': Package,
  '📢': Megaphone,
  '🔑': Key,
  '🌐': Globe,
  '🚀': Rocket,
  '⭐': Star,
  '🔥': Flame,
  '📜': FileText,
  '💬': MessageSquare,
  '🤖': Bot,
  '🎬': Film,
  '📱': Smartphone,
  '💰': Coins,
  '🦉': Sparkles,
  '1️⃣': Sparkles,
  '2️⃣': Sparkles,
  '3️⃣': Sparkles,
  '🔘': Sparkles,
  '✅': ShieldCheck,
  '⚠️': Award,
};

// Curated list for the button icon picker
export const STORE_ICON_OPTIONS = [
  { id: 'gem', label: 'جوهرة / VIP', Icon: Gem },
  { id: 'headphones', label: 'صوتيات / Spotify', Icon: Headphones },
  { id: 'gamepad', label: 'ألعاب وشحن', Icon: Gamepad2 },
  { id: 'zap', label: 'سريع / شدات', Icon: Zap },
  { id: 'credit-card', label: 'محفظة ودفع', Icon: CreditCard },
  { id: 'shopping-bag', label: 'متجر وتسوق', Icon: ShoppingBag },
  { id: 'package', label: 'باقة / منتج', Icon: Package },
  { id: 'megaphone', label: 'قناة وإعلانات', Icon: Megaphone },
  { id: 'shield', label: 'ضمان وأمان', Icon: ShieldCheck },
  { id: 'file-text', label: 'شروط وقوانين', Icon: FileText },
  { id: 'flame', label: 'عروض حصرية', Icon: Flame },
  { id: 'star', label: 'مميز', Icon: Star },
  { id: 'bot', label: 'ذكاء اصطناعي', Icon: Bot },
  { id: 'film', label: 'سينما وNetflix', Icon: Film },
  { id: 'smartphone', label: 'تطبيقات هاتف', Icon: Smartphone },
  { id: 'key', label: 'تراخيص ومفاتيح', Icon: Key },
  { id: 'globe', label: 'رابط خارجي', Icon: Globe },
  { id: 'tag', label: 'تخفيض وكوبون', Icon: Tag },
];

/**
 * Universal StoreIcon component
 * Renders high-end vector SVG icons from Lucide, with full legacy emoji resolution.
 */
export default function StoreIcon({ icon, size = 16, color, style, className }) {
  if (!icon || icon === 'none') return null;

  const IconComponent = ICON_MAP[icon] || LEGACY_EMOJI_MAP[icon];

  if (!IconComponent) {
    // If it's another string that didn't match, return a subtle Sparkles vector fallback instead of raw emoji
    return <Sparkles size={size} color={color} style={style} className={className} />;
  }

  return <IconComponent size={size} color={color} style={style} className={className} />;
}
