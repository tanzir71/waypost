(() => {
  if(globalThis.__waypostCaptureInstalled)return;
  globalThis.__waypostCaptureInstalled=true;
  let chip;
  chrome.runtime.onMessage.addListener((message,sender,respond)=>{
    if(sender.id!==chrome.runtime.id)return false;
    try {
      if(message.type==='WAYPOST_CAPTURE_JOB')respond(capture());
      else if(message.type==='WAYPOST_SHOW_CHIP'){show(message);respond({shown:true});}
      else if(message.type==='WAYPOST_HIDE_CHIP'){chip?.remove();chip=null;respond({shown:false});}
    }catch(error){respond({error:error.message});}
    return false;
  });
  const clean=value=>String(value??'').replace(/\u00a0/g,' ').replace(/\r\n?/g,'\n').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
  const text=selector=>clean(document.querySelector(selector)?.innerText??document.querySelector(selector)?.textContent);
  function capture() {
    // No logged-in LinkedIn scraping. The app accepts text pasted by the user.
    if(/(^|\.)linkedin\.com$/i.test(location.hostname))throw new Error('Paste this job description into Waypost. This clipper does not scrape LinkedIn pages.');
    let posting;
    function find(value){if(Array.isArray(value)){for(const item of value){const found=find(item);if(found)return found;}}else if(value&&typeof value==='object'){if([value['@type']].flat().includes('JobPosting'))return value;if(value['@graph'])return find(value['@graph']);}return null;}
    for(const script of document.querySelectorAll('script[type="application/ld+json"]'))try{posting=find(JSON.parse(script.textContent));if(posting)break;}catch{/* A broken JSON-LD block does not prevent visible-text capture. */}
    let description='';
    if(typeof posting?.description==='string') {
      const parsed=new DOMParser().parseFromString(posting.description,'text/html');
      parsed.querySelectorAll('script,style,noscript').forEach(node=>node.remove());
      parsed.querySelectorAll('li').forEach(node=>node.prepend('• '));
      parsed.querySelectorAll('p,div,li,h1,h2,h3,br').forEach(node=>node.append('\n'));
      description=clean(parsed.body.textContent);
    }
    if(!description) {
      for(const selector of ['[data-testid*="jobDescription" i]','#jobDescriptionText','[id*="jobDescription" i]','[class*="job-description" i]','[class*="jobDescription" i]','article','main']) {
        const candidate=text(selector);if(candidate.length>120){description=candidate;break;}
      }
    }
    if(!description)description=clean(document.body?.innerText??'');
    const title=clean(posting?.title)||text('h1')||clean(document.title);
    const company=clean(posting?.hiringOrganization?.name)||text('[data-testid*="company" i]')||text('[class*="company" i]')||'';
    const host=location.hostname.toLowerCase();
    const layout=host.includes('greenhouse')?'Greenhouse':host.includes('lever')?'Lever':host.includes('workday')?'Workday':posting?'JobPosting':'Generic page';
    if(description.length>100000)throw new Error('This page contains too much text. Paste the relevant job description into Waypost.');
    return {title:title.slice(0,500),company:company.slice(0,500),description,url:location.href,layout};
  }
  function show(message) {
    const destination=new URL(message.url);if(!['http:','https:'].includes(destination.protocol))throw new Error('Invalid Waypost destination.');
    const tier=['strong','good','partial','limited'].includes(message.tier)?message.tier:null;
    chip?.remove();chip=document.createElement('div');chip.setAttribute('data-waypost-chip','');
    const root=chip.attachShadow({mode:'closed'}),style=document.createElement('style');
    style.textContent=':host{all:initial;position:fixed;right:24px;bottom:24px;z-index:2147483647}a{display:flex;gap:10px;align-items:center;padding:12px 16px;border:0;border-radius:10px;background:#F5F4F0;color:#131316;font:500 13px/16px system-ui,sans-serif;text-decoration:none;font-style:normal}a:focus-visible{outline:2px solid #3049E8;outline-offset:2px}span{color:#55555E}@media(prefers-color-scheme:dark){a{background:#1B1B1F;color:#F3F2EE}span{color:#A5A5AD}}';
    const link=document.createElement('a');link.href=destination.href;link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('data-testid','waypost-page-chip');link.setAttribute('aria-label','Send this job to Waypost for review');
    const brand=document.createElement('strong');brand.textContent='Waypost';const summary=document.createElement('span');summary.textContent=tier?`${tier[0].toUpperCase()+tier.slice(1)} · Send job`:'Send job';link.append(brand,summary);root.append(style,link);document.documentElement.append(chip);
  }
})();
