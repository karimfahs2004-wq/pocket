import {
  Baby, BookOpen, Car, CircleEllipsis, Clapperboard, Coffee, Dumbbell, Fuel, Gift, GraduationCap,
  HeartPulse, House, PawPrint, Plane, ReceiptText, Repeat, Scissors, Shirt, ShoppingBag, Smartphone,
  SquareParking, Utensils, Wifi, Zap, type LucideIcon,
} from 'lucide-react';
import type { Category } from '../domain/types';

/** Words in a category's name that pick its icon. The first match wins. */
const ICONS: [RegExp, LucideIcon][] = [
  [/food|grocer|restaurant|lunch|dinner|meal|eat/, Utensils],
  [/coffee|cafe|café/, Coffee],
  [/parking/, SquareParking],
  [/fuel|gas|petrol|benzin/, Fuel],
  [/transport|taxi|car|uber|bus|ride/, Car],
  [/gym|sport|fitness|workout/, Dumbbell],
  [/phone|mobile|recharge/, Smartphone],
  [/internet|wifi|wi-fi/, Wifi],
  [/entertain|movie|cinema|game|fun|outing/, Clapperboard],
  [/cloth|fashion|wear/, Shirt],
  [/shop/, ShoppingBag],
  [/rent|home|house/, House],
  [/electric|generator|power|utilit/, Zap],
  [/bill/, ReceiptText],
  [/health|medical|doctor|pharmacy|medicine/, HeartPulse],
  [/pet|vet/, PawPrint],
  [/travel|trip|flight|vacation/, Plane],
  [/gift|donation|charity/, Gift],
  [/educat|course|tuition|university|school/, GraduationCap],
  [/book/, BookOpen],
  [/subscri/, Repeat],
  [/hair|barber|salon|beauty/, Scissors],
  [/kid|baby|child/, Baby],
];

export function iconFor(name: string): LucideIcon {
  const n = name.toLowerCase();
  return ICONS.find(([re]) => re.test(n))?.[1] ?? CircleEllipsis;
}

/** A category's icon in a soft circle of its colour. Decorative: the name is always beside it. */
export function CatIcon({ category, small }: { category?: Pick<Category, 'name' | 'colorSlot'>; small?: boolean }) {
  const Icon = iconFor(category?.name ?? '');
  const color = `var(--series-${(category?.colorSlot ?? 6) + 1})`;
  return (
    <span className={`cat-icon${small ? ' small' : ''}`} style={{ color, background: `color-mix(in srgb, ${color} 18%, transparent)` }} aria-hidden>
      <Icon size={small ? 15 : 18} />
    </span>
  );
}
