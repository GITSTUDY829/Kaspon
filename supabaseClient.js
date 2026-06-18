import { createClient } from '@supabase/supabase-js';

/* ═══════════════════════════════════════════════════════════════
   חיבור ל-Supabase — הפרטים מקובעים כאן, מוכן לשימוש.
   ה-anon key בטוח לפרסום ציבורי — RLS מגן על הנתונים.
   הכתובת והמפתח שייכים לאותו פרויקט (xtegedcvuwqpzqpjodlo).
   ═══════════════════════════════════════════════════════════════ */
export const KASPON_URL = "https://xtegedcvuwqpzqpjodlo.supabase.co";
export const KASPON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0ZWdlZGN2dXdxcHpxcGpvZGxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3ODI2OTMsImV4cCI6MjA5NzM1ODY5M30.cfhnZAF-ck1TF3-rdc5b1YWwz99FHVOknHUzs6cBxns";
/* ═══════════════════════════════════════════════════════════════ */

const OPTS = { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } };

// הפרטים המקובעים למעלה משמשים תמיד; localStorage הוא רק גיבוי אם ריקים.
const u = KASPON_URL || localStorage.getItem('sb_url') || '';
const k = KASPON_KEY || localStorage.getItem('sb_key') || '';

export let sb = (u && k) ? createClient(u, k, OPTS) : null;
export const HAS_BAKED_CONFIG = !!(KASPON_URL && KASPON_KEY);
export function initClient(url, key) { sb = createClient(url, key, OPTS); return sb; }
