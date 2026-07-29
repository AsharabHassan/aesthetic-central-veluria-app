-- Aesthetics Central — schema.
--
-- WHY A DATABASE AT ALL. The app currently remembers nothing. Every analysis is
-- computed, shown once, and thrown away; the only durable record is whatever
-- reaches the CRM. That has three costs, and the third is the expensive one:
--
--   1. Nothing can be re-served. Close the tab during the ~2 minute generation
--      and the work is gone, the PDF is never built and no report is emailed.
--   2. Nothing can be measured. There is no way to answer "how many photos are
--      we rejecting", "what does a typical skin score look like", or "which
--      concern drives bookings" — so every tuning decision so far has been made
--      from one or two hand-picked images.
--   3. NOTHING ACCUMULATES. The clinic has exactly one real before/after pair.
--      That, not the model, is the ceiling on how convincing any simulation can
--      ever be. `treatment_results` below is the table that fixes it: real,
--      consented, standardised photos of actual Veluria clients, captured over
--      time, which are both the honest proof to show prospects and the training
--      set if a fine-tuned model is ever wanted.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  full_name       text        NOT NULL,
  email           citext      NOT NULL,
  phone           text,
  goals           text[]      NOT NULL DEFAULT '{}',
  -- Consent is a record, not a boolean on a form: what they agreed to, when,
  -- and the wording they were shown. This is the artefact you need if anyone
  -- ever asks under what basis a face photo was processed.
  marketing_consent      boolean NOT NULL DEFAULT false,
  photo_consent_text     text,
  photo_consent_at       timestamptz,
  utm                    jsonb   NOT NULL DEFAULT '{}'::jsonb,
  crm_contact_id         text
);
CREATE INDEX IF NOT EXISTS leads_email_idx ON leads (email);

-- ---------------------------------------------------------------------------
-- Consultations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS consultations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid REFERENCES leads(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- Object-store keys, never bytes. Postgres is the wrong place for photos.
  selfie_key      text NOT NULL,
  -- The quality verdict that decided whether to spend anything. Stored so the
  -- thresholds can be re-tuned later against real rejections instead of guesses.
  quality_level   text  NOT NULL CHECK (quality_level IN ('pass','warn','block')),
  quality         jsonb NOT NULL DEFAULT '{}'::jsonb,
  face_geometry   jsonb,
  analysis        jsonb,
  overall_from    smallint,
  overall_to      smallint,
  -- Retention: face photos are personal data and there is no reason to keep
  -- them indefinitely. A nightly job deletes objects past this date.
  purge_after     timestamptz NOT NULL DEFAULT now() + interval '90 days'
);
CREATE INDEX IF NOT EXISTS consultations_lead_idx ON consultations (lead_id);
CREATE INDEX IF NOT EXISTS consultations_purge_idx ON consultations (purge_after);

-- ---------------------------------------------------------------------------
-- Generation jobs
-- ---------------------------------------------------------------------------
-- Simulation takes 1-2 minutes. Holding an HTTP request open for that is what
-- makes the browser the single point of failure today. A job row lets the work
-- outlive the tab, be retried, and be measured.
CREATE TABLE IF NOT EXISTS jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid REFERENCES consultations(id) ON DELETE CASCADE,
  kind            text NOT NULL,            -- 'simulate' | 'zone' | 'report'
  area            text,
  status          text NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','running','done','failed','rejected')),
  attempts        smallint NOT NULL DEFAULT 0,
  params          jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- The measured change, and the floor it was judged against. A job that ran
  -- fine but produced nothing visible is 'rejected', not 'done' — the
  -- distinction is the whole reason clients were being shown identical pairs.
  change_score    real,
  result_key      text,
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz
);
CREATE INDEX IF NOT EXISTS jobs_consultation_idx ON jobs (consultation_id);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs (status) WHERE status IN ('queued','running');

-- ---------------------------------------------------------------------------
-- Funnel
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id              bigserial PRIMARY KEY,
  consultation_id uuid REFERENCES consultations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  detail          jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_consultation_idx ON events (consultation_id);
CREATE INDEX IF NOT EXISTS events_name_time_idx ON events (name, occurred_at);

-- ---------------------------------------------------------------------------
-- REAL treatment results — the table that raises the ceiling
-- ---------------------------------------------------------------------------
-- Consented, standardised before/after photographs of actual Veluria clients.
-- Two uses, and both matter more than any model choice:
--   * shown to prospects as genuine proof, which is the only kind that is
--     unambiguously defensible under ASA/CAP rules on before-and-after imagery;
--   * a training set, if a fine-tuned model is ever wanted (20-40 pairs is the
--     practical minimum).
CREATE TABLE IF NOT EXISTS treatment_results (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  product         text NOT NULL,           -- 'silk-skin' | 'ultra-lift' | 'pearl-tone'
  sessions        smallint,
  weeks_elapsed   smallint,
  before_key      text NOT NULL,
  after_key       text NOT NULL,
  areas           text[] NOT NULL DEFAULT '{}',
  skin_tone       text,
  -- Publication is gated on evidence, not on someone remembering to check.
  consent_on_file boolean NOT NULL DEFAULT false,
  consent_ref     text,
  retouched       boolean NOT NULL DEFAULT false,
  approved_by     text,
  publishable     boolean GENERATED ALWAYS AS (consent_on_file AND NOT retouched) STORED,
  notes           text
);
CREATE INDEX IF NOT EXISTS treatment_results_publishable_idx
  ON treatment_results (product) WHERE publishable;
