CREATE TABLE IF NOT EXISTS categories (
  id text PRIMARY KEY,
  name varchar(40) NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  CONSTRAINT categories_name_length CHECK (char_length(name) BETWEEN 2 AND 40)
);

CREATE UNIQUE INDEX IF NOT EXISTS categories_name_casefold_idx ON categories(lower(name));

CREATE TABLE IF NOT EXISTS magazines (
  id text PRIMARY KEY,
  title varchar(60) NOT NULL,
  category_id text NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  description varchar(180) NOT NULL,
  price numeric(10, 2) NOT NULL CHECK (price > 0 AND price <= 1000000),
  issue varchar(30) NOT NULL,
  cover text NOT NULL,
  cover_title varchar(60) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT magazines_cover_length CHECK (char_length(cover) <= 4194304)
);

CREATE INDEX IF NOT EXISTS magazines_sort_order_idx ON magazines(sort_order, created_at);

CREATE TABLE IF NOT EXISTS admin_credentials (
  id text PRIMARY KEY CHECK (id = 'admin'),
  username varchar(32) NOT NULL UNIQUE,
  salt text NOT NULL CHECK (salt ~ '^[a-f0-9]{32}$'),
  password_hash text NOT NULL CHECK (password_hash ~ '^[a-f0-9]{128}$'),
  must_change_password boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx ON admin_sessions(expires_at);

CREATE TABLE IF NOT EXISTS login_attempts (
  client_ip text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz
);

INSERT INTO categories (id, name, sort_order) VALUES
  ('moda-autoral', 'Moda autoral', 0),
  ('tendencias', 'Tendências', 1),
  ('streetwear', 'Streetwear', 2),
  ('beleza', 'Beleza', 3),
  ('sustentabilidade', 'Sustentabilidade', 4)
ON CONFLICT (id) DO NOTHING;

