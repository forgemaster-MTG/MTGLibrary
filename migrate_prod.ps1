$env:NODE_ENV="production"
$env:PGHOST="10.0.0.27"
$env:PGDATABASE="mtg_postgres_db"
$env:PGPORT="6468"

Write-Host "Starting migration on $env:PGHOST..."
try {
    # Using Call operator & to run npx, ensure it's in path or use full path if needed, but npx usually works.
    # Adding --no-interactive if supported by tool, but knex is usually non-interactive.
    npx knex migrate:latest
    Write-Host "Migration command completed."
} catch {
    Write-Error "Migration failed: $_"
    exit 1
}
