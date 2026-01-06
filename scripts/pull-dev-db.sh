#!/bin/bash

# Configuration
SOURCE_HOST="10.0.0.27"
SOURCE_PORT="6470"
SOURCE_DB="mtg_postgres_db_dev"

TARGET_CONTAINER="mtg-postgres-prod"
TARGET_DB="mtg_postgres_db"

DB_USER="admin"
DB_PASSWORD="Pass4Kincaid!"

echo "=============================================="
echo "   DUPLICATING DB: $SOURCE_HOST -> $TARGET_CONTAINER"
echo "=============================================="

# 1. Terminate connections to Target DB
echo "[1/4] Terminating connections to $TARGET_DB..."
docker exec -e PGPASSWORD=$DB_PASSWORD $TARGET_CONTAINER psql -U $DB_USER -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$TARGET_DB' AND pid <> pg_backend_pid();"

# 2. Aggressive Schema Cleanup
echo "[2/4] Wiping public schema in $TARGET_DB..."
docker exec -e PGPASSWORD=$DB_PASSWORD $TARGET_CONTAINER psql -U $DB_USER -d $TARGET_DB -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO $DB_USER; GRANT ALL ON SCHEMA public TO public;"

# 3. Stream Dump from Dev to Prod with clean flags
echo "[3/4] Streaming data from Dev ($SOURCE_HOST) to Prod ($TARGET_CONTAINER)..."
docker exec -e PGPASSWORD=$DB_PASSWORD $TARGET_CONTAINER pg_dump -h $SOURCE_HOST -p $SOURCE_PORT -U $DB_USER --no-owner --no-privileges $SOURCE_DB | docker exec -i -e PGPASSWORD=$DB_PASSWORD $TARGET_CONTAINER psql -U $DB_USER $TARGET_DB

# 4. Forensic Check
echo "[4/4] Verifying tables in $TARGET_DB..."
docker exec -e PGPASSWORD=$DB_PASSWORD $TARGET_CONTAINER psql -U $DB_USER -d $TARGET_DB -c "\dt"

# Final Status
if [ $? -eq 0 ]; then
    echo "=============================================="
    echo "   SYNC COMPLETE"
    echo "   Please check the table list above."
    echo "=============================================="
else
    echo "=============================================="
    echo "   SYNC FAILED"
    echo "=============================================="
    exit 1
fi
