import type { MarketItem } from '../types';

export default function MarketIcon({ item }: { item: MarketItem }) {
  if (item.icon && /^https?:\/\//.test(item.icon)) {
    return <img src={item.icon} alt="" className="h-full w-full rounded-xl object-cover" />;
  }

  return (
    <span className="text-lg font-semibold">{(item.name || item.identifier).slice(0, 2)}</span>
  );
}
