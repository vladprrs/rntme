CREATE TABLE users (
  id        INTEGER PRIMARY KEY,
  username  TEXT NOT NULL UNIQUE,
  email     TEXT NOT NULL,
  role      TEXT NOT NULL,
  joined_at TEXT NOT NULL
);

CREATE TABLE projects (
  id         INTEGER PRIMARY KEY,
  key        TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  lead_id    INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE sprints (
  id         INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  name       TEXT NOT NULL,
  goal       TEXT,
  starts_at  TEXT NOT NULL,
  ends_at    TEXT NOT NULL
);

CREATE TABLE issues (
  id           INTEGER PRIMARY KEY,
  project_id   INTEGER NOT NULL REFERENCES projects(id),
  reporter_id  INTEGER NOT NULL REFERENCES users(id),
  assignee_id  INTEGER REFERENCES users(id),
  sprint_id    INTEGER REFERENCES sprints(id),
  title        TEXT NOT NULL,
  status       TEXT NOT NULL,
  priority     TEXT NOT NULL,
  story_points INTEGER NOT NULL,
  created_at   TEXT NOT NULL,
  resolved_at  TEXT
);

CREATE INDEX idx_issues_project ON issues(project_id);
CREATE INDEX idx_issues_sprint  ON issues(sprint_id);
CREATE INDEX idx_issues_status  ON issues(status);
