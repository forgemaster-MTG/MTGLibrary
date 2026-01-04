#!/bin/bash

# Configuration
# Container Names
PROD_CONTAINER="postgres"
DEV_CONTAINER="postgres-dev"

# Database Credentials
DB_USER="admin"
DB_PASSWORD="Pass4Kincaid!"
DB_NAME="mtg_postgres_db"
DEV_DB_NAME="mtg_postgres_db_dev"

# Timestamp for Backup
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/tmp"
PROD_BACKUP_FILE="$BACKUP_DIR/prod_backup_safety_${DATE}.sql"
DEV_DUMP_FILE="$BACKUP_DIR/dev_dump_deploy_${DATE}.sql"

echo "=============================================="
echo "   STARTING DEPLOYMENT: DEV -> PROD"
echo "=============================================="

# 1. Safety Backup of Production
echo "[1/4] Creating Safety Backup of current Production DB..."
docker exec -e PGPASSWORD=$DB_PASSWORD $PROD_CONTAINER pg_dump -U $DB_USER $DB_NAME > $PROD_BACKUP_FILE

if [ -s $PROD_BACKUP_FILE ]; then
    echo "   -> Backup saved to: $PROD_BACKUP_FILE"
else
    echo "   -> ERROR: Production backup failed. Aborting deployment."
    exit 1
fi

# 2. Dump Development Database
echo "[2/4] Dumping Development Database..."
docker exec -e PGPASSWORD=$DB_PASSWORD $DEV_CONTAINER pg_dump -U $DB_USER $DEV_DB_NAME > $DEV_DUMP_FILE

if [ -s $DEV_DUMP_FILE ]; then
    echo "   -> Dev dump successful."
else
    echo "   -> ERROR: Development dump failed. Aborting."
    exit 1
fi

# 3. Recreate Production Database
echo "[3/4] Recreating Production Database (Drop & Create)..."

# Terminate connections
docker exec -e PGPASSWORD=$DB_PASSWORD $PROD_CONTAINER psql -U $DB_USER -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" > /dev/null 2>&1

# Drop and Create
docker exec -e PGPASSWORD=$DB_PASSWORD $PROD_CONTAINER psql -U $DB_USER -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"
docker exec -e PGPASSWORD=$DB_PASSWORD $PROD_CONTAINER psql -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;"

# 4. Restore Dev Data to Production
echo "[4/4] Deploying Dev Data to Production..."
cat $DEV_DUMP_FILE | docker exec -i -e PGPASSWORD=$DB_PASSWORD $PROD_CONTAINER psql -U $DB_USER $DB_NAME > /dev/null

# Clean up dev dump (keep prod backup just in case)
rm $DEV_DUMP_FILE

echo "=============================================="
echo "   DEPLOYMENT COMPLETE"
echo "=============================================="
echo "safety backup retained at: $PROD_BACKUP_FILE"
