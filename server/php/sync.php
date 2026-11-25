<?php
declare(strict_types=1);
require __DIR__.'/library.php';
header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store'); header('X-Content-Type-Options: nosniff'); header('Referrer-Policy: no-referrer');
try {
    $raw=file_get_contents('php://input',false,null,0,5*1024*1024+1);
    if(strlen($raw)>5*1024*1024||(int)($_SERVER['CONTENT_LENGTH']??0)>5*1024*1024)\Waypost\fail('request_limit','Request exceeds 5 MB.',413);
    $input=$raw===''?[]:json_decode($raw,true,512,JSON_THROW_ON_ERROR);if(!is_array($input))\Waypost\fail('invalid_json','Expected a JSON object.');
    $https=($_SERVER['HTTPS']??'')==='on'||($_SERVER['HTTPS']??'')==='1';
    // Do not trust client-supplied forwarding headers. Terminate HTTPS here or set
    // HTTPS=on in the trusted reverse-proxy/server configuration.
    $origin=($https?'https':'http').'://'.($_SERVER['HTTP_HOST']??'');$headers=[];
    foreach($_SERVER as $key=>$value)if(str_starts_with($key,'HTTP_'))$headers[strtolower(str_replace('_','-',substr($key,5)))]=(string)$value;
    if(isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION']))$headers['authorization']=$_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    $server=new \Waypost\Server(\Waypost\deployment($_SERVER['DOCUMENT_ROOT']??dirname(__DIR__,2)));
    [$status,$body]=$server->handle($_SERVER['REQUEST_METHOD']??'GET',$_GET['route']??($_SERVER['PATH_INFO']??'/'),$input,$headers,$_GET,$origin,$https,$_SERVER['REMOTE_ADDR']??'unknown');
}catch(\Waypost\ApiError $error){$status=$error->status;$body=['error'=>$error->getMessage(),'code'=>$error->kind];}
catch(\JsonException $error){$status=400;$body=['error'=>'Expected a JSON body.','code'=>'invalid_json'];}
catch(\Throwable $error){$status=503;$body=['error'=>'Sync server is not configured.','code'=>'not_configured'];}
if($status===429)header('Retry-After: 60');http_response_code($status);echo \Waypost\json($body);
