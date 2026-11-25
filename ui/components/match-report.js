import { summarizeReport } from '../../core/match/index.js';
export const titleCase = value => String(value).replace(/^./,letter=>letter.toUpperCase());
export function tierBadge(tier) {
  const span=document.createElement('span');
  span.className=`tier-badge tier-${tier}`;
  span.textContent=titleCase(tier);
  return span;
}
export function requirementRow(row,basePath) {
  const article=document.createElement('article');
  article.className='requirement-row';
  article.dataset.testid='requirement-row';
  article.dataset.status=row.status;
  const indicator=document.createElement('span');
  indicator.className=`requirement-indicator status-${row.status}`;
  indicator.setAttribute('aria-label',titleCase(row.status));
  const image=document.createElement('img');
  image.src=`${basePath}assets/icons/${row.status==='met'?'check':row.status==='partial'?'alert':'x'}.svg`;
  image.width=14; image.height=14; image.alt=''; image.setAttribute('aria-hidden','true');
  indicator.append(image);
  const body=document.createElement('div');
  body.className='requirement-body';
  const requirement=document.createElement('p');
  requirement.textContent=row.text;
  const evidence=document.createElement('p');
  evidence.className='evidence';
  evidence.textContent=row.evidence ? `“${row.evidence.line}” — ${titleCase(row.evidence.section.toLowerCase())}, line ${row.evidence.lineIndex}` : row.note;
  body.append(requirement,evidence);
  if(row.status==='partial' && row.evidence) {
    const note=document.createElement('p');note.className='evidence';note.textContent=row.note;body.append(note);
  }
  const kind=document.createElement('span');kind.className='kind-tag';kind.textContent=titleCase(row.kind);
  article.append(indicator,body,kind);
  return article;
}
export function renderMatchReport(container,report,basePath,{preview=false}={}) {
  const summary=document.createElement('div');summary.className='match-summary';
  const counts=summarizeReport(report);
  const text=document.createElement('p');text.className='muted';text.textContent=`${counts.met} of ${counts.total} met · ${counts.partial} partial · ${counts.missing} missing`;
  summary.append(tierBadge(report.tier),text);
  const rows=document.createElement('div');rows.className='requirement-list';
  const all=[...report.required,...report.preferred];
  const shown=preview ? [all.find(row=>row.status==='met'),all.find(row=>row.status==='partial'),all.find(row=>row.status==='missing')].filter(Boolean) : all;
  shown.forEach(row=>rows.append(requirementRow(row,basePath)));
  container.replaceChildren(summary,rows);
}
