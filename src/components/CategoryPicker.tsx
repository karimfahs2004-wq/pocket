import { Plus } from 'lucide-react';
import { useState } from 'react';
import { addCategory } from '../data/repo';
import type { Category } from '../domain/types';
import { Dot } from './ui';

/** Tappable chips: faster on a phone than a dropdown. New categories can be added right here. */
export function CategoryPicker({ categories, value, onChange, optional }: {
  categories: Category[]; value: string; onChange: (id: string) => void; optional?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const add = async () => {
    if (!name.trim()) return setAdding(false);
    onChange(await addCategory(name));
    setName('');
    setAdding(false);
  };

  return (
    <div className="field">
      <span className="label" id="cat-label">Category{optional && <span className="muted"> (optional)</span>}</span>
      <div className="chips" role="group" aria-labelledby="cat-label">
        {categories.map((c) => (
          <button type="button" key={c.id} className="chip" aria-pressed={c.id === value} onClick={() => onChange(optional && c.id === value ? '' : c.id)}>
            <Dot slot={c.colorSlot} />{c.name}
          </button>
        ))}
        {!adding && (
          <button type="button" className="chip chip-new" onClick={() => setAdding(true)}>
            <Plus size={16} aria-hidden />New
          </button>
        )}
      </div>
      {adding && (
        <div className="inline-add">
          <input
            aria-label="New category name"
            placeholder="Category name"
            autoFocus
            value={name}
            enterKeyHint="done"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void add(); } }}
          />
          <button type="button" className="btn" onClick={add}>Add</button>
        </div>
      )}
    </div>
  );
}
