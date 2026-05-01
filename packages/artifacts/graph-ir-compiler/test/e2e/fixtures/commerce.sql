CREATE TABLE categories (
  id     INTEGER PRIMARY KEY,
  name   TEXT,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE products (
  id          INTEGER PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  name        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE orders (
  id         INTEGER PRIMARY KEY,
  created_at TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE order_items (
  id         INTEGER PRIMARY KEY,
  order_id   INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  unit_price NUMERIC NOT NULL,
  quantity   INTEGER NOT NULL,
  status     TEXT NOT NULL DEFAULT 'active'
);

INSERT INTO categories (id, name) VALUES
  (1, 'Electronics'),
  (2, 'Books'),
  (3, NULL);

INSERT INTO products (id, category_id, name) VALUES
  (10, 1, 'Phone'),
  (11, 1, 'Laptop'),
  (20, 2, 'Novel'),
  (21, 2, 'Manual'),
  (30, 3, 'Misc');

INSERT INTO orders (id, created_at) VALUES
  (100, '2026-01-05T10:00:00Z'),
  (101, '2026-02-01T11:00:00Z'),
  (102, '2026-03-15T12:00:00Z');

INSERT INTO order_items (id, order_id, product_id, unit_price, quantity) VALUES
  (1, 100, 10, 500.00, 1),
  (2, 100, 20, 20.00, 2),
  (3, 101, 11, 1500.00, 1),
  (4, 101, 21, 15.00, 3),
  (5, 102, 30, 5.00, 4),
  (6, 102, 11, 1400.00, 1);
