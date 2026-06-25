-- ═══════════════════════════════════════════════════════════════════════
-- KASPON — הקמת בסיס הנתונים (קובץ מאוחד)
-- מריצים פעם אחת ב-Supabase → SQL Editor
--
-- הקובץ הזה יוצר את כל הסכמה במכה אחת: שתי הטבלאות (profiles + transactions),
-- האינדקסים, מערכת אישור המשתמשים (טריגר), ו-Row Level Security מלא.
-- תואם בדיוק לתרשים ה-ERD שב-README.
-- ═══════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────
-- 1. טבלת PROFILES — שורה לכל משתמש, עם דגל אישור מנהל
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  approved    BOOLEAN      NOT NULL DEFAULT FALSE,   -- false = ממתין לאישור מנהל
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- ───────────────────────────────────────────────────────────────────────
-- 2. טבלת TRANSACTIONS — כל עסקה, משויכת למשתמש דרך user_id
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id               BIGSERIAL    PRIMARY KEY,
  user_id          UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant         TEXT         NOT NULL CHECK (char_length(merchant) <= 200),
  amount           DECIMAL(10,2) NOT NULL,
  currency         TEXT         NOT NULL DEFAULT 'ILS' CHECK (char_length(currency) <= 4),
  date             DATE         NOT NULL DEFAULT CURRENT_DATE,
  time             TEXT         CHECK (time ~ '^\d{2}:\d{2}$' OR time IS NULL),
  method           TEXT         NOT NULL DEFAULT 'Apple Pay' CHECK (char_length(method) <= 50),
  category         TEXT         CHECK (category IN (
                      'food','restaurants','transport','fuel','health','fitness',
                      'beauty','clothing','shopping','home','tech','entertainment',
                      'travel','kids','education','pets','gifts','bills','insurance',
                      'fees','income','other'
                   ) OR category IS NULL),
  location_name    TEXT         CHECK (char_length(location_name) <= 200),
  latitude         DECIMAL(9,6) CHECK (latitude  BETWEEN -90  AND 90),
  longitude        DECIMAL(9,6) CHECK (longitude BETWEEN -180 AND 180),
  notes            TEXT         CHECK (char_length(notes) <= 500),
  raw_notification TEXT         CHECK (char_length(raw_notification) <= 1000),
  source           TEXT         DEFAULT 'shortcut' CHECK (source IN ('shortcut','manual','import')),

  -- ── נתוני מטבע זר (המרה אוטומטית לשקלים) ──
  orig_amount      DECIMAL(12,2),   -- הסכום המקורי לפני המרה
  orig_currency    TEXT,            -- המטבע המקורי (USD, EUR...)
  fx_rate          DECIMAL(14,6),   -- שער ההמרה ששימש
  fx_source        TEXT,            -- מקור השער (Frankfurter / ECB)

  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- ───────────────────────────────────────────────────────────────────────
-- 3. אינדקסים — שאילתות מהירות לכל משתמש
-- ───────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tx_user_date     ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_tx_user_category ON transactions(user_id, category);
CREATE INDEX IF NOT EXISTS idx_tx_user_method   ON transactions(user_id, method);


-- ───────────────────────────────────────────────────────────────────────
-- 4. יצירת PROFILE אוטומטית בעת הרשמה
--    כל משתמש חדש נכנס אוטומטית למצב "ממתין לאישור" (approved=false)
-- ───────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, approved)
  VALUES (NEW.id, NEW.email, FALSE)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ───────────────────────────────────────────────────────────────────────
-- 5. ROW LEVEL SECURITY — הלב של הפרטיות
-- ───────────────────────────────────────────────────────────────────────
ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- profiles: כל משתמש קורא רק את השורה שלו
DROP POLICY IF EXISTS "own_profile" ON profiles;
CREATE POLICY "own_profile" ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- transactions: רק הבעלים — ורק אם אושר — ניגש לשורות שלו
DROP POLICY IF EXISTS "owner_only"      ON transactions;
DROP POLICY IF EXISTS "personal_access" ON transactions;
CREATE POLICY "owner_only" ON transactions
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.approved = TRUE)
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.approved = TRUE)
  );


-- ───────────────────────────────────────────────────────────────────────
-- 6. מניעת הסלמת הרשאות — שלילת כתיבה מ-anon ומ-public
-- ───────────────────────────────────────────────────────────────────────
REVOKE INSERT, UPDATE, DELETE ON transactions FROM anon;
REVOKE INSERT, UPDATE, DELETE ON transactions FROM public;
REVOKE INSERT, UPDATE, DELETE ON profiles     FROM anon;
REVOKE INSERT, UPDATE, DELETE ON profiles     FROM public;


-- ───────────────────────────────────────────────────────────────────────
-- 7. אימות — אמור להחזיר את שתי המדיניות (owner_only, own_profile)
-- ───────────────────────────────────────────────────────────────────────
SELECT schemaname, tablename, policyname, cmd
FROM   pg_policies
WHERE  tablename IN ('transactions','profiles')
ORDER  BY tablename, policyname;
