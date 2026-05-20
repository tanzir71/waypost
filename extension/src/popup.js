import {
  filterJobsByDates,
  groupJobsByDate,
  normalizeCapturedJob,
  toScoringJsonExport,
  toScoringTextExport,
} from './job-data.js';

const STORAGE_KEY = 'jobs';
let jobs = [];
let selectedDates = new Set();

const dom = {
  captureJob: document.querySelector('#captureJob'),
  clearJobs: document.querySelector('#clearJobs'),
  dateCount: document.querySelector('#dateCount'),
  dateGroups: document.querySelector('#dateGroups'),
  exportJson: document.querySelector('#exportJson'),
  exportText: document.querySelector('#exportText'),
  jobCount: document.querySelector('#jobCount'),
  selectAll: document.querySelector('#selectAll'),
  toast: document.querySelector('#toast'),
};

dom.captureJob.addEventListener('click', captureCurrentJob);
dom.clearJobs.addEventListener('click', clearJobs);
dom.dateGroups.addEventListener('change', handleDateSelection);
dom.dateGroups.addEventListener('click', handleDelete);
dom.exportText.addEventListener('click', () => exportSelected('txt'));
dom.exportJson.addEventListener('click', () => exportSelected('json'));
dom.selectAll.addEventListener('click', toggleSelectAll);

await loadJobs();
render();

async function captureCurrentJob() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    showToast('No active page found.');
    return;
  }

  let captured;
  try {
    captured = await chrome.tabs.sendMessage(tab.id, { type: 'ATS_COLLECT_JOB' });
  } catch {
    captured = {
      title: tab.title || 'Untitled job',
      company: '',
      description: '',
      url: tab.url || '',
    };
  }

  const job = normalizeCapturedJob(
    {
      ...captured,
      title: captured?.title || tab.title,
      url: captured?.url || tab.url,
    },
    new Date(),
  );

  if (!job.description || job.description.length < 80) {
    showToast('Captured the link, but this page exposed very little job text.');
  } else {
    showToast('Job captured.');
  }

  jobs = [job, ...jobs.filter((item) => item.url !== job.url)];
  selectedDates.add(job.collectedDate);
  await saveJobs();
  render();
}

async function clearJobs() {
  if (!jobs.length || !confirm('Clear all saved jobs from this browser?')) {
    return;
  }
  jobs = [];
  selectedDates = new Set();
  await saveJobs();
  render();
}

function handleDateSelection(event) {
  const checkbox = event.target.closest('[data-date]');
  if (!checkbox) {
    return;
  }
  if (checkbox.checked) {
    selectedDates.add(checkbox.dataset.date);
  } else {
    selectedDates.delete(checkbox.dataset.date);
  }
  renderExportState();
}

async function handleDelete(event) {
  const button = event.target.closest('[data-delete-job]');
  if (!button) {
    return;
  }
  jobs = jobs.filter((job) => job.id !== button.dataset.deleteJob);
  await saveJobs();
  render();
}

function toggleSelectAll() {
  const groups = groupJobsByDate(jobs);
  if (selectedDates.size === groups.length) {
    selectedDates = new Set();
  } else {
    selectedDates = new Set(groups.map((group) => group.date));
  }
  render();
}

function exportSelected(format) {
  const selectedJobs = filterJobsByDates(jobs, Array.from(selectedDates));
  if (!selectedJobs.length) {
    showToast('Select at least one date.');
    return;
  }

  const dates = Array.from(selectedDates).sort();
  const stem = dates.length === 1 ? dates[0] : `${dates[0]}-to-${dates[dates.length - 1]}`;
  if (format === 'json') {
    downloadBlob(
      new Blob([JSON.stringify(toScoringJsonExport(selectedJobs), null, 2)], { type: 'application/json' }),
      `ats-jobs-${stem}.json`,
    );
    return;
  }

  downloadBlob(new Blob([toScoringTextExport(selectedJobs)], { type: 'text/plain' }), `ats-jobs-${stem}.txt`);
}

function render() {
  const groups = groupJobsByDate(jobs);
  selectedDates = new Set(Array.from(selectedDates).filter((date) => groups.some((group) => group.date === date)));
  dom.jobCount.textContent = jobs.length;
  dom.dateCount.textContent = groups.length;
  dom.selectAll.textContent = selectedDates.size === groups.length && groups.length ? 'Clear dates' : 'Select all';

  if (!groups.length) {
    dom.dateGroups.innerHTML = '<div class="empty-state">Capture a job page to start a dated collection.</div>';
    renderExportState();
    return;
  }

  dom.dateGroups.innerHTML = groups
    .map(
      (group) => `
        <section class="date-group">
          <div class="date-head">
            <label class="date-check">
              <input type="checkbox" data-date="${group.date}" ${selectedDates.has(group.date) ? 'checked' : ''} />
              <span>${formatDate(group.date)}</span>
            </label>
            <span class="date-meta">${group.jobs.length} job${group.jobs.length === 1 ? '' : 's'}</span>
          </div>
          <div class="job-list">
            ${group.jobs.map(renderJob).join('')}
          </div>
        </section>
      `,
    )
    .join('');
  renderExportState();
}

function renderJob(job) {
  return `
    <article class="job-row">
      <div>
        <h3>${escapeHtml(job.title)}</h3>
        <span class="job-link">${escapeHtml(job.company || hostFromUrl(job.url))}</span>
      </div>
      <button class="delete-button" type="button" data-delete-job="${job.id}" aria-label="Delete ${escapeHtml(job.title)}">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </article>
  `;
}

function renderExportState() {
  const hasSelection = filterJobsByDates(jobs, Array.from(selectedDates)).length > 0;
  dom.exportText.disabled = !hasSelection;
  dom.exportJson.disabled = !hasSelection;
}

async function loadJobs() {
  const stored = await chrome.storage.local.get({ [STORAGE_KEY]: [] });
  jobs = Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : [];
}

async function saveJobs() {
  await chrome.storage.local.set({ [STORAGE_KEY]: jobs });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename, saveAs: true }, () => {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

function showToast(message) {
  dom.toast.textContent = message;
  dom.toast.classList.add('visible');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => dom.toast.classList.remove('visible'), 2400);
}

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`));
}

function hostFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Saved link';
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
