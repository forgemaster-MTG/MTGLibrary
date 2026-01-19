
# Script to Restore Production from Development
# USE WITH CAUTION: This overwrites production!

# Configuration
$SOURCE_CONTAINER = "postgres-dev"
$TARGET_CONTAINER = "mtg-postgres-prod"

$DB_USER = "admin"
$DB_PASSWORD = "Pass4Kincaid!"
$SOURCE_DB_NAME = "mtg_postgres_db_dev"
$TARGET_DB_NAME = "mtg_postgres_db"

$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$BACKUP_FILE = "$env:TEMP\mtg_dev_backup_$TIMESTAMP.sql"

Write-Host "⚠️  WARNING: You are about to OVERWRITE Production with Development Data." -ForegroundColor Red
Write-Host "Source: $SOURCE_CONTAINER ($SOURCE_DB_NAME)"
Write-Host "Target: $TARGET_CONTAINER ($TARGET_DB_NAME)"
# Interactive confirmation (optional, but good for safety. Removing strict check for automation ease if user wants to just run it)
# Read-Host -Prompt "Press Enter to continue or Ctrl+C to abort"

# 1. Dump Development DB
Write-Host "1. Dumping Development Database..."
$dumpCmd = "docker exec -e PGPASSWORD=$DB_PASSWORD $SOURCE_CONTAINER pg_dump -U $DB_USER $SOURCE_DB_NAME > $BACKUP_FILE"
cmd /c $dumpCmd

if (-not (Test-Path $BACKUP_FILE) -or (Get-Item $BACKUP_FILE).Length -eq 0) {
    Write-Error "Dump failed or empty."
    exit 1
}

# 2. Terminate connections on Production
Write-Host "2. Terminating connections to Production..."
# Target is production, DB name is usually mtg_postgres_db (check docker-compose env)
# The docker-compose says POSTGRES_DB=mtg_postgres_db
docker exec -e PGPASSWORD=$DB_PASSWORD $TARGET_CONTAINER psql -U $DB_USER -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$TARGET_DB_NAME' AND pid <> pg_backend_pid();"

# 3. Recreate Production DB
Write-Host "3. Recreating Database on Production..."
docker exec -e PGPASSWORD=$DB_PASSWORD $TARGET_CONTAINER psql -U $DB_USER -d postgres -c "DROP DATABASE IF EXISTS $TARGET_DB_NAME;"
docker exec -e PGPASSWORD=$DB_PASSWORD $TARGET_CONTAINER psql -U $DB_USER -d postgres -c "CREATE DATABASE $TARGET_DB_NAME;"

# 4. Restore Data
Write-Host "4. Restoring Data to Production..."
$restoreCmd = "type $BACKUP_FILE | docker exec -i -e PGPASSWORD=$DB_PASSWORD $TARGET_CONTAINER psql -U $DB_USER $TARGET_DB_NAME"
cmd /c $restoreCmd

# 5. Cleanup
Remove-Item $BACKUP_FILE
Write-Host "--- Restore Complete! ---" -ForegroundColor Green
