import type { HoardItem } from '../types/content';

interface AccessibilityListProps {
  open: boolean;
  items: HoardItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onInspect: (id: string) => void;
}

export const AccessibilityList = ({ open, items, selectedId, onSelect, onInspect }: AccessibilityListProps) => {
  if (!open) {
    return null;
  }

  return (
    <section className="access-list" aria-label="Accessible item browse mode">
      <header>
        <h2>Archive Index</h2>
        <p>Keyboard-friendly fallback list for browsing all visible relics.</p>
      </header>
      <ul>
        {items.map((item) => {
          const active = item.id === selectedId;
          return (
            <li key={item.id} className={active ? 'active' : ''}>
              <button type="button" onClick={() => onSelect(item.id)}>
                <span>{item.title}</span>
                <small>
                  {item.year} · {item.rarity} · {item.category}
                </small>
              </button>
              <button type="button" onClick={() => onInspect(item.id)}>
                Inspect
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
