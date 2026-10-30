CREATE TABLE publications (
  id uuid PRIMARY KEY REFERENCES submissions(id),
  title text NOT NULL,
  domain text NOT NULL,
  format text NOT NULL,
  author text NOT NULL,
  source text NOT NULL,
  body text NOT NULL,
  published_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  source_revision integer NOT NULL,
  FOREIGN KEY (id, source_revision) REFERENCES submission_events(submission_id, revision)
);
CREATE TABLE publication_files (
  submission_id uuid NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  position smallint NOT NULL,
  PRIMARY KEY (submission_id, position),
  FOREIGN KEY (submission_id, position) REFERENCES attachments(submission_id, position)
);
CREATE VIEW published_files WITH (security_barrier = true) AS
  SELECT a.* FROM attachments a JOIN publication_files p USING (submission_id, position);
CREATE TABLE publication_events (
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  submission_id uuid NOT NULL REFERENCES submissions(id),
  action text NOT NULL CHECK (action IN ('publish','withdraw')),
  actor text NOT NULL DEFAULT session_user,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
GRANT SELECT ON publications, published_files TO standard_submitter;
