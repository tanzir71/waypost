<?php
declare(strict_types=1);
namespace Waypost;
require_once __DIR__.'/calendar-library.php';

final class ApiError extends \RuntimeException {
    public string $kind; public int $status;
    public function __construct(string $kind, string $message, int $status = 409) { parent::__construct($message); $this->kind=$kind; $this->status=$status; }
}
function fail(string $kind, string $message, int $status=400): never { throw new ApiError($kind,$message,$status); }
function uuid(mixed $value): string {
    if (!is_string($value)||!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/D',$value)) fail('invalid_input','Expected a UUIDv7 identifier.');
    return $value;
}
function encoded(mixed $value, ?int $length=null): string {
    if (!is_string($value)||!preg_match('/^[A-Za-z0-9_-]+$/D',$value)) fail('invalid_input','Invalid base64url value.');
    $bytes=base64_decode(strtr($value,'-_','+/'),true);
    if ($bytes===false||rtrim(strtr(base64_encode($bytes),'+/','-_'),'=')!==$value||($length!==null&&strlen($bytes)!==$length)) fail('invalid_input','Invalid encoded byte length.');
    return $bytes;
}
function json(mixed $value): string { return json_encode($value,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR); }
function envelope(array $row): array {
    $fields=['id','type','updatedAt','deviceId','iv','ciphertext']; $actual=array_keys($row); sort($actual); $expected=$fields; sort($expected);
    if ($actual!==$expected) fail('invalid_input','Invalid encrypted record fields.');
    uuid($row['id']); uuid($row['deviceId']);
    if (!in_array($row['type'],['jobs','resumes','resumeVersions','matchReports','applications','terms','courses','scales','offers','deadlines','contacts','letters','stories','settings'],true)) fail('invalid_input','Invalid record type.');
    if (!is_string($row['updatedAt'])||!preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/D',$row['updatedAt'])) fail('invalid_input','Expected a canonical UTC timestamp.');
    $date=\DateTimeImmutable::createFromFormat('Y-m-d\TH:i:s.v\Z',$row['updatedAt'],new \DateTimeZone('UTC'));
    if (!$date||$date->format('Y-m-d\TH:i:s.v\Z')!==$row['updatedAt']) fail('invalid_input','Invalid UTC timestamp.');
    encoded($row['iv'],12); if (strlen(encoded($row['ciphertext']))<16) fail('invalid_input','Invalid encrypted record.');
    if (strlen(json($row))>4*1024*1024) fail('record_limit','Encrypted record exceeds 4 MB.',413);
    return $row;
}
function vaultInput(array $data): array {
    uuid($data['vaultId']??null); encoded($data['salt']??null,16); encoded($data['authHash']??null,32);
    if (!is_int($data['keyVersion']??1)||($data['keyVersion']??1)<1||($data['keyVersion']??1)>1000000) fail('invalid_input','Invalid key version.');
    if (!is_array($data['wrappedKeys']??null)||count($data['wrappedKeys'])!==8) fail('invalid_input','Exactly eight recovery wrappers are required.');
    $seen=[];
    foreach ($data['wrappedKeys'] as $wrapped) {
        if (!is_array($wrapped)||count($wrapped)!==4) fail('invalid_input','Invalid recovery wrapper.');
        foreach (['codeId'=>16,'salt'=>16,'iv'=>12,'ciphertext'=>48] as $key=>$length) encoded($wrapped[$key]??null,$length);
        if (isset($seen[$wrapped['codeId']])) fail('invalid_input','Duplicate recovery wrapper.'); $seen[$wrapped['codeId']]=true;
    }
    return $data;
}
function hashBinding(string $token): string { return rtrim(strtr(base64_encode(hash('sha256',$token,true)),'+/','-_'),'='); }
function within(string $path,string $root): bool { $path=strtolower(str_replace('\\','/',$path)); $root=rtrim(strtolower(str_replace('\\','/',$root)),'/'); return $path===$root||str_starts_with($path,$root.'/'); }
function deployment(string $webRoot, ?string $configPath=null): array {
    $webRoot=realpath($webRoot)?:$webRoot; $path=$configPath??(getenv('WAYPOST_CONFIG')?:dirname($webRoot).'/waypost-data/config.php');
    $real=realpath($path); $outside=$real!==false&&!within($real,$webRoot)&&!within($real,__DIR__);
    $config=null; $writable=false;
    if ($outside) {
        $loaded=(static function($path){return require $path;})($real);
        if (is_array($loaded)&&is_string($loaded['database']??null)) {
            $directory=realpath(dirname($loaded['database'])); $dbPath=$directory===false?null:$directory.'/'.basename($loaded['database']);
            if ($directory&&$dbPath&&!within($directory,$webRoot)&&!within($directory,__DIR__)&&!is_link($dbPath)) { $config=$loaded; $config['database']=$dbPath; $writable=is_writable($directory)&&(!file_exists($dbPath)||is_writable($dbPath)); }
        }
    }
    return ['config'=>$config,'outside'=>$outside&&$config!==null,'writable'=>$writable];
}
final class Server {
    private ?\PDO $db=null; private array $deployment;
    public function __construct(array $deployment) { $this->deployment=$deployment; }
    private function db(): \PDO {
        if ($this->db) return $this->db;
        if (!$this->deployment['outside']||!$this->deployment['writable']) fail('not_configured','Configure a writable data directory outside the web root.',503);
        $this->db=new \PDO('sqlite:'.$this->deployment['config']['database'],null,null,[\PDO::ATTR_ERRMODE=>\PDO::ERRMODE_EXCEPTION,\PDO::ATTR_DEFAULT_FETCH_MODE=>\PDO::FETCH_ASSOC]);
        $this->db->exec('PRAGMA busy_timeout=5000'); $this->db->exec(file_get_contents(__DIR__.'/../worker/schema.sql'));
        $columns=$this->db->query('PRAGMA table_info(vaults)')->fetchAll();$names=array_column($columns,'name');
        if(!in_array('calendar_version',$names,true)||!in_array('calendar_mutation',$names,true)){$this->db->exec('BEGIN IMMEDIATE');try{$names=array_column($this->db->query('PRAGMA table_info(vaults)')->fetchAll(),'name');foreach(['calendar_version'=>'INTEGER NOT NULL DEFAULT 0','calendar_mutation'=>'TEXT'] as $name=>$definition)if(!in_array($name,$names,true))$this->db->exec('ALTER TABLE vaults ADD COLUMN '.$name.' '.$definition);$this->db->exec('COMMIT');}catch(\Throwable $error){$this->db->exec('ROLLBACK');throw $error;}}
        return $this->db;
    }
    private function query(string $sql,array $args=[]): \PDOStatement { $statement=$this->db()->prepare($sql); $statement->execute($args); return $statement; }
    private function vault(string $id): array|false { return $this->query('SELECT * FROM vaults WHERE vault_id=?',[$id])->fetch(); }
    private function transaction(callable $action): mixed {
        $db=$this->db(); $db->exec('BEGIN IMMEDIATE');
        try { $value=$action(); $db->exec('COMMIT'); return $value; } catch (\Throwable $error) { $db->exec('ROLLBACK'); throw $error; }
    }
    private function rate(string $ip,string $group,bool $sensitive=false): void {
        $window=(int)floor(time()/60);$bucket=hash('sha256',$ip.':'.$group.':'.$window);
        $count=$this->transaction(function()use($bucket,$window){$this->query('DELETE FROM rate_limits WHERE window < ?',[$window-60]);return $this->query('INSERT INTO rate_limits(bucket,window,count) VALUES(?,?,1) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count',[$bucket,$window])->fetchColumn();});
        if($count>($sensitive?30:($this->deployment['config']['rate_per_minute']??600)))fail('rate_limit','Rate limit reached. Retry after one minute.',429);
    }
    private function calendarStatus(string $id): array {
        $vault=$this->vault($id);if(!$vault)fail('vault_missing','Vault not found.',404);$feed=$this->query('SELECT * FROM calendar_feeds WHERE vault_id=?',[$id])->fetch();return ['version'=>(int)$vault['calendar_version'],'published'=>(bool)$feed,'updatedAt'=>$feed?$feed['updated_at']:null,'contentHash'=>$feed?$feed['content_hash']:null,'nonce'=>$feed?$feed['nonce']:null];
    }
    public function calendarFeed(string $token,bool $https,string $ip): array {
        try{if(!$https)fail('https_required','HTTPS is required.',426);encoded($token,32);$this->rate($ip,'calendar');$feed=$this->query('SELECT ics FROM calendar_feeds WHERE token_hash=?',[hashBinding($token)])->fetch();return $feed?[200,$feed['ics']]:[404,'Calendar feed not found.'];}
        catch(ApiError $error){return [$error->status===400?404:$error->status,$error->status===400?'Calendar feed not found.':$error->getMessage()];}catch(\Throwable $error){return [503,'Calendar storage is unavailable.'];}
    }
    public function handle(string $method,string $path,array $input,array $headers,array $query,string $origin,bool $https,string $ip): array {
        try {
            if (!$https) fail('https_required','HTTPS is required.',426);
            if (($headers['origin']??$origin)!==$origin||($headers['sec-fetch-site']??'')==='cross-site'||$method==='OPTIONS') fail('origin','Only same-origin requests are accepted.',403);
            if ($path==='/checks'&&$method==='GET') {
                $checks=[['id'=>'https','label'=>'HTTPS','passed'=>$https],['id'=>'php','label'=>'PHP 8.1 or newer','passed'=>PHP_VERSION_ID>=80100],['id'=>'sqlite','label'=>'PDO SQLite available','passed'=>in_array('sqlite',\PDO::getAvailableDrivers(),true)],['id'=>'outside','label'=>'Config and data outside web root','passed'=>$this->deployment['outside']],['id'=>'writable','label'=>'Data directory writable','passed'=>$this->deployment['writable']]];
                return [200,['protocol'=>1,'provider'=>'php','ready'=>!in_array(false,array_column($checks,'passed'),true),'checks'=>$checks]];
            }
            $sensitive=in_array($path,['/recover','/vault'],true);$this->rate($ip,$sensitive?'identity':'sync',$sensitive);
            if ($path==='/vault'&&$method==='GET') { $id=uuid($query['vaultId']??null);$vault=$this->vault($id);if(!$vault)fail('vault_missing','Vault not found.',404);return [200,['vaultId'=>$id,'salt'=>$vault['salt'],'keyVersion'=>(int)$vault['key_version'],'createdAt'=>$vault['created_at']]]; }
            if ($path==='/recover'&&$method==='POST') { $id=uuid($input['vaultId']??null);encoded($input['codeId']??null,16);$vault=$this->vault($id);$found=null;foreach($vault?json_decode($vault['wrapped_keys'],true):[] as $row)if($row['codeId']===$input['codeId'])$found=$row;if(!$found)fail('recovery_missing','Recovery code was not found.',404);return [200,['vaultId'=>$id,'keyVersion'=>(int)$vault['key_version'],'wrappedKey'=>$found]]; }
            if (!preg_match('/^Bearer ([A-Za-z0-9_-]+)$/D',$headers['authorization']??'',$matches)) fail('unauthorized','Vault authentication is required.',401);
            $token=$matches[1]; encoded($token,32);
            if ($path==='/vault'&&$method==='POST') {
                vaultInput($input);if(($input['keyVersion']??1)!==1||!hash_equals($input['authHash'],hashBinding($token)))fail('auth_binding','Invalid vault authentication binding.');
                $created=$this->transaction(function()use($input,$token){$existing=$this->vault($input['vaultId']);if($existing){if(password_verify($token,$existing['auth_hash'])&&$existing['salt']===$input['salt']&&$existing['wrapped_keys']===json($input['wrappedKeys']))return false;fail('vault_exists','Vault identifier already exists.',409);} $this->query('INSERT INTO vaults(vault_id,salt,auth_hash,wrapped_keys,key_version,max_bytes,created_at) VALUES(?,?,?,?,?,?,?)',[$input['vaultId'],$input['salt'],password_hash($token,PASSWORD_DEFAULT),json($input['wrappedKeys']),1,$this->deployment['config']['max_vault_bytes']??209715200,gmdate('Y-m-d\TH:i:s.000\Z')]);return true;});
                return [$created?201:200,['vaultId'=>$input['vaultId'],'keyVersion'=>1]];
            }
            $id=uuid($headers['x-waypost-vault']??null);$version=filter_var($headers['x-waypost-key-version']??'',FILTER_VALIDATE_INT);$vault=$this->vault($id);
            if(!$vault||!password_verify($token,$vault['auth_hash']))fail('unauthorized','Vault authentication failed. Unlock the vault again.',401);
            if($version!==(int)$vault['key_version'])fail('key_version_changed','Vault keys changed. Unlock again.',409);
            if($path==='/calendar'&&$method==='GET')return [200,$this->calendarStatus($id)];
            if($path==='/calendar'&&in_array($method,['POST','PUT','DELETE'],true)){
                $calendarVersion=$method==='PUT'?($input['version']??null):($input['expectedVersion']??null);if(!is_int($calendarVersion)||$calendarVersion<0)fail('calendar_version','Invalid calendar version.');
                if($method!=='DELETE'){calendarText($input['ics']??null);encoded($input['token']??null,32);if($method==='POST'&&(!is_string($input['nonce']??null)||!hash_equals(calendarTokenBinding($token,$id,$version,$input['nonce']),$input['token'])))fail('calendar_input','Invalid calendar token binding.');}
                $status=$this->transaction(function()use($method,$id,$version,$token,$input,$calendarVersion){$current=$this->vault($id);if(!$current||(int)$current['key_version']!==$version)fail('key_version_changed','Vault keys changed.',409);
                    if((int)$current['calendar_version']!==$calendarVersion)fail('calendar_changed','Calendar publication changed. Refresh before trying again.',409);
                    if($method==='PUT'){$updated=$this->query('UPDATE calendar_feeds SET ics=?,content_hash=?,updated_at=? WHERE vault_id=? AND token_hash=? AND version=?',[$input['ics'],hashBinding($input['ics']),gmdate('Y-m-d\TH:i:s.000\Z'),$id,hashBinding($input['token']),$calendarVersion]);if(!$updated->rowCount())fail('calendar_revoked','Calendar feed was revoked or replaced.',409);}
                    else{$this->query('UPDATE vaults SET calendar_version=calendar_version+1,calendar_mutation=? WHERE vault_id=?',[bin2hex(random_bytes(16)),$id]);if($method==='DELETE')$this->query('DELETE FROM calendar_feeds WHERE vault_id=?',[$id]);else $this->query('INSERT INTO calendar_feeds(vault_id,token_hash,nonce,version,ics,content_hash,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(vault_id) DO UPDATE SET token_hash=excluded.token_hash,nonce=excluded.nonce,version=excluded.version,ics=excluded.ics,content_hash=excluded.content_hash,updated_at=excluded.updated_at',[$id,hashBinding($input['token']),$input['nonce'],$calendarVersion+1,$input['ics'],hashBinding($input['ics']),gmdate('Y-m-d\TH:i:s.000\Z')]);}return $this->calendarStatus($id);});return [200,$status];
            }
            if($path==='/changes'&&$method==='GET') {
                $since=filter_var($query['since']??0,FILTER_VALIDATE_INT);if($since===false||$since<0)fail('cursor','Invalid cursor.');if($since>(int)$vault['cursor'])fail('cursor_out_of_range','Restart the read cursor.',409);
                $rows=$this->query('SELECT * FROM changes WHERE vault_id=? AND seq>? ORDER BY seq LIMIT 50',[$id,$since])->fetchAll();$changes=[];$size=0;$last=$since;
                foreach($rows as $row){if($size+(int)$row['bytes']>4.5*1024*1024)break;$changes[]=['id'=>$row['id'],'type'=>$row['type'],'updatedAt'=>$row['updated_at'],'deviceId'=>$row['device_id'],'iv'=>$row['iv'],'ciphertext'=>$row['ciphertext']];$size+=(int)$row['bytes'];$last=(int)$row['seq'];}
                $more=count($changes)<count($rows)||count($rows)===50;return [200,['changes'=>$changes,'cursor'=>$more?$last:max($last,(int)$vault['cursor']),'hasMore'=>$more,'keyVersion'=>$version]];
            }
            if(in_array($path,['/changes','/vault/rotation/changes'],true)&&$method==='POST') {
                if(!is_array($input['changes']??null)||count($input['changes'])>10)fail('batch_limit','Use at most 10 records per batch.',413);$changes=[];$seen=[];foreach($input['changes'] as $row){if(!is_array($row))fail('invalid_input','Invalid record.');envelope($row);$key=$row['type'].':'.$row['id'];if(isset($seen[$key]))fail('duplicate','Duplicate record in batch.');$seen[$key]=true;$changes[]=$row;}
                $rotation=$path==='/changes'?null:uuid($input['rotationId']??null);
                $cursor=$this->transaction(function()use($id,$version,$changes,$rotation){$current=$this->vault($id);if((int)$current['key_version']!==$version)fail('key_version_changed','Vault keys changed.',409);if($rotation&&!$this->query('SELECT 1 FROM rotations WHERE vault_id=? AND rotation_id=?',[$id,$rotation])->fetchColumn())fail('rotation_missing','Pending rotation not found.',409);
                    foreach($changes as $row){$args=[$id,...($rotation?[$rotation]:[]),$row['type'],$row['id'],$row['updatedAt'],$row['deviceId'],$version+($rotation?1:0),$row['iv'],$row['ciphertext'],null,strlen(json($row))];
                        if($rotation)$this->query('INSERT INTO staged_changes(vault_id,rotation_id,type,id,updated_at,device_id,key_version,iv,ciphertext,r2_key,bytes) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(vault_id,rotation_id,type,id) DO UPDATE SET updated_at=excluded.updated_at,device_id=excluded.device_id,iv=excluded.iv,ciphertext=excluded.ciphertext,bytes=excluded.bytes',$args);
                        else $this->query('INSERT INTO changes(vault_id,type,id,updated_at,device_id,key_version,iv,ciphertext,r2_key,bytes) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(vault_id,type,id) DO UPDATE SET updated_at=excluded.updated_at,device_id=excluded.device_id,key_version=excluded.key_version,iv=excluded.iv,ciphertext=excluded.ciphertext,bytes=excluded.bytes WHERE excluded.updated_at>changes.updated_at OR (excluded.updated_at=changes.updated_at AND excluded.device_id>changes.device_id)',$args);
                    }return (int)$this->vault($id)['cursor'];});return [200,['cursor'=>$cursor]];
            }
            if($path==='/vault/rotation'&&$method==='GET'){$pending=$this->query('SELECT * FROM rotations WHERE vault_id=?',[$id])->fetch();return [200,['pending'=>$pending?['rotationId'=>$pending['rotation_id'],'baseCursor'=>(int)$pending['base_cursor'],'createdAt'=>$pending['created_at']]:null]];}
            if($path==='/vault/rotation'&&$method==='POST') {
                vaultInput($input);$rotation=uuid($input['rotationId']??null);encoded($input['newAuthToken']??null,32);
                if($input['vaultId']!==$id||($input['keyVersion']??0)!==$version+1||!hash_equals($input['authHash'],hashBinding($input['newAuthToken']))||!is_int($input['baseCursor']??null)||$input['baseCursor']<0)fail('rotation_metadata','Invalid replacement key metadata.');
                $this->transaction(function()use($id,$version,$input,$rotation){$current=$this->vault($id);if((int)$current['cursor']!==$input['baseCursor']||(int)$current['key_version']!==$version)fail('concurrent_change','Vault changed; retry with a fresh snapshot.',409);if($this->query('SELECT 1 FROM rotations WHERE vault_id=?',[$id])->fetchColumn())fail('rotation_pending','Cancel the pending key rotation before retrying.',409);$this->query('INSERT INTO rotations(vault_id,rotation_id,base_cursor,key_version,salt,auth_hash,wrapped_keys,created_at) VALUES(?,?,?,?,?,?,?,?)',[$id,$rotation,$input['baseCursor'],$input['keyVersion'],$input['salt'],password_hash($input['newAuthToken'],PASSWORD_DEFAULT),json($input['wrappedKeys']),gmdate('Y-m-d\TH:i:s.000\Z')]);});return [201,['rotationId'=>$rotation]];
            }
            if($path==='/vault/rotation/commit'&&$method==='POST') {
                $rotation=uuid($input['rotationId']??null);if(!is_int($input['count']??null)||$input['count']<0)fail('rotation_count','Invalid record count.');
                $next=$this->transaction(function()use($id,$version,$rotation,$input){$pending=$this->query('SELECT * FROM rotations WHERE vault_id=? AND rotation_id=?',[$id,$rotation])->fetch();if(!$pending)fail('rotation_missing','Pending key rotation not found.',409);$current=$this->vault($id);$staged=$this->query('SELECT * FROM staged_changes WHERE vault_id=? AND rotation_id=?',[$id,$rotation])->fetchAll();$active=$this->query('SELECT type,id,updated_at,device_id FROM changes WHERE vault_id=?',[$id])->fetchAll();$same=count($staged)===count($active)&&count($staged)===$input['count'];$map=[];foreach($active as $row)$map[$row['type'].':'.$row['id']]=$row;foreach($staged as $row){$old=$map[$row['type'].':'.$row['id']]??null;if(!$old||$row['updated_at']!==$old['updated_at']||$row['device_id']!==$old['device_id'])$same=false;}
                    if((int)$current['key_version']!==$version||(int)$current['cursor']!==(int)$pending['base_cursor']||!$same)fail('concurrent_change','Vault changed during recovery. Old keys remain active; retry.',409);
                    $this->query('UPDATE vaults SET salt=?,auth_hash=?,wrapped_keys=?,key_version=?,applied_rotation=?,cursor=cursor+1,calendar_version=calendar_version+1,calendar_mutation=NULL WHERE vault_id=?',[$pending['salt'],$pending['auth_hash'],$pending['wrapped_keys'],$pending['key_version'],$rotation,$id]);$this->query('DELETE FROM calendar_feeds WHERE vault_id=?',[$id]);$this->query('DELETE FROM changes WHERE vault_id=?',[$id]);$this->query('INSERT INTO changes(vault_id,type,id,updated_at,device_id,key_version,iv,ciphertext,r2_key,bytes) SELECT vault_id,type,id,updated_at,device_id,key_version,iv,ciphertext,r2_key,bytes FROM staged_changes WHERE vault_id=? AND rotation_id=?',[$id,$rotation]);$this->query('DELETE FROM staged_changes WHERE vault_id=?',[$id]);$this->query('DELETE FROM rotations WHERE vault_id=?',[$id]);return $this->vault($id);});
                return [200,['keyVersion'=>(int)$next['key_version'],'cursor'=>(int)$next['cursor']]];
            }
            if($path==='/vault/rotation'&&$method==='DELETE'){$rotation=isset($input['rotationId'])?uuid($input['rotationId']):null;$this->transaction(function()use($id,$rotation,$version){$current=$this->vault($id);if(!$current||(int)$current['key_version']!==$version)fail('key_version_changed','Vault keys changed.',409);$args=$rotation?[$id,$rotation]:[$id];$where='vault_id=?'.($rotation?' AND rotation_id=?':'');$this->query('DELETE FROM staged_changes WHERE '.$where,$args);$this->query('DELETE FROM rotations WHERE '.$where,$args);});return [200,['cancelled'=>true]];}
            if($path==='/vault'&&$method==='DELETE'){$this->transaction(function()use($id,$version){$current=$this->vault($id);if((int)$current['key_version']!==$version)fail('key_version_changed','Vault keys changed.',409);$this->query('DELETE FROM vaults WHERE vault_id=?',[$id]);});return [200,['deleted'=>true]];}
            fail('not_found','Sync route not found.',404);
        } catch(ApiError $error) {return [$error->status,['error'=>$error->getMessage(),'code'=>$error->kind]];}
          catch(\Throwable $error) { if(preg_match('/CHECK constraint failed|rotation_quota/',$error->getMessage()))return [413,['error'=>'Vault quota exceeded.','code'=>'vault_limit']]; return [503,['error'=>'Sync storage operation failed.','code'=>'storage']]; }
    }
}
