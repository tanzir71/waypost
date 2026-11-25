import { readFile } from 'node:fs/promises';
import { routes, routePath } from '../core/routes.js';
export const root = new URL('../', import.meta.url);
export async function renderRoutes() {
  const shell = await readFile(new URL('app/_shell.html', root), 'utf8');
  return routes.map(route => {
    const prefix = route.id === 'today' ? '../' : '../../';
    let group;
    const navigation = routes.filter(item => item.group).map(item => {
      const heading = group !== item.group ? `<p class="nav-group">${item.group}</p>` : '';
      group = item.group;
      return `${heading}<a class="nav-item" href="${prefix}${routePath(item)}" aria-label="Open ${item.label}" data-testid="nav-${item.id}"${route.id === item.id ? ' aria-current="page"' : ''}><img src="${prefix}assets/icons/${item.icon}.svg" width="18" height="18" alt="" aria-hidden="true"><span>${item.label}</span></a>`;
    }).join('\n');
    const values = { root: prefix, route: route.id, title: `${route.label} — Waypost`, label: route.label, description: route.description, navigation,
      jsonld: JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebApplication', name: `${route.label} — Waypost`, description: route.description, isAccessibleForFree: true, applicationCategory: 'EducationalApplication' }) };
    return { path: `${routePath(route)}index.html`, html: shell.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key]) };
  });
}
