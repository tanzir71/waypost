<?php
// Copy outside the web root as waypost-data/config.php. Keep this directory on redeploy.
return [
    'database' => __DIR__ . '/vault.sqlite',
    'max_vault_bytes' => 200 * 1024 * 1024,
    'rate_per_minute' => 600,
];
