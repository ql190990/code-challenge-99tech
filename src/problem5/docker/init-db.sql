-- Initialisation script executed once when the PostgreSQL container is
-- first created (the `problem5_pg_data` volume is empty). Runs inside the
-- `problem5` database; additional databases are created explicitly below.
--
-- If you already have a running container from a previous revision and do
-- not see the `problem5_test` database, bring the stack down with
-- `docker compose down -v` to reset the named volume, then `up -d` again.

CREATE DATABASE problem5_test;
