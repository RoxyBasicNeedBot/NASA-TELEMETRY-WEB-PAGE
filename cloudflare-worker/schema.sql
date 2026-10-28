-- =============================================================================
-- SINGULARITY CubeSat Telemetry D1 SQLite Schema
-- Execute with: npx wrangler d1 execute singularity-db --file=./schema.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS telemetry (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          INTEGER NOT NULL,
  mission_id  TEXT    NOT NULL DEFAULT 'ORBITRA',
  device_id   TEXT    NOT NULL DEFAULT 'esp8266-rx',
  sensor_id   TEXT    NOT NULL,
  field_key   TEXT    NOT NULL,
  value       REAL    NOT NULL,
  packet_no   INTEGER,
  quality     TEXT    NOT NULL DEFAULT 'ok'
);

CREATE INDEX IF NOT EXISTS idx_telemetry_sensor_field_ts
  ON telemetry(sensor_id, field_key, ts);

CREATE INDEX IF NOT EXISTS idx_telemetry_ts
  ON telemetry(ts);

CREATE INDEX IF NOT EXISTS idx_telemetry_mission
  ON telemetry(mission_id, ts);

CREATE TABLE IF NOT EXISTS layouts (
  id          TEXT    PRIMARY KEY,
  name        TEXT    NOT NULL,
  is_default  INTEGER NOT NULL DEFAULT 0,
  data        TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
