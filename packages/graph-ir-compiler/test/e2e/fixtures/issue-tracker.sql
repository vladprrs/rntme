CREATE TABLE projection_issue (
  id           INTEGER PRIMARY KEY,
  project_id   INTEGER NOT NULL,
  reporter_id  INTEGER NOT NULL,
  assignee_id  INTEGER,
  sprint_id    INTEGER,
  title        TEXT    NOT NULL,
  priority     TEXT    NOT NULL,
  story_points INTEGER NOT NULL,
  status       TEXT    NOT NULL,
  resolved_at  TEXT,
  created_at   TEXT    NOT NULL,
  last_event_id      TEXT    NOT NULL,
  last_event_version INTEGER NOT NULL,
  applied_at         TEXT    NOT NULL
);
