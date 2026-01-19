
param (
    [string]$TargetEnv = "dev"
)

# Configuration
$PROD_CONTAINER = "mtg-postgres-prod"
$STAGING_CONTAINER = "postgres-staging"
$DEV_CONTAINER = "postgres-dev"

$DB_USER = "admin"
# Note: In a real script, avoid hardcoding passwords. 
# We use the one from the bash script as reference.
$DB_PASSWORD = "Pass4Kincaid!" 
$DB_NAME = "mtg_postgres_db"

$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$BACKUP_FILE = "$env:TEMP\mtg_backup_$TIMESTAMP.sql"

function Sync-DB {
    param (
        $SourceContainer,
        $TargetContainer,
        $TargetDBName
    )

    Write-Host "--- Starting Sync: $SourceContainer -> $TargetContainer ---" -ForegroundColor Cyan

    # 1. Dump Production DB
    Write-Host "1. Dumping Production Database..."
    # Use cmd /c for reliable redirection on Windows
    # We dump to a file in the temp directory
    $dumpCmd = "docker exec -e PGPASSWORD=$DB_PASSWORD $SourceContainer pg_dump -U $DB_USER $DB_NAME > $BACKUP_FILE"
    cmd /c $dumpCmd

    if (-not (Test-Path $BACKUP_FILE) -or (Get-Item $BACKUP_FILE).Length -eq 0) {
        Write-Error "Dump failed or empty."
        exit 1
    }

    # 2. Terminate connections
    Write-Host "2. Terminating connections to $TargetContainer..."
    docker exec -e PGPASSWORD=$DB_PASSWORD $TargetContainer psql -U $DB_USER -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$TargetDBName' AND pid <> pg_backend_pid();"

    # 3. Recreate DB
    Write-Host "3. Recreating Database on $TargetContainer..."
    docker exec -e PGPASSWORD=$DB_PASSWORD $TargetContainer psql -U $DB_USER -d postgres -c "DROP DATABASE IF EXISTS $TargetDBName;"
    docker exec -e PGPASSWORD=$DB_PASSWORD $TargetContainer psql -U $DB_USER -d postgres -c "CREATE DATABASE $TargetDBName;"

    # 4. Restore Data
    Write-Host "4. Restoring Data to $TargetContainer..."
    # Use cmd /c for reliable piping
    $restoreCmd = "type $BACKUP_FILE | docker exec -i -e PGPASSWORD=$DB_PASSWORD $TargetContainer psql -U $DB_USER $TargetDBName"
    cmd /c $restoreCmd

    # 5. Cleanup
    Remove-Item $BACKUP_FILE
    Write-Host "--- Sync Complete! ---" -ForegroundColor Green
}

# Main Switch
switch ($TargetEnv) {
    "staging" { Sync-DB $PROD_CONTAINER $STAGING_CONTAINER "mtg_postgres_db_staging" }
    "dev"     { Sync-DB $PROD_CONTAINER $DEV_CONTAINER "mtg_postgres_db_dev" }
    "all"     { 
        Sync-DB $PROD_CONTAINER $STAGING_CONTAINER "mtg_postgres_db_staging"
        Sync-DB $PROD_CONTAINER $DEV_CONTAINER "mtg_postgres_db_dev" 
    }
    Default   { 
        Write-Host "Usage: .\scripts\sync_db.ps1 [staging|dev|all]" -ForegroundColor Yellow
        exit 1 
    }
}
