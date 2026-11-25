// A small IDB contract fake for adapter integration tests. It models asynchronous
// requests, commit/abort, key paths and unique indexes; it is not used in the app.
export function memoryIndexedDB() {
  const tables=new Map(),indexes=new Map();let created=false;
  const db={
    objectStoreNames:{contains:name=>tables.has(name)},
    createObjectStore(name) {tables.set(name,new Map());return {createIndex(index,key,{unique}){indexes.set(`${name}:${index}`,{key,unique});}};},
    close(){},
    transaction(names,mode) {
      names=[names].flat();
      const working=new Map(names.map(name=>[name,new Map([...tables.get(name)].map(([id,row])=>[id,structuredClone(row)]))]));
      let pending=0,ended=false,finish;
      const tx={error:null};
      const maybeFinish=()=>{
        clearImmediate(finish);
        finish=setImmediate(()=>{if(pending||ended)return;ended=true;if(mode==='readwrite')for(const [name,rows]of working)tables.set(name,rows);tx.oncomplete?.();});
      };
      const run=operation=>{
        const req={};pending++;
        setImmediate(()=>{
          if(ended)return;
          try {req.result=operation();req.onsuccess?.({target:req});}
          catch(error){req.error=error;tx.error=error;ended=true;req.onerror?.({target:req});tx.onabort?.();}
          finally{pending--;maybeFinish();}
        });
        return req;
      };
      tx.objectStore=name=>{
        if(!working.has(name))throw new Error(`Store not in transaction: ${name}`);
        return {
          get:id=>run(()=>structuredClone(working.get(name).get(id))),
          getAll:()=>run(()=>[...working.get(name).values()].map(row=>structuredClone(row))),
          put:record=>run(()=>{
            for(const [label,index]of indexes) {
              if(!label.startsWith(`${name}:`)||!index.unique)continue;
              if([...working.get(name).values()].some(row=>row.id!==record.id&&row[index.key]===record[index.key]))throw Object.assign(new Error('Duplicate index value'),{name:'ConstraintError'});
            }
            working.get(name).set(record.id,structuredClone(record));return record.id;
          }),
          index:index=>({get:key=>run(()=>structuredClone([...working.get(name).values()].find(row=>row[indexes.get(`${name}:${index}`).key]===key)))})
        };
      };
      maybeFinish();return tx;
    }
  };
  return {open(){const req={};setImmediate(()=>{req.result=db;if(!created){created=true;req.onupgradeneeded?.();}req.onsuccess?.();});return req;}};
}
export function memoryLocalStorage(initial={}) {
  const map=new Map(Object.entries(initial));
  return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,String(value)),removeItem:key=>map.delete(key)};
}
