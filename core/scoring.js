const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'build',
  'by',
  'for',
  'from',
  'in',
  'into',
  'is',
  'it',
  'of',
  'on',
  'or',
  'our',
  'that',
  'the',
  'their',
  'this',
  'to',
  'with',
  'work',
  'you',
  'your',
]);

const ATTRIBUTE_ALIASES = new Map([
  ['js', 'javascript'],
  ['ts', 'typescript'],
  ['ux', 'user experience'],
  ['ui', 'interface'],
  ['a11y', 'accessibility'],
  ['kpis', 'metrics'],
]);

const PHRASES = [
  'design systems',
  'user research',
  'stakeholder interviews',
  'stakeholder reporting',
  'launch planning',
  'project management',
  'product strategy',
  'data analysis',
  'machine learning',
  'customer discovery',
  'cross functional',
  'front end',
  'back end',
  'full stack',
];

export function bulkParseJobs(input) {
  return String(input)
    .split(/\n\s*(?:-{3,}|#{2,}|={3,})\s*\n/g)
    .map((block) => normalizeWhitespace(block))
    .filter(Boolean)
    .map((text, index) => {
      const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
      return {
        id: createId(`job-${index + 1}-${lines[0] || 'description'}`),
        title: lines[0] || `Job ${index + 1}`,
        text,
        source: 'pasted',
        createdAt: new Date().toISOString(),
      };
    });
}

export function parseImportedJobs(input, source = 'import') {
  const text = String(input || '').trim();
  if (!text) {
    return [];
  }

  const jsonJobs = parseJobJson(text, source);
  if (jsonJobs) {
    return jsonJobs;
  }

  return bulkParseJobs(text).map((job) => ({
    ...job,
    source,
  }));
}

export function extractAttributes(text) {
  const normalizedText = normalizeText(text);
  const attributes = new Set();

  for (const phrase of PHRASES) {
    if (normalizedText.includes(phrase)) {
      attributes.add(phrase);
    }
  }

  const words = normalizedText.match(/[a-z][a-z0-9+#.-]{1,}/g) || [];
  for (const word of words) {
    const clean = word.replace(/^[^a-z0-9]+|[^a-z0-9+#]+$/g, '');
    if (clean.length < 2 || STOP_WORDS.has(clean) || /^\d+$/.test(clean)) {
      continue;
    }
    attributes.add(ATTRIBUTE_ALIASES.get(clean) || clean);
  }

  return Array.from(attributes).sort();
}

function parseJobJson(text, source) {
  try {
    const parsed = JSON.parse(text);
    const jobs = Array.isArray(parsed) ? parsed : parsed.jobs;
    if (!Array.isArray(jobs)) {
      return null;
    }

    return jobs
      .map((job, index) => {
        const title = normalizeWhitespace(job.title || job.name || `Job ${index + 1}`);
        const body = normalizeWhitespace(job.text || job.description || job.body || '');
        const url = normalizeWhitespace(job.url || job.link || '');
        const company = normalizeWhitespace(job.company || '');
        const details = job.text ? body : formatImportedJobText({ title, company, url, body });

        if (!details) {
          return null;
        }

        return {
          id: job.id || createId(`job-${index + 1}-${title}`),
          title,
          text: details,
          source,
          url,
          collectedAt: job.collectedAt || job.createdAt || '',
        };
      })
      .filter(Boolean);
  } catch {
    return null;
  }
}

function formatImportedJobText({ title, company, url, body }) {
  const header = [title];
  if (company) {
    header.push(`Company: ${company}`);
  }
  if (url) {
    header.push(`Link: ${url}`);
  }
  return body ? `${header.join('\n')}\n\n${body}` : header.join('\n');
}

export function scoreResumeAgainstJob(resume, job) {
  const resumeAttributes = new Set(extractAttributes(resume.text));
  const jobAttributes = extractAttributes(job.text);
  const matchedAttributes = jobAttributes.filter((attribute) => resumeAttributes.has(attribute));
  const missingAttributes = jobAttributes.filter((attribute) => !resumeAttributes.has(attribute));
  const coverage = jobAttributes.length === 0 ? 0 : matchedAttributes.length / jobAttributes.length;
  const score = Math.round(Math.min(100, coverage * 100));

  return {
    resumeId: resume.id,
    resumeName: resume.name,
    jobId: job.id,
    jobTitle: job.title,
    score,
    matchedAttributes,
    missingAttributes,
  };
}

export function rankResumeMatches(resumes, jobs) {
  return jobs.map((job) => {
    const matches = resumes
      .map((resume) => scoreResumeAgainstJob(resume, job))
      .sort((a, b) => b.score - a.score || a.resumeName.localeCompare(b.resumeName));
    const best = matches[0] || null;

    return {
      jobId: job.id,
      jobTitle: job.title,
      bestResumeId: best?.resumeId || null,
      bestResumeName: best?.resumeName || null,
      bestScore: best?.score || 0,
      matches,
    };
  });
}

export function clusterJobs(jobs) {
  const clusters = [];

  for (const job of jobs) {
    const attributes = new Set(extractAttributes(job.text));
    let bestCluster = null;
    let bestSimilarity = 0;

    for (const cluster of clusters) {
      const similarity = jaccard(attributes, new Set(cluster.aggregateAttributes));
      if (similarity > bestSimilarity) {
        bestCluster = cluster;
        bestSimilarity = similarity;
      }
    }

    if (bestCluster && bestSimilarity >= 0.18) {
      bestCluster.jobs.push(job);
      for (const attribute of attributes) {
        bestCluster.attributeFrequency[attribute] = (bestCluster.attributeFrequency[attribute] || 0) + 1;
      }
      bestCluster.aggregateAttributes = sortAttributesByFrequency(bestCluster.attributeFrequency);
    } else {
      const attributeFrequency = {};
      for (const attribute of attributes) {
        attributeFrequency[attribute] = 1;
      }
      clusters.push({
        id: createId(`cluster-${job.title}-${clusters.length + 1}`),
        jobs: [job],
        attributeFrequency,
        aggregateAttributes: sortAttributesByFrequency(attributeFrequency),
      });
    }
  }

  return clusters.map((cluster) => ({
    id: cluster.id,
    title: summarizeClusterTitle(cluster.jobs),
    jobIds: cluster.jobs.map((job) => job.id),
    attributeFrequency: cluster.attributeFrequency,
    aggregateAttributes: cluster.aggregateAttributes,
  }));
}

export function suggestMissingAttributes(resume, cluster, limit = 8) {
  const resumeAttributes = new Set(extractAttributes(resume.text));
  const totalJobs = Math.max(1, cluster.jobIds?.length || 1);

  return Object.entries(cluster.attributeFrequency || {})
    .filter(([attribute]) => !resumeAttributes.has(attribute))
    .map(([attribute, count]) => ({
      attribute,
      count,
      prevalence: roundTo(count / totalJobs, 2),
      impact: Math.round((count / totalJobs) * 100),
    }))
    .sort((a, b) => b.prevalence - a.prevalence || a.attribute.localeCompare(b.attribute))
    .slice(0, limit);
}

export function createId(seed) {
  const slug = String(seed)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42);
  return `${slug || 'item'}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeWhitespace(value) {
  return String(value)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeText(value) {
  return String(value)
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9+#.\n -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function jaccard(left, right) {
  const union = new Set([...left, ...right]);
  if (union.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const value of left) {
    if (right.has(value)) {
      intersection += 1;
    }
  }
  return intersection / union.size;
}

function sortAttributesByFrequency(attributeFrequency) {
  return Object.entries(attributeFrequency)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([attribute]) => attribute);
}

function summarizeClusterTitle(jobs) {
  if (jobs.length === 1) {
    return jobs[0].title;
  }
  const words = jobs
    .flatMap((job) => extractAttributes(job.title))
    .filter((word) => !STOP_WORDS.has(word));
  const counts = {};
  for (const word of words) {
    counts[word] = (counts[word] || 0) + 1;
  }
  const top = Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 2)
    .map(([word]) => word);
  return top.length > 0 ? titleCase(top.join(' / ')) : 'Related jobs';
}

function titleCase(value) {
  return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function roundTo(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
