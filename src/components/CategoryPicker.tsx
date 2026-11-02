import type { Category } from '../domain/types';
import { Dot } from './ui';

/** Tappable chips: faster on a phone than opening a dropdown. Keeps an archived current value visible. */
export function CategoryPicker({ categories, value, onChange }: {
  categories: Category[]; value: string; onChange: (id: string) => void;
}) {
  return (
    <div className="field">
      <span className="label" id="cat-label">Category</span>
      <div className="chips" role="group" aria-labelledby="cat-label">
        {categories.map((c) => (
          <button type="button" key={c.id} className="chip" aria-pressed={c.id === value} onClick={() => onChange(c.id)}>
            <Dot slot={c.colorSlot} />{c.name}
          </button>
        ))}
      </div>
    </div>
  );
}
