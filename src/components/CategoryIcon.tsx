import {
  Zap,
  Droplets,
  Wind,
  ThermometerSnowflake,
  RefreshCw,
  Hammer,
  Paintbrush,
  Sparkles,
  Wrench,
  ShieldCheck,
} from 'lucide-react';

const ICON_MAP = {
  Zap,
  Droplets,
  Wind,
  ThermometerSnowflake,
  RefreshCw,
  Hammer,
  Paintbrush,
  Sparkles,
  Wrench,
  ShieldCheck,
} as const;

export function CategoryIcon({ name, className = 'w-5 h-5' }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name as keyof typeof ICON_MAP] || Wrench;
  return <Icon className={className} />;
}
