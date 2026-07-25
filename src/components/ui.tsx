import { useEffect, useState } from 'react';
import { Cloud, CloudRain, Sun, CloudFog, CloudSnow, CloudLightning, CloudDrizzle, type LucideIcon } from 'lucide-react';
import { weatherIcon } from '@/lib/weather';

const ICONS: Record<string, LucideIcon> = {
  sun: Sun,
  cloud: Cloud,
  'cloud-sun': Sun,
  'cloud-fog': CloudFog,
  'cloud-drizzle': CloudDrizzle,
  'cloud-rain': CloudRain,
  'cloud-snow': CloudSnow,
  'cloud-lightning': CloudLightning,
};

export function WeatherIcon({ code, size = 24 }: { code: number; size?: number }) {
  const name = weatherIcon(code);
  const Icon = ICONS[name] ?? Cloud;
  return <Icon size={size} />;
}

export function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
