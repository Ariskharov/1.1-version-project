-- Таблица объявлений для личного кабинета (только добавление, существующие таблицы не трогаем)
CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) DEFAULT '',
    message TEXT NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'urgent',
    "expiresAt" TIMESTAMPTZ NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    image VARCHAR(500) DEFAULT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "createdBy" INTEGER NULL
);

CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements ("isActive", type);