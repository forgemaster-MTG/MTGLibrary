#!/bin/bash

# Configuration
# Container Names (Must match your docker-compose container_names)
PROD_CONTAINER="postgres"
STAGING_CONTAINER="postgres-staging"
DEV_CONTAINER="postgres-dev"

# Database Credentials (Should match your .env or docker-compose)
# Database Credentials (Should match your .env or docker-compose)
DB_USER="admin"
DB_PASSWORD="Pass4Kincaid!"
DB_NAME="mtg_postgres_db"

# Timestamp
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/tmp/mtg_backup_${DATE}.sql"

# Function to Sync
sync_db() {
    SOURCE=$1
    TARGET=$2
    TARGET_DB_NAME=$3

    echo "--- Starting Sync: $SOURCE -> $TARGET ---"

    # 1. Dump Production DB (Schema + Data)
    echo "1. Dumping Production Database..."
    # Using -e PGPASSWORD to avoid password prompt
    docker exec -e PGPASSWORD=$DB_PASSWORD $SOURCE pg_dump -U $DB_USER $DB_NAME > $BACKUP_FILE

    if [ ! -s $BACKUP_FILE ]; then
        echo "Error: Dump failed or empty."
        exit 1
    fi

    # 2. Terminate connections to Target DB (Required to drop/restore)
    echo "2. Terminating connections to $TARGET..."
    docker exec -e PGPASSWORD=$DB_PASSWORD $TARGET psql -U $DB_USER -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$TARGET_DB_NAME' AND pid <> pg_backend_pid();"

    # 3. Drop and Recreate Target DB (Clean Slate)
    echo "3. Recreating Database on $TARGET..."
    docker exec -e PGPASSWORD=$DB_PASSWORD $TARGET psql -U $DB_USER -d postgres -c "DROP DATABASE IF EXISTS $TARGET_DB_NAME;"
    docker exec -e PGPASSWORD=$DB_PASSWORD $TARGET psql -U $DB_USER -d postgres -c "CREATE DATABASE $TARGET_DB_NAME;"

    # 4. Restore Data
    echo "4. Restoring Data to $TARGET..."
    cat $BACKUP_FILE | docker exec -i -e PGPASSWORD=$DB_PASSWORD $TARGET psql -U $DB_USER $TARGET_DB_NAME

    # Authorization cleanup (in case role names differ, usually fine if identical)
    
    # 5. Cleanup
    rm $BACKUP_FILE
    echo "--- Sync Complete! ---"
}

# Command Line Arguments
case "$1" in
    staging)
        sync_db $PROD_CONTAINER $STAGING_CONTAINER "mtg_postgres_db_staging"
        ;;
    dev)
        sync_db $PROD_CONTAINER $DEV_CONTAINER "mtg_postgres_db_dev"
        ;;
    all)
        sync_db $PROD_CONTAINER $STAGING_CONTAINER "mtg_postgres_db_staging"
        sync_db $PROD_CONTAINER $DEV_CONTAINER "mtg_postgres_db_dev"
        ;;
    *)
        echo "Usage: ./sync-db.sh [staging|dev|all]"
        exit 1
        ;;
esac
