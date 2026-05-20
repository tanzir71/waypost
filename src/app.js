import {
  clusterJobs,
  createId,
  parseImportedJobs,
  rankResumeMatches,
  suggestMissingAttributes,
} from './scoring.js';

const STORAGE_KEY = 'ats-scoring:v1';

const initialState = {
  resumes: [],
  jobs: [],
  results: [],
  clusters: [],
  selectedJobId: null,
  lastRunAt: null,
};

let state = loadState();

const dom = {
  resumeForm: document.querySelector('#resumeForm'),
  resumeName: document.querySelector('#resumeName'),
  resumeFile: document.querySelector('#resumeFile'),
  resumeText: document.querySelector('#resumeText'),
  resumeList: document.querySelector('#resumeList'),
  resumeCount: document.querySelector('#resumeCount'),
  jobForm: document.querySelector('#jobForm'),
  jobFiles: document.querySelector('#jobFiles'),
  jobText: document.querySelector('#jobText'),
  jobList: document.querySelector('#jobList'),
  jobCount: document.querySelector('#jobCount'),
  runMatches: document.querySelector('#runMatches'),
  runSummary: document.querySelector('#runSummary'),
  rankedResults: document.querySelector('#rankedResults'),
  missingAttributes: document.querySelector('#missingAttributes'),
  resultCount: document.querySelector('#resultCount'),
  clusterCount: document.querySelector('#clusterCount'),
  clearData: document.querySelector('#clearData'),
  exportData: document.querySelector('#exportData'),
  importData: document.querySelector('#importData'),
  toast: document.querySelector('#toast'),
};

dom.resumeForm.addEventListener('submit', handleResumeSubmit);
dom.jobForm.addEventListener('submit', handleJobSubmit);
dom.runMatches.addEventListener('click', runMatches);
dom.resumeList.addEventListener('click', handleListAction);
dom.jobList.addEventListener('click', handleListAction);
dom.rankedResults.addEventListener('click', handleResultSelect);
dom.clearData.addEventListener('click', clearWorkspace);
dom.exportData.addEventListener('click', exportWorkspace);
dom.importData.addEventListener('change', importWorkspace);

render();

async function handleResumeSubmit(event) {
  event.preventDefault();
  const files = Array.from(dom.resumeFile.files || []);
  const pastedText = dom.resumeText.value.trim();
  const versionName = dom.resumeName.value.trim();
  const nextResumes = [];

  for (const file of files) {
    const text = await readUsefulText(file);
    if (!text) {
      continue;
    }
    nextResumes.push({
      id: createId(`resume-${file.name}`),
      name: files.length === 1 && versionName ? versionName : stripExtension(file.name),
      text,
      source: file.name,
      createdAt: new Date().toISOString(),
    });
  }

  if (pastedText) {
    nextResumes.push({
      id: createId(`resume-${versionName || 'pasted'}`),
      name: versionName || `Resume ${state.resumes.length + nextResumes.length + 1}`,
      text: pastedText,
      source: 'pasted',
      createdAt: new Date().toISOString(),
    });
  }

  if (nextResumes.length === 0) {
    showToast('Add a text resume or upload a readable file.');
    return;
  }

  state.resumes = [...state.resumes, ...nextResumes];
  resetRun();
  dom.resumeForm.reset();
  persistAndRender();
  showToast(`${nextResumes.length} resume version${nextResumes.length === 1 ? '' : 's'} added.`);
}

async function handleJobSubmit(event) {
  event.preventDefault();
  const files = Array.from(dom.jobFiles.files || []);
  const pastedText = dom.jobText.value.trim();
  const nextJobs = [];

  if (pastedText) {
    nextJobs.push(...parseImportedJobs(pastedText, 'pasted'));
  }

  for (const file of files) {
    const text = await readUsefulText(file);
    if (!text) {
      continue;
    }
    const parsed = parseImportedJobs(text, file.name);
    nextJobs.push(
      ...parsed.map((job, index) => ({
        ...job,
        id: job.id || createId(`job-${file.name}-${index}`),
        title: job.title || stripExtension(file.name),
        source: job.source || file.name,
      })),
    );
  }

  if (nextJobs.length === 0) {
    showToast('Add job text or upload readable job files.');
    return;
  }

  state.jobs = [...state.jobs, ...nextJobs];
  resetRun();
  dom.jobForm.reset();
  persistAndRender();
  showToast(`${nextJobs.length} job description${nextJobs.length === 1 ? '' : 's'} imported.`);
}

