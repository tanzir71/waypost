<?php
declare(strict_types=1);
require __DIR__.'/library.php';
header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');header('Referrer-Policy: no-referrer');
$method=$_SERVER['REQUEST_METHOD']??'GET';
if(!in_array($method,['GET','HEAD'],true)){$status=405;$text='Use GET or HEAD.';header('Allow: GET, HEAD');}
else{try{$server=new \Waypost\Server(\Waypost\deployment($_SERVER['DOCUMENT_ROOT']??dirname(__DIR__,2)));[$status,$text]=$server->calendarFeed(is_string($_GET['token']??null)?$_GET['token']:'',in_array($_SERVER['HTTPS']??'',['on','1'],true),$_SERVER['REMOTE_ADDR']??'unknown');}catch(\Throwable $error){$status=503;$text='Calendar storage is not configured.';}}
http_response_code($status);header('Content-Type: '.($status===200?'text/calendar; charset=utf-8':'text/plain; charset=utf-8'));if($status===200)header('Content-Disposition: inline; filename="waypost.ics"');if($status===429)header('Retry-After: 60');if($method!=='HEAD')echo $text;
