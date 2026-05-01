CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL
);
INSERT INTO events VALUES (1, 'issue-7001', 1, 'reported', '{"title":"x"}');
INSERT INTO events VALUES (2, 'issue-7001', 2, 'submitted', '{}');
CREATE TABLE _publish_cursor (cursor INTEGER NOT NULL);
INSERT INTO _publish_cursor VALUES (2);
