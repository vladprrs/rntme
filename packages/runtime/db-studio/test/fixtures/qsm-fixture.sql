CREATE TABLE projection_issue (
  issueId INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL
);
INSERT INTO projection_issue VALUES (7001, 'first', 'open');
INSERT INTO projection_issue VALUES (7002, 'second', 'draft');
CREATE TABLE user_mirror (userId INTEGER PRIMARY KEY, username TEXT);
INSERT INTO user_mirror VALUES (1, 'alice');
