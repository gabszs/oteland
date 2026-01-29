INSERT INTO products (name, description, price, sku, quantity, active, created_at, updated_at)
SELECT 'Notebook Dell Inspiron', 'Notebook Dell Inspiron 15, 16GB RAM, 512GB SSD', 4299.90, 'NB-DELL-001', 25, true, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'NB-DELL-001');

INSERT INTO products (name, description, price, sku, quantity, active, created_at, updated_at)
SELECT 'Monitor LG 27"', 'Monitor LG UltraWide 27" IPS Full HD', 1299.90, 'MN-LG-001', 40, true, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MN-LG-001');

INSERT INTO products (name, description, price, sku, quantity, active, created_at, updated_at)
SELECT 'Teclado Mecânico Redragon', 'Teclado Mecânico Redragon Kumara RGB, Switch Brown', 249.90, 'KB-RD-001', 100, true, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'KB-RD-001');

INSERT INTO products (name, description, price, sku, quantity, active, created_at, updated_at)
SELECT 'Mouse Logitech MX Master 3', 'Mouse sem fio Logitech MX Master 3, USB-C, Bluetooth', 599.90, 'MS-LG-001', 60, true, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'MS-LG-001');

INSERT INTO products (name, description, price, sku, quantity, active, created_at, updated_at)
SELECT 'Headset HyperX Cloud II', 'Headset Gamer HyperX Cloud II, 7.1 Surround', 449.90, 'HS-HX-001', 35, true, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = 'HS-HX-001');
