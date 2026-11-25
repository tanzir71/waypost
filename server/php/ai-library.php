<?php
declare(strict_types=1);
namespace Waypost;
require_once __DIR__.'/library.php';

// Protocol adapter only. Writing rules and final metric validation run in the
// shared /core/ai module before a suggestion can be shown or accepted.
function aiText(mixed $value,int $maxBytes): string {
    if(!is_string($value)||trim($value)===''||strlen($value)>$maxBytes||!preg_match('//u',$value)||preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f]/',$value))fail('ai_input','Invalid or excessive AI text.');
    return $value;
}
function aiInput(array $input): array {
    $keys=array_keys($input);sort($keys);if($keys!==['input','instructions','model']||!is_string($input['model'])||!preg_match('/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/D',$input['model']))fail('ai_input','Invalid AI request.');
    return ['model'=>$input['model'],'input'=>aiText($input['input'],48000),'instructions'=>aiText($input['instructions'],8000),'store'=>false,'max_output_tokens'=>4096];
}
function aiProviderText(array $value): string {
    if(($value['status']??null)!=='completed'||!empty($value['error'])||!empty($value['incomplete_details'])||!is_array($value['output']??null))fail('ai_response','Incomplete provider response.',502);
    $parts=[];foreach($value['output'] as $row){if(($row['type']??null)!=='message'||($row['role']??null)!=='assistant')continue;foreach($row['content']??[] as $part){if(($part['type']??null)==='refusal')fail('ai_response','Provider declined request.',502);if(($part['type']??null)==='output_text')$parts[]=aiText($part['text']??null,48000);}}
    return aiText(implode("\n",$parts),48000);
}
function aiUpstream(string $key,array $input): array {
    if(!function_exists('curl_init'))fail('ai_not_configured','PHP cURL is required for optional BYOK.',503);
    // Fixed server-only upstream; redirects, caller URLs and cookies are disabled.
    $curl=curl_init('https://api.openai.com/v1/responses');$body='';
    curl_setopt_array($curl,[CURLOPT_POST=>true,CURLOPT_HTTPHEADER=>['Content-Type: application/json','Authorization: Bearer '.$key],CURLOPT_POSTFIELDS=>json($input),CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>10,CURLOPT_TIMEOUT=>45,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_WRITEFUNCTION=>static function($handle,string $chunk)use(&$body): int{if(strlen($body)+strlen($chunk)>262144)return 0;$body.=$chunk;return strlen($chunk);}]);
    $ok=curl_exec($curl);$status=(int)curl_getinfo($curl,CURLINFO_RESPONSE_CODE);curl_close($curl);if($ok===false)fail('ai_upstream','Provider request failed.',502);
    return [$status,$status>=200&&$status<300?json_decode($body,true,512,JSON_THROW_ON_ERROR):[]];
}
function aiHandle(string $method,array $input,array $headers,string $origin,bool $https,string $ip,callable $rate,?callable $send=null): array {
    if(!$https)return [426,['error'=>'HTTPS is required.']];
    if(isset($headers['origin'])&&$headers['origin']!==$origin||($headers['sec-fetch-site']??'')==='cross-site')return [403,['error'=>'Same-origin requests only.']];
    if($method!=='POST')return [405,['error'=>'Use POST from the application.']];
    if(!str_starts_with($headers['content-type']??'','application/json'))return [415,['error'=>'Expected JSON.']];
    try{
        $key=$headers['x-waypost-ai-key']??'';if(!preg_match('/^[\x21-\x7e]{20,512}$/D',$key))fail('ai_input','Invalid API key.');$payload=aiInput($input);
        $rate($ip);[$status,$data]=($send??__NAMESPACE__.'\\aiUpstream')($key,$payload);
        if($status<200||$status>=300)return [in_array($status,[401,403],true)?401:($status===429?429:502),['error'=>'AI provider could not complete this request.']];
        return [200,['text'=>aiProviderText($data)]];
    }catch(ApiError $error){return [$error->status,['error'=>$error->status===429?'AI rate limit reached.':($error->status===400?'Invalid AI request, key or size.':'AI relay could not complete this request.')]];}
    catch(\Throwable $error){return [502,['error'=>'AI request failed. Your draft is unchanged.']];}
}
