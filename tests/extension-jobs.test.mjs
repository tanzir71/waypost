import test from 'node:test';
import assert from 'node:assert/strict';

import {
  filterJobsByDates,
  groupJobsByDate,
  normalizeCapturedJob,
  toScoringJsonExport,
  toScoringTextExport,
} from '../extension/src/job-data.js';

test('normalizeCapturedJob creates a dated browser-local job record', () => {
  const job = normalizeCapturedJob(
    {
      title: ' Senior Product Designer ',
      company: ' Acme ',
      description: ' Design systems, research, prototyping. ',
      url: 'https://example.com/jobs/123?ref=feed',
    },
    new Date('2026-05-20T10:15:00'),
  );

  assert.equal(job.title, 'Senior Product Designer');
  assert.equal(job.company, 'Acme');
  assert.equal(job.description, 'Design systems, research, prototyping.');
  assert.equal(job.url, 'https://example.com/jobs/123?ref=feed');
  assert.equal(job.collectedDate, '2026-05-20');
  assert.match(job.id, /^job-2026-05-20-/);
});

test('groupJobsByDate sorts collection dates newest first', () => {
  const groups = groupJobsByDate([
    job('a', '2026-05-18'),
    job('b', '2026-05-20'),
    job('c', '2026-05-20'),
    job('d', '2026-05-19'),
  ]);

  assert.deepEqual(
    groups.map((group) => [group.date, group.jobs.map((item) => item.id)]),
    [
      ['2026-05-20', ['c', 'b']],
      ['2026-05-19', ['d']],
      ['2026-05-18', ['a']],
    ],
  );
});

test('filterJobsByDates preserves selected jobs newest first', () => {
  const filtered = filterJobsByDates(
    [job('a', '2026-05-18'), job('b', '2026-05-20'), job('c', '2026-05-19')],
    ['2026-05-18', '2026-05-20'],
  );

  assert.deepEqual(
    filtered.map((item) => item.id),
    ['b', 'a'],
  );
});

test('toScoringTextExport creates divider-separated descriptions', () => {
  const text = toScoringTextExport([
    {
      title: 'Frontend Engineer',
      company: 'Acme',
      url: 'https://example.com/frontend',
      description: 'React, TypeScript, testing.',
    },
    {
      title: 'Data Analyst',
      company: '',
      url: 'https://example.com/data',
      description: 'SQL, dashboards, metrics.',
    },
  ]);

  assert.equal(
    text,
    [
      'Frontend Engineer',
      'Company: Acme',
      'Link: https://example.com/frontend',
      '',
      'React, TypeScript, testing.',
      '',
      '---',
      '',
      'Data Analyst',
      'Link: https://example.com/data',
      '',
      'SQL, dashboards, metrics.',
    ].join('\n'),
  );
});

test('toScoringJsonExport creates jobs the scoring app can import', () => {
  const exported = toScoringJsonExport([job('a', '2026-05-20')], new Date('2026-05-21T08:00:00Z'));

  assert.equal(exported.source, 'ats-job-collector-extension');
  assert.equal(exported.exportedAt, '2026-05-21T08:00:00.000Z');
  assert.deepEqual(exported.jobs, [
    {
      id: 'a',
      title: 'Role a',
      text: 'Role a\nCompany: Company a\nLink: https://example.com/a\n\nDescription a',
      source: 'Job Collector',
      url: 'https://example.com/a',
      collectedAt: '2026-05-20T09:00:00.000Z',
    },
  ]);
});

function job(id, date) {
  return {
    id,
    title: `Role ${id}`,
    company: `Company ${id}`,
    url: `https://example.com/${id}`,
    description: `Description ${id}`,
    collectedAt: `${date}T09:00:00.000Z`,
    collectedDate: date,
  };
}
