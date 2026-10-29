import { useEffect, useMemo, useRef, useState } from 'react';
import { canEnter, categoryLabel, filterProjects, loadProjects, siteUrl, statusLabel, type Project } from './catalog';
import type { TreasuryWorld, Chamber, Arrangement } from './world';
import { TreasurySound } from './sound';
import { sceneFailureMessage, startScene, type SceneFailure } from './scene-recovery';

type IconName = 'arrow' | 'back' | 'diamond' | 'grid' | 'world' | 'search' | 'close' | 'reset' | 'pause' | 'play' | 'sound' | 'mute' | 'help' | 'chevron' | 'spark' | 'dragon' | 'focus';
function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    back: <path d="M19 12H5m6-6-6 6 6 6" />,
    diamond: <><path d="m12 2 8 10-8 10L4 12 8-10Z" /><path d="M4 12h16M12 2l3 10-3 10-3-10 3-10Z" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    world: <><path d="m12 2 10 6v8l-10 6-10-6V8l10-6ZM2 8l10 6 10-6M12 14v8M7 5l10 6" /></>,
    search: <><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    reset: <><path d="M3 10a9 9 0 1 1 2 8M3 3v7h7" /></>,
    pause: <><path d="M8 5v14M16 5v14" /></>,
    play: <path d="m8 4 12 8-12 8V4Z" />,
    sound: <><path d="m11 4-6 5H2v6h3l6 5V4ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></>,
    mute: <><path d="m11 4-6 5H2v6h3l6 5V4Zm5 5 6 6m-6 0 6-6" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9 8a3 3 0 1 1 4 3c-1 1-1 1-1 3m0 3h.01" /></>,
    chevron: <path d="m8 4 8 8-8 8" />,
    spark: <><path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7ZM20 2v4m-2-2h4" /></>,
    dragon: <><path d="m4 18 2-8 5-5-1-3 5 3 5-2-2 6 3 4-5 2-3-2-2 3 4 5-7-2-4-1Z" /><path d="m7 11 3-1m6-1h.01M4 18l-2 3" /></>,
    focus: <><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" /><circle cx="12" cy="12" r="3" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
function readPreference(key: string, fallback: boolean) { try { const saved = localStorage.getItem(key); return saved === null ? fallback : saved === 'true'; } catch { return fallback; } }
function ProjectImage({ project }: { project: Project }) {
  const [failed, setFailed] = useState(false);
  return !failed && project.image ? <img src={project.image} alt="" loading="lazy" onError={() => setFailed(true)} /> : <span className="image-fallback"><Icon name="diamond" size={30} /></span>;
}
const chambers: { value: Chamber; label: string; subtitle: string }[] = [
  { value: 'ember', label: 'The Ember Vault', subtitle: 'Warm stone. Restless gold.' },
  { value: 'moon', label: 'Moonlit Grotto', subtitle: 'Silver light. Quiet discoveries.' },
  { value: 'forest', label: 'Emerald Hollow', subtitle: 'Old roots. New beginnings.' },
];
const filters = [{ value: 'all', label: 'All treasures' }, { value: 'featured', label: 'Featured' }, { value: 'shipped', label: 'Released' }, { value: 'product', label: 'Products' }, { value: 'experiment', label: 'Experiments' }, { value: 'infrastructure', label: 'Infrastructure' }];

