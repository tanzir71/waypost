import {analyzeText,readPdfLayout,jsonResumeFromText} from '../core/parse/index.js';
let mammothLoading;
async function loadMammoth(basePath) {
  if(globalThis.mammoth) return globalThis.mammoth;
  mammothLoading??=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=`${basePath}vendor/mammoth/mammoth.browser.min.js`;
    script.onload=()=>resolve(globalThis.mammoth);script.onerror=()=>{mammothLoading=null;reject(new Error('The local DOCX parser could not be loaded.'));};
    document.head.append(script);
  });
  return mammothLoading;
}
export async function readResumeFile(file,{basePath=globalThis.window?.WAYPOST_CONFIG?.basePath??'/',pdfLoader=()=>import('../vendor/pdfjs/build/pdf.min.mjs'),docxLoader=()=>loadMammoth(basePath)}={}) {
  if(file.size>20*1024*1024) throw new Error('Use a resume smaller than 20 MB.');
  const extension=file.name.split('.').at(-1).toLowerCase();
  let text,metadata={},jsonResume;
  if(extension==='pdf') {
    const pdfjs=await pdfLoader();
    pdfjs.GlobalWorkerOptions.workerSrc=`${basePath}vendor/pdfjs/build/pdf.worker.min.mjs`;
    const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),cMapUrl:`${basePath}vendor/pdfjs/cmaps/`,cMapPacked:true,standardFontDataUrl:`${basePath}vendor/pdfjs/standard_fonts/`,wasmUrl:`${basePath}vendor/pdfjs/wasm/`,iccUrl:`${basePath}vendor/pdfjs/iccs/`,isEvalSupported:false,enableXfa:false,useSystemFonts:false});
    try {
      const doc=await task.promise;
      if(doc.numPages>30) throw new Error('Use a resume with at most 30 pages.');
      const pages=[],fonts=[];
      for(let number=1;number<=doc.numPages;number++) {
        const page=await doc.getPage(number),viewport=page.getViewport({scale:1});
        const content=await page.getTextContent();
        pages.push({items:content.items,width:viewport.width,height:viewport.height});
        // PDF.js exposes text/font styles, but not every font's Unicode map.
        for(const [name,style] of Object.entries(content.styles??{})) fonts.push({name,family:style.fontFamily,embedded:null});
        page.cleanup();
      }
      metadata={...readPdfLayout(pages),fonts,format:'pdf'};text=metadata.text;
    } finally {await task.destroy();}
  } else if(extension==='docx') {
    const mammoth=await docxLoader();
    const result=await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});
    text=result.value;metadata={format:'docx',parserWarnings:result.messages?.map(message=>message.message)??[]};
  } else if(extension==='txt') {
    text=await file.text();metadata={format:'text'};
    if(text.includes('\u0000')) throw new Error('This is not a plain text resume. Choose a PDF, DOCX, JSON Resume or TXT file.');
  } else if(extension==='json') {
    jsonResume=JSON.parse(await file.text());
    if(!jsonResume || typeof jsonResume!=='object'||Array.isArray(jsonResume)||!jsonResume.basics) throw new Error('Choose a JSON Resume file with a basics object.');
    const blocks=[jsonResume.basics.name,jsonResume.basics.email,jsonResume.basics.summary];
    for(const [key,heading] of [['work','EXPERIENCE'],['education','EDUCATION'],['skills','SKILLS'],['projects','PROJECTS']]) {
      if(!Array.isArray(jsonResume[key])||!jsonResume[key].length) continue;
      blocks.push(heading);
      for(const entry of jsonResume[key]) {
        blocks.push([entry.name??entry.institution,entry.position??entry.studyType,entry.startDate&&`${entry.startDate}–${entry.endDate??'Present'}`].filter(Boolean).join(' · '),entry.summary);
        blocks.push(...(entry.highlights??entry.keywords??[]).map(item=>`• ${item}`));
      }
    }
    text=blocks.filter(Boolean).join('\n');metadata={format:'json-resume'};
  } else throw new Error('Choose a PDF, DOCX, JSON Resume or plain text (.txt) file.');
  const parse=analyzeText(text,metadata);
  return {text:parse.text,parse,jsonResume:jsonResume??jsonResumeFromText(parse.text),original:{name:file.name,mime:file.type,bytes:file.size}};
}
export async function saveOriginal(id,file,storage=globalThis.navigator?.storage) {
  if(!storage?.getDirectory) return null;
  const root=await storage.getDirectory();
  const originals=await root.getDirectoryHandle('originals',{create:true});
  const handle=await originals.getFileHandle(id,{create:true});
  const writable=await handle.createWritable();
  try {await writable.write(file);await writable.close();} catch(error) {await writable.abort().catch(()=>{});throw error;}
  return {opfsPath:`/originals/${id}`,name:file.name,mime:file.type,bytes:file.size};
}
