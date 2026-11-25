<?php
declare(strict_types=1);
namespace Waypost;

// Validate the restricted publication wire format; calendar generation and the
// user's date/compensation/study calculations remain in the shared JS core.
function calendarText(mixed $text): string {
    if(!is_string($text)||strlen($text)>256*1024||preg_match('//u',$text)!==1)fail('calendar_input','Published calendar must be valid UTF-8 and at most 256 KB.');
    if(!str_ends_with($text,"\r\n")||preg_match('/[\r\n]/',str_replace("\r\n",'',$text)))fail('calendar_input','Use CRLF calendar line endings.');
    $physical=explode("\r\n",$text);foreach($physical as $i=>$line){if(strlen($line)>75)fail('calendar_input','Calendar lines must be folded at 75 octets.');if(isset($physical[$i+1])&&str_starts_with($physical[$i+1],' ')){preg_match('/^./us',substr($physical[$i+1],1),$first);if(!isset($first[0])||strlen($line)+strlen($first[0])<=75)fail('calendar_input','Use canonical calendar folding.');}}
    $lines=explode("\r\n",substr(preg_replace('/\r\n[ \t]/','',$text),0,-2));$header=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Waypost//Deadlines//EN','CALSCALE:GREGORIAN'];
    if(array_slice($lines,0,4)!==$header||end($lines)!=='END:VCALENDAR'||(count($lines)-5)%7!==0||(count($lines)-5)/7>1000)fail('calendar_input','Invalid published calendar structure.');
    $seen=[];$previous='';
    for($i=4;$i<count($lines)-1;$i+=7){$part=array_slice($lines,$i,7);
        if($part[0]!=='BEGIN:VEVENT'||$part[6]!=='END:VEVENT'||!preg_match('/^UID:(.+)@waypost$/D',$part[1],$id)||!preg_match('/^DTSTAMP:(\d{8}T\d{6}Z)$/D',$part[2],$stamp)||!preg_match('/^DTSTART;VALUE=DATE:(\d{8})$/D',$part[3],$start)||!preg_match('/^DTEND;VALUE=DATE:(\d{8})$/D',$part[4],$end)||!str_starts_with($part[5],'SUMMARY:'))fail('calendar_input','Published calendars contain only event titles and dates.');
        uuid($id[1]);if(isset($seen[$id[1]]))fail('calendar_input','Duplicate calendar UID.');$seen[$id[1]]=true;
        $date=\DateTimeImmutable::createFromFormat('!Ymd',$start[1],new \DateTimeZone('UTC'));$time=\DateTimeImmutable::createFromFormat('!Ymd\THis\Z',$stamp[1],new \DateTimeZone('UTC'));
        if(!$date||$start[1]<'00010101'||$start[1]>'99981231'||$date->format('Ymd')!==$start[1]||$date->modify('+1 day')->format('Ymd')!==$end[1]||!$time||$time->format('Ymd\THis\Z')!==$stamp[1])fail('calendar_input','Invalid all-day calendar date.');
        $order=$start[1].$id[1];if($previous!==''&&strcmp($order,$previous)<0)fail('calendar_input','Use canonical calendar event order.');$previous=$order;
        $summary=substr($part[5],8);$decoded='';for($j=0;$j<strlen($summary);$j++){if($summary[$j]==='\\'){$next=$summary[++$j]??'';if(!in_array($next,['\\',',',';','n'],true))fail('calendar_input','Invalid calendar text escape.');$decoded.=$next==='n'?"\n":$next;}else{if($summary[$j]===','||$summary[$j]===';')fail('calendar_input','Escape calendar text punctuation.');$decoded.=$summary[$j];}}
        if(trim($decoded)===''||preg_match('/[\x00-\x08\x0b-\x1f\x7f]/',$decoded))fail('calendar_input','Invalid calendar title.');preg_match_all('/./us',$decoded,$characters);$units=0;foreach($characters[0] as $character)$units+=ord($character[0])>=240?2:1;if($units>1000)fail('calendar_input','Calendar titles are limited to 1000 characters.');
    }return $text;
}
function calendarTokenBinding(string $token,string $id,int $version,string $nonce): string {encoded($nonce,32);return rtrim(strtr(base64_encode(hash_hmac('sha256','waypost-calendar-v1:'.$id.':'.$version.':'.$nonce,encoded($token,32),true)),'+/','-_'),'=');}
