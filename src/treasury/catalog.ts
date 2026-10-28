export interface Project {
  id: string;
  title: string;
  type: string;
  status: string;
  previewAvailable?: boolean;
  featured?: boolean;
  campaignOrder?: number;
  image: string;
  url: string;
  accent: string;
  blurb: string;
  category: string;
  platforms: string[];
  tech: string[];
  tags: string[];
}

export interface CatalogAPI {
  load: () => Promise<Project[]>;
  canEnter: (project: Project) => boolean;
  resolveUrl: (path: string) => string;
}

declare global {
  interface Window { ProjectCatalog?: CatalogAPI }
}

// The shared MainWebsite loader owns data, ordering, URL resolution and entry rules.
// There is deliberately no embedded or generated fallback project catalog.
export async function loadProjects(): Promise<Project[]> {
  if (!window.ProjectCatalog) throw new Error('The shared project catalog is unavailable. Please try again.');
  const projects = await window.ProjectCatalog.load();
  if (new Set(projects.map(p => p.id)).size !== projects.length) throw new Error('The project catalog contains duplicate IDs.');
  return projects;
}

export const categoryLabel = (category: string) => ({ product: 'Product', experiment: 'Experiment', infrastructure: 'Infrastructure' })[category] || category;
export const statusLabel = (project: Project) => project.status === 'shipped' ? 'Released' : project.previewAvailable ? 'Preview available' : 'In the making';
export const canEnter = (project: Project) => window.ProjectCatalog?.canEnter(project) ?? false;
export const siteUrl = (path: string) => window.ProjectCatalog?.resolveUrl(path) || new URL(`../../${path.replace(/^\//, '')}`, window.location.href).href;

export function filterProjects(projects: Project[], filter: string, query: string): Project[] {
  const term = query.trim().toLocaleLowerCase();
  return projects.filter(project => {
    const matches = filter === 'all' || (filter === 'featured' ? project.featured : filter === 'shipped' ? project.status === 'shipped' : project.category === filter);
    return matches && (!term || [project.title, project.type, project.blurb, ...project.tags, ...project.platforms, ...project.tech].join(' ').toLocaleLowerCase().includes(term));
  });
}

export function hashId(id: string): number {
  let hash = 2166136261;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}
