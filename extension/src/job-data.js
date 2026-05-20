export function normalizeCapturedJob(input, now = new Date()) {
  const collectedAt = now.toISOString();
  const collectedDate = toLocalDateKey(now);
  const title = cleanText(input.title) || titleFromUrl(input.url) || 'Untitled job';
  const company = cleanText(input.company);
  const description = cleanText(input.description);
  const url = cleanText(input.url);

  return {
    id: `job-${collectedDate}-${randomSuffix()}`,
    title,
    company,
    description,
    url,
    collectedAt,
    collectedDate,
  };
}

export function groupJobsByDate(jobs) {
  const groups = new Map();
  for (const job of jobs) {
    const date = job.collectedDate || toLocalDateKey(new Date(job.collectedAt || Date.now()));
    groups.set(date, [...(groups.get(date) || []), job]);
  }

  return Array.from(groups.entries())
    .map(([date, items]) => ({
      date,
      jobs: sortJobsNewest(items),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function filterJobsByDates(jobs, dates) {
  const selectedDates = new Set(dates);
  return sortJobsNewest(jobs.filter((job) => selectedDates.has(job.collectedDate)));
}

export function toScoringTextExport(jobs) {
  return jobs.map(formatJobText).join('\n\n---\n\n');
}

export function toScoringJsonExport(jobs, now = new Date()) {
  return {
    source: 'ats-job-collector-extension',
    exportedAt: now.toISOString(),
    jobs: jobs.map((job) => ({
      id: job.id,
      title: cleanText(job.title) || 'Untitled job',
      text: formatJobText(job),
      source: 'Job Collector',
      url: cleanText(job.url),
      collectedAt: job.collectedAt,
    })),
  };
}

export function formatJobText(job) {
  const header = [cleanText(job.title) || 'Untitled job'];
  if (cleanText(job.company)) {
    header.push(`Company: ${cleanText(job.company)}`);
  }
  if (cleanText(job.url)) {
    header.push(`Link: ${cleanText(job.url)}`);
  }

  const description = cleanText(job.description);
  return description ? `${header.join('\n')}\n\n${description}` : header.join('\n');
}

export function toLocalDateKey(date) {
  const value = date instanceof Date ? date : new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sortJobsNewest(jobs) {
  return [...jobs].sort((a, b) => {
    const dateCompare = String(b.collectedAt || '').localeCompare(String(a.collectedAt || ''));
    return dateCompare || String(b.id || '').localeCompare(String(a.id || ''));
  });
}

function cleanText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleFromUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function randomSuffix() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}