function runMatches() {
  if (state.resumes.length === 0 || state.jobs.length === 0) {
    showToast('Add at least one resume and one job.');
    return;
  }

  state.results = rankResumeMatches(state.resumes, state.jobs).sort(
    (a, b) => b.bestScore - a.bestScore || a.jobTitle.localeCompare(b.jobTitle),
  );
  state.clusters = clusterJobs(state.jobs);
  state.selectedJobId = state.results[0]?.jobId || null;
  state.lastRunAt = new Date().toISOString();
  persistAndRender();
  showToast('Match run complete.');
}

function handleListAction(event) {
  const button = event.target.closest('[data-action]');
  if (!button) {
    return;
  }

  const action = button.dataset.action;
  const id = button.dataset.id;
  if (action === 'delete-resume') {
    state.resumes = state.resumes.filter((resume) => resume.id !== id);
  }
  if (action === 'delete-job') {
    state.jobs = state.jobs.filter((job) => job.id !== id);
  }
  resetRun();
  persistAndRender();
}

function handleResultSelect(event) {
  const row = event.target.closest('[data-job-id]');
  if (!row) {
    return;
  }
  state.selectedJobId = row.dataset.jobId;
  persistAndRender();
}

function clearWorkspace() {
  if (!state.resumes.length && !state.jobs.length) {
    return;
  }
  const confirmed = window.confirm('Clear local resumes, jobs, and results?');
  if (!confirmed) {
    return;
  }
  state = { ...initialState };
  persistAndRender();
}

function exportWorkspace() {
  const payload = JSON.stringify(state, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ats-scoring-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importWorkspace(event) {
  const [file] = Array.from(event.target.files || []);
  if (!file) {
    return;
  }

  try {
    const imported = JSON.parse(await file.text());
    state = {
      ...initialState,
      resumes: Array.isArray(imported.resumes) ? imported.resumes : [],
      jobs: Array.isArray(imported.jobs) ? imported.jobs : [],
      results: Array.isArray(imported.results) ? imported.results : [],
      clusters: Array.isArray(imported.clusters) ? imported.clusters : [],
      selectedJobId: imported.selectedJobId || null,
      lastRunAt: imported.lastRunAt || null,
    };
    persistAndRender();
    showToast('Workspace imported.');
  } catch {
    showToast('Import failed. Choose an exported JSON file.');
  } finally {
    dom.importData.value = '';
  }
}

function render() {
  dom.resumeCount.textContent = state.resumes.length;
  dom.jobCount.textContent = state.jobs.length;
  dom.resultCount.textContent = state.results.length;
  dom.clusterCount.textContent = state.clusters.length;
  dom.resumeList.innerHTML = renderItems(state.resumes, 'resume');
  dom.jobList.innerHTML = renderItems(state.jobs, 'job');
  dom.runSummary.textContent = renderRunSummary();
  dom.rankedResults.innerHTML = renderResults();
  dom.rankedResults.classList.toggle('empty-state', state.results.length === 0);
  dom.missingAttributes.innerHTML = renderMissingAttributes();
  dom.missingAttributes.classList.toggle('empty-state', state.results.length === 0);
}

function renderItems(items, type) {
  if (items.length === 0) {
    return `<div class="empty-row">No ${type === 'resume' ? 'resume versions' : 'job descriptions'} yet.</div>`;
  }

  return items
    .map(
      (item) => `
        <article class="list-row">
          <div>
            <strong>${escapeHtml(item.name || item.title)}</strong>
            <span>${escapeHtml(item.source || 'pasted')} · ${countWords(item.text)} words</span>
          </div>
          <button class="row-icon" type="button" data-action="delete-${type}" data-id="${item.id}" aria-label="Delete ${escapeHtml(
        item.name || item.title,
      )}">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </article>
      `,
    )
    .join('');
}

function renderResults() {
  if (state.results.length === 0) {
    return 'Add resumes and jobs, then run matches.';
  }

  return state.results
    .map((result) => {
      const selected = result.jobId === state.selectedJobId ? ' selected' : '';
      const matchRows = result.matches
        .map(
          (match) => `
            <div class="match-score">
              <span>${escapeHtml(match.resumeName)}</span>
              <div class="score-track" aria-label="${match.score} percent">
                <span style="width:${match.score}%"></span>
              </div>
              <strong>${match.score}</strong>
            </div>
          `,
        )
        .join('');
      const missingPreview = result.matches[0]?.missingAttributes.slice(0, 5) || [];

      return `
        <article class="result-row${selected}" data-job-id="${result.jobId}" tabindex="0">
          <div class="result-main">
            <div class="score-badge">${result.bestScore}</div>
            <div>
              <h3>${escapeHtml(result.jobTitle)}</h3>
              <p>Best: ${escapeHtml(result.bestResumeName || 'No resume')}</p>
            </div>
          </div>
          <div class="mini-tags">
            ${missingPreview.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}
          </div>
          <div class="match-list">
            ${matchRows}
          </div>
        </article>
      `;
    })
    .join('');
}

function renderMissingAttributes() {
  if (state.results.length === 0) {
    return 'Cluster suggestions appear after a run.';
  }

  const selectedResult = state.results.find((result) => result.jobId === state.selectedJobId) || state.results[0];
  const selectedMatch = selectedResult?.matches[0];
  const resume = state.resumes.find((item) => item.id === selectedMatch?.resumeId);
  const cluster = state.clusters.find((item) => item.jobIds.includes(selectedResult.jobId));
  const jobMissing = selectedMatch?.missingAttributes.slice(0, 8) || [];
  const clusterSuggestions = resume && cluster ? suggestMissingAttributes(resume, cluster, 8) : [];

  return `
    <div class="insight-summary">
      <span>${escapeHtml(selectedResult.jobTitle)}</span>
      <strong>${escapeHtml(selectedMatch?.resumeName || 'No resume')}</strong>
    </div>
    <div class="attribute-block">
      <h3>Job gaps</h3>
      <div class="attribute-list">
        ${jobMissing.length ? jobMissing.map((item) => `<span>${escapeHtml(item)}</span>`).join('') : '<em>No direct gaps.</em>'}
      </div>
    </div>
    <div class="attribute-block">
      <h3>Cluster boosts</h3>
      <div class="boost-list">
        ${
          clusterSuggestions.length
            ? clusterSuggestions
                .map(
                  (item) => `
                    <div class="boost-row">
                      <span>${escapeHtml(item.attribute)}</span>
                      <strong>${Math.round(item.prevalence * 100)}%</strong>
                    </div>
                  `,
                )
                .join('')
            : '<em>No cluster gaps for this resume.</em>'
        }
      </div>
    </div>
  `;
}

function renderRunSummary() {
  if (!state.lastRunAt) {
    return 'No run yet';
  }
  const time = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  }).format(new Date(state.lastRunAt));
  return `${state.resumes.length} resumes · ${state.jobs.length} jobs · ${time}`;
}

