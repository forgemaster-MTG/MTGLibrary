#!/bin/bash

# Configuration
SOURCE_CONTAINER="postgres-dev"
TARGET_CONTAINER="mtg-postgres-prod"

DB_USER="admin"
DB_PASSWORD="Pass4Kincaid!"
SOURCE_DB_NAME="mtg_postgres_db_dev"
TARGET_DB_NAME="mtg_postgres_db"

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/tmp/mtg_dev_backup_${DATE}.sql"

echo "⚠️  WARNING: You are about to OVERWRITE Production ($TARGET_CONTAINER) with Development Data ($SOURCE_CONTAINER)."
echo "Press Ctrl+C to abort, or wait 5 seconds to continue..."
sleep 5

echo "--- Starting Restore: $SOURCE_CONTAINER -> $TARGET_CONTAINER ---"

# 1. Dump Development DB
echo "1. Dumping Development Database ($SOURCE_CONTAINER)..."
docker exec -e PGPASSWORD=$DB_PASSWORD $SOURCE_CONTAINER pg_dump -U $DB_USER $SOURCE_DB_NAME > $BACKUP_FILE

if [ ! -s $BACKUP_FILE ]; then
    echo "Error: Dump failed or empty."
    exit 1
fi

# 2. Terminate connections on Production
echo "2. Terminating connections to Production ($TARGET_CONTAINER)..."
docker exec -e PGPASSWORD=$DB_PASSWORD $TARGET_CONTAINER psql -U $DB_USER -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$TARGET_DB_NAME' AND pid <> pg_backend_pid();"

# 3. Recreate Production DB
echo "3. Recreating Database on Production..."
docker exec -e PGPASSWORD=$DB_PASSWORD $TARGET_CONTAINER psql -U $DB_USER -d postgres -c "DROP DATABASE IF EXISTS $TARGET_DB_NAME;"
docker exec -e PGPASSWORD=$DB_PASSWORD $TARGET_CONTAINER psql -U $DB_USER -d postgres -c "CREATE DATABASE $TARGET_DB_NAME;"

# 4. Restore Data
echo "4. Restoring Data to Production..."
cat $BACKUP_FILE | docker exec -i -e PGPASSWORD=$DB_PASSWORD $TARGET_CONTAINER psql -U $DB_USER $TARGET_DB_NAME

# 5. Cleanup
rm $BACKUP_FILE
echo "--- Restore Complete! ---"
