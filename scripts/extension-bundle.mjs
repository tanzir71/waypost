import {readFile} from 'node:fs/promises';
import {files} from './files.mjs';
export const root=new URL('../',import.meta.url);
export async function extensionFiles() {
  const sources=(await files(root)).filter(path=>/^(core\/(?:match|import)\/|core\/links\/index\.js$|core\/scoring\.js$|core\/store\/schema\.js$|schemas\/(?:workspace|job-export)\.json$|data\/aliases\.json$|data\/skills\/|assets\/fonts\/|assets\/icons\/logo(?:-dark)?\.svg$|ui\/(?:tokens|base|match)\.css$|ui\/dom\.js$|ui\/components\/match-report\.js$)/.test(path));
  const result=[];
  for(const path of sources) {
    const original=await readFile(new URL(path,root));
    if(path.endsWith('.js')) {
      const code=original.toString().replace(/from\s+(['"])([^'"]+\.json)\1\s+with\s*\{\s*type\s*:\s*['"]json['"]\s*\}/g,(_,quote,target)=>`from ${quote}${target}.js${quote}`);
      result.push({path:`extension/bundled/${path}`,data:Buffer.from(code)});
    } else {
      result.push({path:`extension/bundled/${path}`,data:original});
      if(path.endsWith('.json'))result.push({path:`extension/bundled/${path}.js`,data:Buffer.from(`// Generated from ${path}; do not edit.\nexport default ${JSON.stringify(JSON.parse(original))};\n`)});
    }
  }
  result.push({path:'extension/bundled/NOTICE.md',data:Buffer.from('Generated from the canonical core/, data/, schemas/, ui/ and assets/ sources.\nRun node scripts/build-extension.mjs after changing these sources.\nJSON imports are translated to JS modules for extension service workers.\nSee bundled/data/skills/LICENSE.md and bundled/assets/fonts/ for attribution.\n')});
  result.push({path:'extension/defaults.js',data:Buffer.from(`// Generated from defaults.json.\nexport default ${JSON.stringify(JSON.parse(await readFile(new URL('extension/defaults.json',root),'utf8')))};\n`)});
  const logo=await readFile(new URL('assets/icons/logo.svg',root));
  result.push({path:'extension/brand.js',data:Buffer.from(`// Generated from the local Figma logo; no page-origin asset request.\nexport default "data:image/svg+xml;base64,${logo.toString('base64')}";\n`)});
  return result;
}
