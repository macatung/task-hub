# Backup and restore

Back up PostgreSQL with `pg_dump` and persist the `postgres_data`, `redis_data`, and `hub_storage` volumes. Test restores in an isolated environment before upgrading production.

For a restore: stop Hub/worker/scheduler, restore the PostgreSQL dump to an empty database, restore storage, start services, run `php artisan migrate --force`, then verify `/up`, `/api/v1/capabilities`, GitHub OAuth, device pairing, and a structured handoff.