export function Treasury() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadError, setLoadError] = useState('');
  const [sceneError, setSceneError] = useState<SceneFailure | null>(null);
  const [sceneAttempt, setSceneAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [worldVersion, setWorldVersion] = useState(0);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<'world' | 'collection'>('world');
  const [chamber, setChamber] = useState<Chamber>('ember');
  const [arrangement, setArrangement] = useState<Arrangement>('hoard');
  const [paused, setPaused] = useState(() => readPreference('treasury-paused', false));
  const [reduced, setReduced] = useState(() => readPreference('treasury-reduced', window.matchMedia('(prefers-reduced-motion: reduce)').matches));
  const [soundOn, setSoundOn] = useState(false);
  const [help, setHelp] = useState(false);
  const [message, setMessage] = useState('');
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const world = useRef<TreasuryWorld>();
  const sound = useRef(new TreasurySound());
  const search = useRef<HTMLInputElement>(null);
  const collection = useRef<HTMLElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const messageTimer = useRef<ReturnType<typeof setTimeout>>();
  const callbacks = useRef({ select: (_id: string) => {}, wake: () => {} });
  const visible = useMemo(() => filterProjects(projects, filter, query), [projects, filter, query]);
  const selected = projects.find(project => project.id === selectedId);
  const hoverProject = projects.find(project => project.id === hover?.id);
  const currentChamber = chambers.find(item => item.value === chamber)!;
  const announce = (text: string) => { setMessage(text); clearTimeout(messageTimer.current); messageTimer.current = setTimeout(() => setMessage(''), 4300); };
  const select = (id: string) => {
    lastFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedId(id); sound.current.chime(); setHover(null);
  };
  const close = () => { setSelectedId(null); lastFocus.current?.focus(); };
  const wake = () => { world.current?.wake(); announce(reduced || paused ? 'The keeper is resting. Resume motion to see him stir.' : 'You have the keeper’s attention.'); sound.current.chime(); };
  callbacks.current = { select, wake };

  useEffect(() => {
    let active = true;
    loadProjects().then(data => { if (active) setProjects(data); }).catch(error => { if (active) setLoadError(error.message); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!projects.length || !host.current) return;
    const element = host.current;
    const session = startScene({
      load: () => import('./world'),
      create: ({ TreasuryWorld }, reducedGraphics) => new TreasuryWorld(element, projects, { select: id => callbacks.current.select(id), wake: () => callbacks.current.wake(), hover: (id, x, y) => setHover(id ? { id, x, y } : null) }, reducedGraphics),
      ready: scene => { world.current = scene; setSceneError(null); setReady(true); setWorldVersion(version => version + 1); },
      recovering: () => { world.current = undefined; setReady(false); setHover(null); },
      failed: failure => { world.current = undefined; setSceneError(failure); setView('collection'); setReady(false); setHover(null); },
      reducedGraphics: sceneAttempt > 0,
    });
    const failure = (event: Event) => session.interrupted((event as CustomEvent<SceneFailure>).detail);
    element.addEventListener('treasury-render-error', failure);
    return () => { element.removeEventListener('treasury-render-error', failure); session.dispose(); world.current = undefined; };
  }, [projects, sceneAttempt]);
  useEffect(() => { if (ready) world.current?.setChamber(chamber); }, [chamber, ready, worldVersion]);
  useEffect(() => { if (ready) world.current?.setFilter(visible.map(project => project.id)); }, [visible, ready, worldVersion]);
  useEffect(() => { if (ready) world.current?.setArrangement(arrangement); }, [arrangement, ready, worldVersion]);
  useEffect(() => { if (ready) world.current?.select(selectedId); }, [selectedId, ready, worldVersion]);
  useEffect(() => {
    world.current?.setMotion(reduced, paused || view === 'collection');
    world.current?.setActive(view === 'world');
    try { localStorage.setItem('treasury-paused', String(paused)); localStorage.setItem('treasury-reduced', String(reduced)); } catch { /* Preferences are optional. */ }
  }, [reduced, paused, view, ready, worldVersion]);
  useEffect(() => { if (view === 'collection') { sound.current.stop(); setSoundOn(false); } }, [view]);
  useEffect(() => { if (selectedId) closeButton.current?.focus({ preventScroll: true }); }, [selectedId]);
  useEffect(() => { if (selectedId && !visible.some(project => project.id === selectedId)) setSelectedId(null); }, [visible, selectedId]);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setHelp(false); setSelectedId(null); lastFocus.current?.focus(); }
      if (event.key === '/' && !(event.target instanceof HTMLInputElement)) { event.preventDefault(); search.current?.focus(); }
    };
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => setReduced(media.matches);
    const visibility = () => sound.current.setHidden(document.hidden);
    window.addEventListener('keydown', keyboard); media.addEventListener('change', motion); document.addEventListener('visibilitychange', visibility);
    return () => { window.removeEventListener('keydown', keyboard); media.removeEventListener('change', motion); document.removeEventListener('visibilitychange', visibility); sound.current.stop(); clearTimeout(messageTimer.current); };
  }, []);
  const toggleSound = async () => {
    if (soundOn) { sound.current.stop(); setSoundOn(false); }
    else { try { await sound.current.start(); setSoundOn(true); } catch { announce('Sound could not start in this browser.'); } }
  };
  const browse = () => { setView('collection'); setSelectedId(null); collection.current?.focus({ preventScroll: true }); };
  const retryScene = () => {
    if (sceneError?.stage === 'download') { window.location.reload(); return; }
    setSceneError(null); setReady(false); setView('world'); setSceneAttempt(attempt => attempt + 1);
  };

  return <div className={`treasury-app chamber-${chamber} view-${view}${selected ? ' has-selection' : ''}`}>
    <a className="skip-link" href="#collection">Skip to the treasure collection</a>
    <header className="site-header">
      <a className="brand" href={siteUrl('index.html')} aria-label="Zach Mackay home"><span className="brand-mark"><Icon name="dragon" size={28} /></span><span>ZACH MACKAY<span className="brand-subtitle">THE COLLECTION</span></span></a>
      <div className="header-breadcrumb"><span>Projects</span><Icon name="chevron" size={12} /><span>Dragon Treasury</span></div>
      <a className="back-link" href={siteUrl('projects.html')}><Icon name="back" size={15} /><span>Back to portfolio</span></a>
    </header>

    <main className="experience">
      <div ref={host} className="world-canvas" />
      <div className="scene-shade" aria-hidden="true" />
      <div className="scene-grain" aria-hidden="true" />
      {!ready && !sceneError && !loadError && <div className="world-loading" role="status"><span className="loading-rune"><Icon name="diamond" size={26} /></span>Opening the vault…</div>}

      <div className="world-topline">
        <div className="location"><span className="tiny-diamond" /> <span>THE INNER SANCTUM</span><span className="location-divider">/</span><span>01</span></div>
        <div className="view-switch" aria-label="Display mode"><button className={view === 'world' ? 'active' : ''} aria-pressed={view === 'world'} onClick={() => { if (sceneError) retryScene(); else setView('world'); setHover(null); }}><Icon name="world" size={15} />3D world</button><button className={view === 'collection' ? 'active' : ''} aria-pressed={view === 'collection'} onClick={browse}><Icon name="grid" size={14} />Collection</button></div>
      </div>

      {view === 'world' && !selected && <section className="intro" aria-labelledby="treasury-title">
        <p className="eyebrow">A LIVING ARCHIVE OF THINGS I BUILD</p>
        <h1 id="treasury-title">The Dragon’s<br /><em>Treasury.</em></h1>
        <span className="title-rule" aria-hidden="true"><span />✧<span /></span>
        <p className="intro-copy">Every project has a story.<br />Every story deserves a place in the hoard.</p>
        <button className="text-link explore-link" onClick={browse}>Explore the collection <Icon name="arrow" size={17} /></button>
        <div className="collection-stats"><span><strong>{projects.length || '—'}</strong> treasures</span><i /><span><strong>{projects.filter(project => project.status === 'shipped').length || '—'}</strong> released into the world</span></div>
      </section>}

      {view === 'world' && <>
        <div className="chamber-picker"><label htmlFor="chamber">YOUR SURROUNDINGS</label><div><Icon name="spark" size={16} /><select id="chamber" value={chamber} onChange={event => setChamber(event.target.value as Chamber)}>{chambers.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select></div><p>{currentChamber.subtitle}</p></div>
        <div className="keeper-note"><span className="keeper-status" /><span>THE KEEPER IS {paused || reduced ? 'RESTING' : 'WATCHING'}</span><button onClick={wake} disabled={!ready}>Wake the dragon <Icon name="spark" size={13} /></button></div>
        <div className="scene-bottom"><p className="scene-instructions"><span>DRAG</span> to look around <i /> <span>SCROLL</span> to get closer <i /> <span>SELECT</span> a treasure</p><div className="world-controls">
          <button title="Reset camera" aria-label="Reset camera" disabled={!ready} onClick={() => { world.current?.reset(); announce('Returned to the vault entrance.'); }}><Icon name="reset" size={17} /></button>
          <button title={paused ? 'Resume animation' : 'Pause animation'} aria-label={paused ? 'Resume animation' : 'Pause animation'} aria-pressed={paused} onClick={() => setPaused(!paused)}><Icon name={paused ? 'play' : 'pause'} size={17} /></button>
          <button title={soundOn ? 'Mute ambience' : 'Enable ambience'} aria-label={soundOn ? 'Mute ambience' : 'Enable ambience'} aria-pressed={soundOn} onClick={toggleSound}><Icon name={soundOn ? 'sound' : 'mute'} size={17} /></button>
          <button title="Help and accessibility" aria-label="Help and accessibility" aria-expanded={help} onClick={() => setHelp(!help)}><Icon name="help" size={17} /></button>
        </div></div>
      </>}

      {selected && <aside className="relic-panel" aria-labelledby="relic-title">
        <div className="panel-heading"><span className="eyebrow">DISCOVERED IN THE HOARD</span><button ref={closeButton} className="icon-button" aria-label="Close project details" onClick={close}><Icon name="close" size={18} /></button></div>
        <div className="project-art" style={{ '--project-accent': selected.accent } as React.CSSProperties}><ProjectImage key={selected.id} project={selected} /><span className="art-gem"><Icon name="diamond" size={21} /></span></div>
        <div className="project-meta"><span>{categoryLabel(selected.category)}</span><span className={selected.status === 'shipped' ? 'status released' : 'status'}>{statusLabel(selected)}</span></div>
        <h2 id="relic-title">{selected.title}</h2><p className="project-type">{selected.type}</p><p className="project-description">{selected.blurb}</p>
        <div className="project-tags">{[...new Set([...selected.platforms, ...selected.tech])].map(tag => <span key={tag}>{tag}</span>)}</div>
        <div className="project-actions">{canEnter(selected) ? <a className="primary-button" href={selected.url}>{selected.status === 'shipped' ? 'Explore project' : 'Explore preview'}<Icon name="arrow" size={17} /></a> : <p className="development-note"><span className="tiny-diamond" /> Still taking shape. Come back to see it grow.</p>}{view === 'world' && <button className="focus-button" onClick={() => world.current?.focus(selected.id)} title="Look closer at this treasure" aria-label="Look closer at this treasure"><Icon name="focus" size={19} /></button>}</div>
      </aside>}

      {view === 'collection' && <div className="collection-intro"><p className="eyebrow">THE COMPLETE HOARD</p><h1>Small ideas. <em>Real treasures.</em></h1><p>Products, experiments, and useful things. Pick one to discover its story.</p>{sceneError && <div className="fallback-notice"><p role="status">{sceneFailureMessage(sceneError)} Every project is still here to explore.</p><button className="text-link" onClick={retryScene}>{sceneError.stage === 'download' ? 'Reload page' : 'Retry 3D world'}<Icon name="reset" size={15} /></button><details><summary>Error details</summary><p>{sceneError.stage}: {sceneError.detail}</p></details></div>}</div>}

      {help && <section className="help-panel" aria-label="Help and accessibility"><div><h2>A few ways to explore</h2><button className="icon-button" aria-label="Close help" onClick={() => setHelp(false)}><Icon name="close" /></button></div><p>Drag to orbit the vault. Scroll or pinch to zoom. Select a relic to open its story, or wake the dragon to see him stir.</p><p>The Collection view gives you the same projects with keyboard navigation. Press <kbd>/</kbd> to search and <kbd>Esc</kbd> to close details.</p><label><input type="checkbox" checked={reduced} onChange={event => setReduced(event.target.checked)} /> Reduce motion</label><button className="text-link" onClick={() => { browse(); setHelp(false); }}>Open collection <Icon name="arrow" /></button></section>}
    </main>

    <section id="collection" ref={collection} tabIndex={-1} className="collection-dock" aria-label="Treasure collection">
      <div className="collection-toolbar"><div className="collection-label"><Icon name="diamond" size={19} /><span>THE HOARD</span><span className="count-pill" aria-live="polite">{visible.length}</span></div><div className="filters" aria-label="Filter treasures">{filters.map(item => <button key={item.value} aria-pressed={filter === item.value} className={filter === item.value ? 'active' : ''} onClick={() => setFilter(item.value)}>{item.label}</button>)}</div><label className="search-box"><Icon name="search" size={16} /><input ref={search} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a treasure…" aria-label="Search projects" /><kbd>/</kbd></label></div>
      {loadError ? <div className="empty-state" role="alert"><h2>The catalog couldn’t be opened.</h2><p>{loadError}</p><button className="text-link" onClick={() => window.location.reload()}>Try again <Icon name="reset" /></button></div> : !projects.length ? <p className="empty-state" role="status">Gathering the collection…</p> : visible.length === 0 ? <div className="empty-state"><h2>No treasures match this search.</h2><button className="text-link" onClick={() => { setQuery(''); setFilter('all'); }}>Show all treasures <Icon name="arrow" /></button></div> : <div className="project-rail">{visible.map((project, index) => <button key={project.id} className={`project-card${selectedId === project.id ? ' selected' : ''}`} aria-pressed={selectedId === project.id} onClick={() => select(project.id)} style={{ '--project-accent': project.accent } as React.CSSProperties}><span className="card-image"><ProjectImage project={project} /></span><span className="card-copy"><span className="card-category">{categoryLabel(project.category)}<span className={project.status === 'shipped' ? 'status-dot released' : 'status-dot'} /></span><strong>{project.title}</strong><span className="card-type">{project.type}</span></span><span className="card-index">{String(index + 1).padStart(2, '0')}</span></button>)}</div>}
      <footer className="collection-footer"><span>A little curiosity goes a long way.</span><div>{view === 'world' && <><span className="arrange-label">ARRANGE</span><button className={arrangement === 'hoard' ? 'active' : ''} aria-pressed={arrangement === 'hoard'} onClick={() => setArrangement('hoard')}>Natural hoard</button><span className="footer-divider">/</span><button className={arrangement === 'gallery' ? 'active' : ''} aria-pressed={arrangement === 'gallery'} onClick={() => setArrangement('gallery')}>Gallery</button></>}<span className="footer-credit">CRAFTED BY ZACH MACKAY</span></div></footer>
    </section>
    {hover && view === 'world' && <div className="world-tooltip" style={{ left: Math.max(12, Math.min(hover.x + 16, window.innerWidth - 240)), top: Math.max(12, hover.y - 54) }}><Icon name={hover.id === 'dragon' ? 'dragon' : 'diamond'} size={16} /><span>{hover.id === 'dragon' ? 'Wake the keeper' : hoverProject?.title}</span></div>}
    <div className={`toast${message ? ' visible' : ''}`} role="status" aria-live="polite">{message}</div>
  </div>;
}
