import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import type { HoardItem } from '../types/content';
import { withBase } from '../utils/basePath';

interface LorePanelProps {
  item: HoardItem | null;
  open: boolean;
  onClose: () => void;
}

export const LorePanel = ({ item, open, onClose }: LorePanelProps) => {
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    gsap.to(panel, {
      xPercent: open ? 0 : 104,
      autoAlpha: open ? 1 : 0,
      duration: open ? 0.52 : 0.28,
      ease: open ? 'power3.out' : 'power2.in',
      pointerEvents: open ? 'auto' : 'none',
    });
  }, [open]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && open) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!item) {
    return (
      <aside ref={panelRef} className="panel lore-panel" aria-hidden="true">
        <p className="panel-empty">Select a relic to inspect its lore.</p>
      </aside>
    );
  }

  return (
    <aside ref={panelRef} className={`panel lore-panel rarity-frame-${item.rarity}`} role="dialog" aria-modal="false">
      <header className="lore-header">
        <div>
          <h2>{item.title}</h2>
          <p>{item.shortSummary}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close lore panel">
          Close
        </button>
      </header>

      <div className="lore-meta">
        <span>{item.rarity}</span>
        <span>{item.category}</span>
        <span>{item.status}</span>
        <span>{item.year}</span>
      </div>

      <section>
        <h3>Legend</h3>
        <p>{item.longDescription}</p>
      </section>

      {item.whyItMatters ? (
        <section>
          <h3>Why it matters</h3>
          <p>{item.whyItMatters}</p>
        </section>
      ) : null}

      {item.notes ? (
        <section>
          <h3>Notes</h3>
          <p>{item.notes}</p>
        </section>
      ) : null}

      <section>
        <h3>Tags</h3>
        <div className="lore-tag-list">
          {item.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </section>

      <section>
        <h3>Tech Stack</h3>
        <div className="lore-tag-list stack">
          {item.techStack.map((stack) => (
            <span key={stack}>{stack}</span>
          ))}
        </div>
      </section>

      {item.images && item.images.length > 0 ? (
        <section>
          <h3>Visions</h3>
          <div className="lore-images">
            {item.images.map((image) => (
              <figure key={image.src}>
                <img src={withBase(image.src)} alt={image.alt} loading="lazy" />
                {image.caption ? <figcaption>{image.caption}</figcaption> : null}
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h3>Links</h3>
        <ul>
          {item.links.map((link) => (
            <li key={`${link.url}-${link.label}`}>
              <a href={link.url} target="_blank" rel="noreferrer noopener">
                {link.label}
              </a>
            </li>
          ))}
          {item.repoUrl ? (
            <li>
              <a href={item.repoUrl} target="_blank" rel="noreferrer noopener">
                Source repository
              </a>
            </li>
          ) : null}
          {item.liveUrl ? (
            <li>
              <a href={item.liveUrl} target="_blank" rel="noreferrer noopener">
                Live project
              </a>
            </li>
          ) : null}
        </ul>
      </section>
    </aside>
  );
};
