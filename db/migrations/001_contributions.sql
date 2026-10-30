REVOKE CREATE ON SCHEMA public FROM PUBLIC;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'standard_submitter') THEN
    CREATE ROLE standard_submitter NOLOGIN;
  END IF;
END $$;

CREATE TABLE submissions (
  id uuid PRIMARY KEY,
  owner_hash text NOT NULL CHECK (owner_hash ~ '^[a-f0-9]{64}$'),
  request_key uuid NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  domain text NOT NULL CHECK (domain IN ('notes','company-analysis','people','healthcare','education','operations','other')),
  kind text NOT NULL CHECK (kind IN ('observation','improvement','new-domain','documentation')),
  source text NOT NULL CHECK (source IN ('real','synthetic','reference')),
  format text NOT NULL CHECK (format IN ('experience','insight','mow','prd','sop','bundle')),
  author text NOT NULL DEFAULT '' CHECK (length(author) <= 80),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 100),
  role text NOT NULL CHECK (length(btrim(role)) BETWEEN 1 AND 80),
  context text NOT NULL CHECK (length(btrim(context)) BETWEEN 1 AND 12000),
  rule text NOT NULL CHECK (length(btrim(rule)) BETWEEN 1 AND 3000),
  verification text NOT NULL CHECK (length(btrim(verification)) BETWEEN 1 AND 3000),
  reference_text text NOT NULL CHECK (length(reference_text) <= 500),
  consent_version text NOT NULL CHECK (consent_version = '2026-10-30'),
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','reviewing','accepted','declined')),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  review_note text NOT NULL DEFAULT '' CHECK (length(review_note) <= 3000),
  UNIQUE (owner_hash, request_key)
);
CREATE INDEX submissions_queue ON submissions (status, received_at, id);

-- shortcut: bounded files live in PostgreSQL for atomic writes/backups; move to object storage when volume warrants it.
CREATE TABLE attachments (
  submission_id uuid NOT NULL REFERENCES submissions(id),
  position smallint NOT NULL CHECK (position BETWEEN 0 AND 2),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120 AND name !~ '[[:cntrl:]/\\]'),
  media_type text NOT NULL CHECK (media_type IN ('text/plain','text/markdown','application/pdf','image/png','image/jpeg')),
  bytes bytea NOT NULL CHECK (octet_length(bytes) BETWEEN 1 AND 2097152),
  sha256 text NOT NULL CHECK (sha256 = encode(sha256(bytes), 'hex')),
  PRIMARY KEY (submission_id, position)
);

CREATE TABLE submission_events (
  submission_id uuid NOT NULL REFERENCES submissions(id),
  revision integer NOT NULL,
  status text NOT NULL,
  note text NOT NULL,
  actor text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (submission_id, revision)
);

CREATE FUNCTION guard_submission() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF (to_jsonb(NEW) - ARRAY['status','revision','review_note']) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['status','revision','review_note']) THEN
    RAISE EXCEPTION 'Original submission is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.revision <> OLD.revision + 1 OR NEW.review_note = '' OR NOT (
    (OLD.status = 'received' AND NEW.status IN ('reviewing','declined')) OR
    (OLD.status = 'reviewing' AND NEW.status IN ('accepted','declined')) OR
    (OLD.status IN ('accepted','declined') AND NEW.status = 'reviewing')
  ) THEN RAISE EXCEPTION 'Invalid review transition or revision' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER submission_guard BEFORE UPDATE ON submissions FOR EACH ROW EXECUTE FUNCTION guard_submission();

CREATE FUNCTION record_submission_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$ BEGIN
  INSERT INTO public.submission_events(submission_id,revision,status,note,actor)
    VALUES (NEW.id,NEW.revision,NEW.status,NEW.review_note,session_user);
  RETURN NEW;
END $$;
CREATE TRIGGER submission_event AFTER INSERT OR UPDATE ON submissions FOR EACH ROW EXECUTE FUNCTION record_submission_event();

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_submission ON submissions TO standard_submitter
  USING (owner_hash = current_setting('standard.owner_hash', true))
  WITH CHECK (owner_hash = current_setting('standard.owner_hash', true) AND status = 'received' AND revision = 0 AND review_note = '');
CREATE POLICY own_attachment ON attachments TO standard_submitter
  USING (EXISTS (SELECT FROM submissions WHERE id = submission_id))
  WITH CHECK (EXISTS (SELECT FROM submissions WHERE id = submission_id AND status = 'received'));
CREATE POLICY own_event ON submission_events FOR SELECT TO standard_submitter
  USING (EXISTS (SELECT FROM submissions WHERE id = submission_id));
GRANT USAGE ON SCHEMA public TO standard_submitter;
GRANT SELECT, INSERT ON submissions, attachments TO standard_submitter;
GRANT SELECT ON submission_events, schema_migrations TO standard_submitter;

CREATE TABLE submission_limits (
  bucket text PRIMARY KEY,
  starts_at timestamptz NOT NULL,
  count integer NOT NULL CHECK (count > 0)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON submission_limits TO standard_submitter;
