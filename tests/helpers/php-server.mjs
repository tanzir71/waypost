import {spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join,dirname,resolve,basename} from 'node:path';
import {tmpdir} from 'node:os';
export async function phpHarness(t){
  const binary=spawnSync('php',['-r','echo PHP_BINARY;'],{encoding:'utf8',windowsHide:true});if(binary.status!==0){t.skip('PHP is not on PATH.');return null;}
  const probe=args=>spawnSync('php',[...args,'-r',"echo implode(',',PDO::getAvailableDrivers());"],{encoding:'utf8',windowsHide:true}),fallback=['-d',`extension_dir=${join(dirname(binary.stdout),'ext')}`,'-d','extension=pdo_sqlite'],args=probe([]).stdout.includes('sqlite')?[]:fallback;
  if(!probe(args).stdout.includes('sqlite')){t.skip('PHP SQLite driver unavailable; PHP lint remains required.');return null;}
  const directory=await mkdtemp(join(tmpdir(),'waypost-calendar-')),config=join(directory,'config.php'),root=process.cwd();await writeFile(config,"<?php return ['database'=>__DIR__.'/vault.sqlite'];");
  if(dirname(resolve(directory))!==resolve(tmpdir())||!basename(directory).startsWith('waypost-calendar-'))throw new Error('Unexpected PHP test directory.');
  const script=`require $argv[1];$d=json_decode(stream_get_contents(STDIN),true);$server=new \\Waypost\\Server(\\Waypost\\deployment($argv[2],$argv[3]));if($d['public']){$result=$server->calendarFeed($d['query']['token']??'',$d['https'],'127.0.0.1');}else{$result=$server->handle($d['method'],$d['path'],$d['input'],$d['headers'],$d['query'],$d['origin'],$d['https'],'127.0.0.1');}echo \\Waypost\\json($result);`;
  return {directory,database:join(directory,'vault.sqlite'),args,async fetch(url,options={}){
    const target=new URL(url),publicFeed=target.pathname.endsWith('/ics.php'),data={public:publicFeed,method:options.method??'GET',path:target.searchParams.get('route')??target.pathname.replace(/^.*\/api\/sync/,''),input:options.body?JSON.parse(options.body):[],headers:Object.fromEntries(Object.entries(options.headers??{}).map(([key,value])=>[key.toLowerCase(),value])),query:Object.fromEntries(target.searchParams),origin:target.origin,https:target.protocol==='https:'};
    const output=spawnSync('php',[...args,'-r',script,join(root,'server/php/library.php'),root,config],{input:JSON.stringify(data),encoding:'utf8',windowsHide:true});if(output.status!==0)throw new Error(output.stderr||'PHP harness failed.');let status,body;try{[status,body]=JSON.parse(output.stdout);}catch{throw new Error(output.stdout+output.stderr);}return publicFeed?new Response(options.method==='HEAD'?null:body,{status,headers:{'Content-Type':status===200?'text/calendar; charset=utf-8':'text/plain; charset=utf-8','Cache-Control':'no-store'}}):Response.json(body,{status});
  },close:()=>rm(directory,{recursive:true,force:true})};
}
