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

INSERT INTO magazines (id, title, category_id, description, price, issue, cover, cover_title, sort_order) VALUES
  ('forma-livre', 'Forma livre', 'moda-autoral', 'Criadores independentes que reinventam formas, materiais e o jeito de vestir.', 48, 'Edição 12', 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=800&q=85', 'FORMA<br>LIVRE', 0),
  ('estilo-em-movimento', 'Estilo em movimento', 'tendencias', 'Uma leitura do que está mudando nas passarelas, nas ruas e no nosso guarda-roupa.', 42, 'Edição 08', 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=800&q=85', 'ESTILO<br>EM MOV.', 1),
  ('rua-e-identidade', 'Rua & identidade', 'streetwear', 'A moda urbana como linguagem: pessoas, cenas e referências que criam movimento.', 54, 'Edição 05', 'https://images.unsplash.com/photo-1523398002811-999ca8dec234?auto=format&fit=crop&w=800&q=85', 'RUA &<br>IDENTIDADE', 2),
  ('ritual-de-beleza', 'Ritual de beleza', 'beleza', 'Beleza sem regras: autocuidado, expressão e novas conversas sobre imagem.', 46, 'Edição 03', 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=85', 'RITUAL<br>DE BELEZA', 3),
  ('vestir-o-tempo', 'Vestir o tempo', 'sustentabilidade', 'Consumo consciente, peças duráveis e caminhos para uma moda com mais cuidado.', 39, 'Edição 07', 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=85', 'VESTIR<br>O TEMPO', 4),
  ('arquivo-da-moda', 'Arquivo da moda', 'moda-autoral', 'Ícones, movimentos e imagens que ajudam a entender como o estilo se transforma.', 44, 'Edição 02', 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=85', 'ARQUIVO<br>DA MODA', 5)
ON CONFLICT (id) DO NOTHING;
