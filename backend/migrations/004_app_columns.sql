-- Колонки, которые интерфейс уже пишет, но старая схема могла не содержать.
-- Без них контроллер молча выбрасывает поле, и данные пропадают при сохранении.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "position" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "description" TEXT;

ALTER TABLE "workSessions" ADD COLUMN IF NOT EXISTS "endDate" TEXT;
ALTER TABLE "workSessions" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "workSessions" ADD COLUMN IF NOT EXISTS "editedBy" INTEGER;

ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "subtotal" NUMERIC;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "discountAmount" NUMERIC;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "discountPercent" NUMERIC;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "taxAmount" NUMERIC;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "total" NUMERIC;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "contract_no" TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "contract_number" TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "contract_city" TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "contract_date" TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "updatedAt" TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "description_for_order" TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "order_color" TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "buyer_rep_title" TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "buyer_rep_name" TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "buyer_basis" TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "buyer_inn" TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "buyer_bank" TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "buyer_bik" TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "buyer_account" TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "buyer_sign" TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "procurement_basis" TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "delivery_days" TEXT;

UPDATE "order"
SET "contract_no" = "contract_number"
WHERE ("contract_no" IS NULL OR btrim("contract_no") = '')
  AND "contract_number" IS NOT NULL
  AND btrim("contract_number") <> '';
