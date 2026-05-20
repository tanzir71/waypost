chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'ATS_COLLECT_JOB') {
    return false;
  }

  sendResponse(captureJobFromPage());
  return false;
});

function captureJobFromPage() {
  return {
    title: findTitle(),
    company: findCompany(),
    description: findDescription(),
    url: location.href,
  };
}

function findTitle() {
  return (
    textFrom('h1') ||
    metaContent('meta[property="og:title"]') ||
    document.title.replace(/\s*[-|]\s*(LinkedIn|Indeed|Glassdoor|Greenhouse|Lever|Workday).*$/i, '')
  );
}

function findCompany() {
  const selectors = [
    '[data-testid*="company" i]',
    '[class*="company" i]',
    '[aria-label*="company" i]',
    'a[href*="/company"]',
    'a[href*="/companies"]',
  ];
  for (const selector of selectors) {
    const value = textFrom(selector);
    if (value && value.length < 120) {
      return value;
    }
  }
  return metaContent('meta[property="og:site_name"]');
}

function findDescription() {
  const selectors = [
    '[data-testid*="jobDescription" i]',
    '[data-testid*="description" i]',
    '[id*="jobDescription" i]',
    '[class*="job-description" i]',
    '[class*="jobDescription" i]',
    '[class*="description" i]',
    'article',
    'main',
  ];
  const candidates = selectors
    .map((selector) => textFrom(selector))
    .filter((value) => value.length > 120)
    .sort((a, b) => b.length - a.length);

  return (candidates[0] || cleanText(document.body?.innerText || '')).slice(0, 70000);
}

function textFrom(selector) {
  const element = document.querySelector(selector);
  return cleanText(element?.innerText || element?.textContent || '');
}

function metaContent(selector) {
  return cleanText(document.querySelector(selector)?.getAttribute('content') || '');
}

function cleanText(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
