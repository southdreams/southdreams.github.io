/*
  # Digital Design Factory Schema

  ## Summary
  Creates the full database schema for the SouthDreams Digital Design Factory.
  This system tracks asset packs, individual assets, worker devices, and export jobs.

  ## New Tables

  ### asset_packs
  Stores metadata for each design asset pack.
  - id: UUID primary key
  - name: Pack name (e.g., "rust-textures-vol1")
  - description: Optional description
  - tags: Array of use-case tags (pod, gamedev-godot, gamedev-unity, web, social, print)
  - status: building | active | archived
  - created_at / updated_at: timestamps

  ### assets
  Individual files/images within a pack.
  - id: UUID primary key
  - pack_id: Foreign key to asset_packs (cascades on delete)
  - filename: Original filename
  - type: Asset type (texture, sprite, icon, pattern, etc.)
  - dimensions: e.g., "2048x2048"
  - file_size: Size in bytes
  - preview_url: URL to thumbnail or preview image
  - created_at: timestamp

  ### workers
  Represents connected worker devices (Android phones, WSL2, desktops).
  Workers update their status via heartbeat (curl/Python script every 60s).
  - id: UUID primary key
  - name: Human-readable device name
  - type: android | wsl2 | desktop
  - status: online | idle | offline
  - last_seen: Last heartbeat timestamp
  - created_at: timestamp

  ### export_jobs
  Tracks export pipeline jobs. Workers poll for 'queued' jobs, claim them,
  process images with FOSS tools (ImageMagick, FFMPEG), then update status.
  - id: UUID primary key
  - pack_id: Foreign key to asset_packs
  - format: Export format spec ID (matches FORMAT_SPECS in factory-app.js)
  - status: queued | running | done | failed | cancelled
  - output_url: Set when export completes successfully
  - worker_id: Which worker processed the job (nullable)
  - created_at / updated_at: timestamps

  ## Security
  - RLS enabled on all tables
  - Development mode: anon key has full access (tighten before production)
  - Indexes on pack_id foreign keys and export_jobs.status for query performance

  ## Notes
  1. Worker heartbeat: workers run a shell/Python script that PATCHes their status every 60s
  2. Export protocol: worker polls queued jobs, claims with status=running, completes with status=done
  3. All tags stored as native PostgreSQL TEXT[] arrays for efficient filtering
  4. ON DELETE CASCADE on assets and export_jobs ensures no orphaned records
*/

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS asset_packs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  tags        TEXT[] DEFAULT '{}',
  status      TEXT NOT NULL DEFAULT 'building'
                CHECK (status IN ('building','active','archived')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id     UUID NOT NULL REFERENCES asset_packs(id) ON DELETE CASCADE,
  filename    TEXT NOT NULL,
  type        TEXT DEFAULT '',
  dimensions  TEXT DEFAULT '',
  file_size   BIGINT DEFAULT 0,
  preview_url TEXT DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_pack_id ON assets(pack_id);

CREATE TABLE IF NOT EXISTS workers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'desktop'
                CHECK (type IN ('android','wsl2','desktop')),
  status      TEXT NOT NULL DEFAULT 'offline'
                CHECK (status IN ('online','idle','offline')),
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS export_jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id     UUID NOT NULL REFERENCES asset_packs(id) ON DELETE CASCADE,
  format      TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued','running','done','failed','cancelled')),
  output_url  TEXT DEFAULT '',
  worker_id   UUID REFERENCES workers(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_export_jobs_pack_id ON export_jobs(pack_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status  ON export_jobs(status);

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_packs_updated_at'
  ) THEN
    CREATE TRIGGER trg_packs_updated_at
      BEFORE UPDATE ON asset_packs
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_exports_updated_at'
  ) THEN
    CREATE TRIGGER trg_exports_updated_at
      BEFORE UPDATE ON export_jobs
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
END $$;

ALTER TABLE asset_packs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_jobs   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_packs"   ON asset_packs  FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_packs"   ON asset_packs  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_packs"   ON asset_packs  FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_packs"   ON asset_packs  FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_assets"  ON assets        FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_assets"  ON assets        FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_assets"  ON assets        FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_assets"  ON assets        FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_workers" ON workers       FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_workers" ON workers       FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_workers" ON workers       FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_workers" ON workers       FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_exports" ON export_jobs   FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_exports" ON export_jobs   FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_exports" ON export_jobs   FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_exports" ON export_jobs   FOR DELETE TO anon USING (true);
