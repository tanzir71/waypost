// Bounded JSON reader shared by the same-origin client and Worker relay.
export async function boundedJSON(response,max=262144){
 if(Number(response.headers.get('content-length'))>max)throw new Error('AI response exceeds the size limit.');
 const reader=response.body?.getReader(),decoder=new TextDecoder();let text='',size=0;
 if(reader){for(;;){const item=await reader.read();if(item.done)break;size+=item.value.byteLength;if(size>max){await reader.cancel();throw new Error('AI response exceeds the size limit.');}text+=decoder.decode(item.value,{stream:true});}text+=decoder.decode();}
 try{return JSON.parse(text);}catch{throw new Error('AI relay returned an invalid response.');}
}
