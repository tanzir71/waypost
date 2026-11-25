<?php
declare(strict_types=1);
require __DIR__.'/ai-library.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');header('Referrer-Policy: no-referrer');
try{
    $raw=file_get_contents('php://input',false,null,0,65537);if(strlen($raw)>65536||(int)($_SERVER['CONTENT_LENGTH']??0)>65536)\Waypost\fail('ai_limit','AI request exceeds 64 KB.',413);
    $input=json_decode($raw,true,512,JSON_THROW_ON_ERROR);if(!is_array($input))\Waypost\fail('ai_input','Expected a JSON object.');
    $https=in_array($_SERVER['HTTPS']??'',['on','1'],true);$origin=($https?'https':'http').'://'.($_SERVER['HTTP_HOST']??'');$headers=[];
    foreach($_SERVER as $name=>$value){if(str_starts_with($name,'HTTP_'))$headers[strtolower(str_replace('_','-',substr($name,5)))]=(string)$value;}
    $headers['content-type']=$_SERVER['CONTENT_TYPE']??'';
    $server=new \Waypost\Server(\Waypost\deployment($_SERVER['DOCUMENT_ROOT']??dirname(__DIR__,2)));
    [$status,$body]=\Waypost\aiHandle($_SERVER['REQUEST_METHOD']??'GET',$input,$headers,$origin,$https,$_SERVER['REMOTE_ADDR']??'unknown',static fn($ip)=>$server->limitAI($ip));
}catch(\Waypost\ApiError $error){$status=$error->status;$body=['error'=>'Invalid AI request, size or configuration.'];}
catch(\Throwable $error){$status=400;$body=['error'=>'Invalid AI request.'];}
if($status===429)header('Retry-After: 60');http_response_code($status);echo \Waypost\json($body);
