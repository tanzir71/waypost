import test from 'node:test';
import assert from 'node:assert/strict';

import {
  bulkParseJobs,
  clusterJobs,
  parseImportedJobs,
  rankResumeMatches,
  suggestMissingAttributes,
} from '../src/scoring.js';

test('bulkParseJobs splits pasted descriptions separated by dividers', () => {
  const input = `
Frontend Engineer
React, TypeScript, accessibility, and testing.

---

Data Analyst
SQL, dashboards, stakeholder reporting, and experimentation.
`;

  assert.deepEqual(
    bulkParseJobs(input).map((job) => ({
      title: job.title,
      text: job.text,
    })),
    [
      {
        title: 'Frontend Engineer',
        text: 'Frontend Engineer\nReact, TypeScript, accessibility, and testing.',
      },
      {
        title: 'Data Analyst',
        text: 'Data Analyst\nSQL, dashboards, stakeholder reporting, and experimentation.',
      },
    ],
  );
});

test('parseImportedJobs imports extension JSON job exports', () => {
  const imported = parseImportedJobs(
    JSON.stringify({
      source: 'ats-job-collector-extension',
      jobs: [
        {
          title: 'Frontend Engineer',
          text: 'Frontend Engineer\nLink: https://example.com/job\n\nReact and TypeScript.',
          url: 'https://example.com/job',
          collectedAt: '2026-05-20T09:00:00.000Z',
        },
      ],
    }),
    'extension-export.json',
  );

  assert.equal(imported.length, 1);
  assert.equal(imported[0].title, 'Frontend Engineer');
  assert.equal(imported[0].text, 'Frontend Engineer\nLink: https://example.com/job\n\nReact and TypeScript.');
  assert.equal(imported[0].source, 'extension-export.json');
  assert.equal(imported[0].url, 'https://example.com/job');
});

test('rankResumeMatches sorts the strongest resume version first for each job', () => {
  const resumes = [
    {
      id: 'resume-product',
      name: 'Product Resume',
      text: 'Roadmaps, discovery, stakeholder interviews, prioritization, launch planning.',
    },
    {
      id: 'resume-frontend',
      name: 'Frontend Resume',
      text: 'React TypeScript accessibility testing design systems performance.',
    },
  ];
  const jobs = [
    {
      id: 'job-frontend',
      title: 'Frontend Engineer',
      text: 'Frontend Engineer. Build React and TypeScript interfaces with accessibility and testing.',
    },
  ];

  const [jobResult] = rankResumeMatches(resumes, jobs);

  assert.equal(jobResult.bestResumeId, 'resume-frontend');
  assert.equal(jobResult.matches[0].resumeName, 'Frontend Resume');
  assert.ok(jobResult.matches[0].score > jobResult.matches[1].score);
  assert.ok(jobResult.matches[0].matchedAttributes.includes('react'));
  assert.ok(jobResult.matches[0].missingAttributes.includes('interfaces'));
});

test('clusterJobs groups jobs by overlapping attributes and exposes aggregate terms', () => {
  const jobs = [
    {
      id: 'frontend-1',
      title: 'Frontend Engineer',
      text: 'React TypeScript accessibility testing design systems.',
    },
    {
      id: 'frontend-2',
      title: 'UI Engineer',
      text: 'React components TypeScript accessibility performance.',
    },
    {
      id: 'data-1',
      title: 'Data Analyst',
      text: 'SQL dashboards experimentation reporting metrics.',
    },
  ];

  const clusters = clusterJobs(jobs);
  const frontendCluster = clusters.find((cluster) => cluster.jobIds.includes('frontend-1'));

  assert.ok(frontendCluster);
  assert.ok(frontendCluster.jobIds.includes('frontend-2'));
  assert.ok(frontendCluster.aggregateAttributes.includes('react'));
  assert.ok(frontendCluster.aggregateAttributes.includes('typescript'));
});

test('suggestMissingAttributes ranks cluster attributes missing from a resume', () => {
  const resume = {
    id: 'resume-frontend',
    name: 'Frontend Resume',
    text: 'React TypeScript components performance.',
  };
  const cluster = {
    id: 'cluster-frontend',
    title: 'Frontend/UI',
    jobIds: ['job-a', 'job-b', 'job-c'],
    attributeFrequency: {
      react: 3,
      typescript: 3,
      accessibility: 3,
      testing: 2,
      performance: 1,
    },
    aggregateAttributes: ['react', 'typescript', 'accessibility', 'testing', 'performance'],
  };

  assert.deepEqual(
    suggestMissingAttributes(resume, cluster).map((item) => ({
      attribute: item.attribute,
      prevalence: item.prevalence,
    })),
    [
      { attribute: 'accessibility', prevalence: 1 },
      { attribute: 'testing', prevalence: 0.67 },
    ],
  );
});