function resetRun() {
  state.results = [];
  state.clusters = [];
  state.selectedJobId = null;
  state.lastRunAt = null;
}

function persistAndRender() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      ...initialState,
      ...stored,
      resumes: Array.isArray(stored?.resumes) ? stored.resumes : [],
      jobs: Array.isArray(stored?.jobs) ? stored.jobs : [],
      results: Array.isArray(stored?.results) ? stored.results : [],
      clusters: Array.isArray(stored?.clusters) ? stored.clusters : [],
    };
  } catch {
    return { ...initialState };
  }
}

async function readUsefulText(file) {
  const extension = getExtension(file.name);
  if (extension === 'pdf') {
    return readPdfText(file);
  }
  if (extension === 'docx') {
    return readDocxText(file);
  }
  if (extension === 'doc') {
    showToast(`${file.name} is an older Word format. Save as DOCX or paste the text.`);
    return '';
  }

  const text = await file.text();
  const clean = text.replace(/\u0000/g, ' ').trim();
  if (!clean || clean.length < 30) {
    showToast(`${file.name} did not contain readable text. Paste the content instead.`);
    return '';
  }
  return clean;
}

async function readPdfText(file) {
  try {
    const pdfjs = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str).join(' '));
    }

    const text = pages.join('\n').trim();
    if (text.length < 30) {
      showToast(`${file.name} did not contain extractable PDF text.`);
      return '';
    }
    return text;
  } catch {
    showToast(`Could not parse ${file.name} locally. Paste the text instead.`);
    return '';
  }
}

async function readDocxText(file) {
  if (!window.mammoth?.extractRawText) {
    showToast('DOCX parser is unavailable. Paste the text instead.');
    return '';
  }

  try {
    const result = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    const text = String(result.value || '').trim();
    if (text.length < 30) {
      showToast(`${file.name} did not contain extractable DOCX text.`);
      return '';
    }
    return text;
  } catch {
    showToast(`Could not parse ${file.name} locally. Paste the text instead.`);
    return '';
  }
}

function showToast(message) {
  dom.toast.textContent = message;
  dom.toast.classList.add('visible');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    dom.toast.classList.remove('visible');
  }, 2600);
}

function stripExtension(name) {
  return name.replace(/\.[^.]+$/, '');
}

function getExtension(name) {
  return String(name).split('.').pop().toLowerCase();
}

function countWords(text) {
  return (String(text).match(/\b[\w+#.-]+\b/g) || []).length;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
