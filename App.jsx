import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Chart from 'chart.js/auto';
import * as XLSX from 'xlsx';
import { sb, initClient, KASPON_URL, KASPON_KEY } from './supabaseClient.js';
import { CATS, MHE, autocat } from './data.js';

// (פרטי ה-Supabase מוגדרים ב-supabaseClient.js)

const CAT_ORDER = ['food','restaurants','transport','fuel','health','fitness','beauty','clothing','shopping','home','tech','entertainment','travel','kids','education','pets','gifts','bills','insurance','fees','income','other'];
const fmt = n => '₪' + Math.abs(n).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FX_SYM = { USD: '$', EUR: '€', GBP: '£' };
const fmtForeign = (a, c) => (FX_SYM[c] || c + ' ') + Math.abs(a).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// sb מיובא מ-supabaseClient.js

/* תרגום שגיאות Supabase/רשת להודעה ברורה בעברית, לפי סוג התקלה */
function authErr(e) {
  const raw = (e && (e.message || e.error_description || e.msg)) || String(e || '');
  const m = raw.toLowerCase();
  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed') || m.includes('network request failed') || m.includes('typeerror'))
    return 'לא ניתן להתחבר לשרת. בדוק את חיבור האינטרנט — וודא שהפרויקט ב-Supabase פעיל (אם הוא מושהה, היכנס ל-Supabase והפעל אותו מחדש).';
  if (m.includes('invalid login credentials')) return 'אימייל או סיסמה שגויים';
  if (m.includes('email not confirmed')) return 'האימייל עדיין לא אומת — בדוק את תיבת הדואר שלך';
  if (m.includes('already registered') || m.includes('already been registered') || m.includes('user already')) return 'האימייל הזה כבר רשום במערכת — נסה להתחבר';
  if (m.includes('password should be at least') || m.includes('at least 6')) return 'הסיסמה חייבת להיות לפחות 6 תווים';
  if (m.includes('weak password')) return 'הסיסמה חלשה מדי — בחר סיסמה חזקה יותר';
  if (m.includes('unable to validate email') || m.includes('invalid email') || m.includes('invalid format')) return 'כתובת האימייל אינה תקינה';
  if (m.includes('for security purposes') || m.includes('rate limit') || m.includes('too many') || m.includes('over_email_send_rate'))
    return 'יותר מדי ניסיונות — המתן רגע ונסה שוב';
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) return 'ההרשמה סגורה כרגע';
  if (m.includes('email rate limit')) return 'נשלחו יותר מדי אימיילים — נסה שוב מאוחר יותר';
  if (m.includes('not configured') || m.includes('no api key') || m.includes('apikey')) return 'החיבור לשרת לא הוגדר. ודא שהמפתח (anon key) הוזן בקובץ ההגדרות.';
  return raw || 'אירעה שגיאה, נסה שוב';
}

/* ════════════════════ AUTH SCREENS ════════════════════ */

function AuthShell({ icon = '₪', title, sub, children, pills }) {
  return (
    <div className="auth-shell">
      <div className="auth-icon">{icon}</div>
      <div className="auth-title">{title}</div>
      <p className="auth-sub">{sub}</p>
      {children}
      {pills && (
        <div className="sec-pills">
          <span className="sec-pill">TLS 1.3</span>
          <span className="sec-pill">AES-256</span>
          <span className="sec-pill">Auth Required</span>
          <span className="sec-pill">RLS Enforced</span>
        </div>
      )}
    </div>
  );
}

function SetupScreen({ onConnected }) {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function doSetup() {
    setErr('');
    if (!url.trim().startsWith('https://')) { setErr('URL לא תקין — חייב להתחיל עם https://'); return; }
    if (!key.trim().startsWith('eyJ')) { setErr('מפתח לא תקין — חייב להתחיל עם eyJ'); return; }
    setBusy(true);
    try {
      const client = initClient(url.trim(), key.trim());
      const { error } = await client.from('transactions').select('id').limit(1);
      if (error && error.code !== 'PGRST116' && error.code !== '42501') throw new Error(error.message);
      localStorage.setItem('sb_url', url.trim());
      localStorage.setItem('sb_key', key.trim());
      onConnected();
    } catch (e) { setErr(authErr(e)); setBusy(false); }
  }
  return (
    <AuthShell title="כספון" sub="מעקב הוצאות אישי ופרטי לחלוטין" pills>
      <div className="auth-card">
        <h3>חיבור Supabase</h3>
        <div className="field">
          <label>Project URL</label>
          <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" autoComplete="off" spellCheck="false" />
          <div className="hint">Settings → API → Project URL</div>
        </div>
        <div className="field">
          <label>Anon Public Key</label>
          <input type="text" value={key} onChange={e => setKey(e.target.value)} placeholder="eyJhbGciOiJ..." autoComplete="off" spellCheck="false" />
          <div className="hint">Settings → API → anon public</div>
        </div>
        <button className="btn-primary" disabled={busy} onClick={doSetup}>{busy ? 'מתחבר...' : 'המשך לכניסה'}</button>
        <div className="auth-err">{err}</div>
      </div>
    </AuthShell>
  );
}

function LoginScreen({ go }) {
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function doLogin() {
    if (!email.trim() || !pwd) { setErr('יש למלא אימייל וסיסמה'); return; }
    if (!sb) { setErr('החיבור לשרת לא הוגדר. ודא שהמפתח (anon key) הוזן בקובץ ההגדרות.'); return; }
    setErr(''); setBusy(true);
    try {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pwd });
      if (error) { setErr(authErr(error)); setBusy(false); }
      // success → App's auth listener navigates
    } catch (e) { setErr(authErr(e)); setBusy(false); }
  }
  const onKey = e => { if (e.key === 'Enter') doLogin(); };
  return (
    <AuthShell title="ברוך הבא" sub="כניסה מאובטחת לדשבורד האישי שלך">
      <div className="auth-card">
        <h3>כניסה</h3>
        <div className="field">
          <label>כתובת אימייל</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={onKey} placeholder="name@example.com" autoComplete="email" />
        </div>
        <div className="field">
          <label>סיסמה</label>
          <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} onKeyDown={onKey} placeholder="••••••••" autoComplete="current-password" />
        </div>
        <button className="btn-primary" disabled={busy} onClick={doLogin}>{busy ? 'מתחבר...' : 'כניסה מאובטחת'}</button>
        <div className="auth-err">{err}</div>
        <p className="auth-link" style={{ marginTop: '14px' }}><a href="#" onClick={e => { e.preventDefault(); go('forgot'); }}>שכחת סיסמה?</a></p>
        <div className="divider">או</div>
        <button className="btn-ghost" style={{ width: '100%' }} onClick={() => go('register')}>צור חשבון חדש</button>
      </div>
    </AuthShell>
  );
}

function RegisterScreen({ go }) {
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function doRegister() {
    if (!email.trim() || !pwd) { setErr('יש למלא אימייל וסיסמה'); return; }
    if (pwd.length < 8) { setErr('הסיסמה חייבת להיות לפחות 8 תווים'); return; }
    if (pwd !== pwd2) { setErr('הסיסמאות אינן תואמות'); return; }
    if (!sb) { setErr('החיבור לשרת לא הוגדר. ודא שהמפתח (anon key) הוזן בקובץ ההגדרות.'); return; }
    setErr(''); setBusy(true);
    try {
      const { error } = await sb.auth.signUp({ email: email.trim(), password: pwd });
      setBusy(false);
      if (error) { setErr(authErr(error)); return; }
      go('pending');
    } catch (e) { setBusy(false); setErr(authErr(e)); }
  }
  return (
    <AuthShell title="יצירת חשבון" sub="הנתונים שלך יהיו נגישים רק לך">
      <div className="auth-card">
        <h3>חשבון חדש</h3>
        <div className="field">
          <label>כתובת אימייל</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" />
        </div>
        <div className="field">
          <label>סיסמה (מינימום 8 תווים)</label>
          <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} placeholder="בחר סיסמה חזקה" autoComplete="new-password" />
        </div>
        <div className="field">
          <label>אימות סיסמה</label>
          <input type="password" value={pwd2} onChange={e => setPwd2(e.target.value)} placeholder="הזן שוב" autoComplete="new-password" />
        </div>
        <button className="btn-primary" disabled={busy} onClick={doRegister}>{busy ? 'יוצר...' : 'צור חשבון'}</button>
        <div className="auth-err">{err}</div>
        <div className="divider">או</div>
        <button className="btn-ghost" style={{ width: '100%' }} onClick={() => go('login')}>כבר יש לי חשבון</button>
      </div>
    </AuthShell>
  );
}

function ForgotScreen({ go }) {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  async function doForgot() {
    if (!email.trim()) { setMsg({ ok: false, t: 'הזן כתובת אימייל' }); return; }
    if (!sb) { setMsg({ ok: false, t: 'שגיאת חיבור — חזור לדף ההגדרות' }); return; }
    setMsg(null); setBusy(true);
    const redirectTo = location.origin + location.pathname;
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    setBusy(false);
    if (error) setMsg({ ok: false, t: authErr(error) });
    else setMsg({ ok: true, t: '✓ נשלח! בדוק את האימייל (כולל תיקיית ספאם) ולחץ על הקישור.' });
  }
  return (
    <AuthShell title="איפוס סיסמה" sub="הזן את כתובת האימייל שלך ונשלח אליך קישור לבחירת סיסמה חדשה">
      <div className="auth-card">
        <h3>שחזור סיסמה</h3>
        <div className="field">
          <label>כתובת אימייל</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') doForgot(); }} placeholder="name@example.com" autoComplete="email" />
        </div>
        <button className="btn-primary" disabled={busy} onClick={doForgot}>{busy ? 'שולח...' : 'שלח קישור איפוס'}</button>
        <div className="auth-err" style={msg && msg.ok ? { color: 'var(--accent)' } : null}>{msg ? msg.t : ''}</div>
        <div className="divider">או</div>
        <button className="btn-ghost" style={{ width: '100%' }} onClick={() => go('login')}>חזרה לכניסה</button>
      </div>
    </AuthShell>
  );
}

function ResetNewScreen({ go, onSignedIn }) {
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function doReset() {
    if (pwd.length < 8) { setErr('סיסמה חייבת להיות לפחות 8 תווים'); return; }
    if (pwd !== pwd2) { setErr('הסיסמאות אינן תואמות'); return; }
    setErr(''); setBusy(true);
    const { error } = await sb.auth.updateUser({ password: pwd });
    if (error) { setErr(authErr(error)); setBusy(false); return; }
    history.replaceState(null, '', location.origin + location.pathname);
    const { data: { session } } = await sb.auth.getSession();
    if (session) onSignedIn(session); else go('login');
  }
  return (
    <AuthShell title="בחר סיסמה חדשה" sub="כמעט סיימת — הזן סיסמה חדשה לחשבונך">
      <div className="auth-card">
        <h3>סיסמה חדשה</h3>
        <div className="field">
          <label>סיסמה חדשה (מינימום 8 תווים)</label>
          <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} placeholder="בחר סיסמה חזקה" autoComplete="new-password" />
        </div>
        <div className="field">
          <label>אימות סיסמה</label>
          <input type="password" value={pwd2} onChange={e => setPwd2(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') doReset(); }} placeholder="הזן שוב" autoComplete="new-password" />
        </div>
        <button className="btn-primary" disabled={busy} onClick={doReset}>{busy ? 'מעדכן...' : 'עדכן סיסמה'}</button>
        <div className="auth-err">{err}</div>
      </div>
    </AuthShell>
  );
}

function PendingScreen({ go }) {
  async function back() { try { await sb.auth.signOut(); } catch (e) {} go('login'); }
  return (
    <AuthShell icon="⏳" title="החשבון ממתין לאישור" sub="נרשמת בהצלחה! חשבונך יופעל ברגע שהמנהל יאשר אותו.">
      <div className="auth-card">
        <h3>מה עכשיו?</h3>
        <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: 1.7, marginBottom: '18px' }}>המנהל קיבל את בקשתך. לאחר שיאשר את החשבון, היכנס עם האימייל והסיסמה שבחרת.</p>
        <button className="btn-ghost" style={{ width: '100%' }} onClick={back}>חזרה לכניסה</button>
      </div>
    </AuthShell>
  );
}

/* ════════════════════ DASHBOARD PIECES ════════════════════ */

function TxItem({ tx, onEdit }) {
  const cat = CATS[tx.category] || CATS.other;
  const pos = tx.amount > 0;
  const initial = (tx.merchant || '?').trim().charAt(0);
  const foreign = tx.orig_currency && tx.orig_currency !== 'ILS' && tx.orig_amount != null;
  const meta = tx.method === 'Apple Pay' ? (tx.time || '') : ((tx.time || '') + (tx.time ? ' · ' : '') + (tx.method || ''));
  return (
    <div className="txi" onClick={() => onEdit(tx)}>
      <div className="txicon" style={{ background: cat.color + '22', color: cat.color }}>{initial}</div>
      <div className="txinfo">
        <div className="txname">{tx.merchant}</div>
        <div className="txmeta">
          <span className="txdate">{meta}</span>
          <span className="cbadge" style={{ background: cat.color + '22', color: cat.color }}>{cat.label}</span>
          {tx.method === 'Apple Pay' && <span className="apbadge">Apple Pay</span>}
        </div>
      </div>
      <div className="txamt-wrap">
        <div className={'txamt ' + (pos ? 'pos' : 'neg')}>{pos ? '+' : '−'}{fmt(tx.amount)}</div>
        {foreign && <div className="txorig">{fmtForeign(tx.orig_amount, tx.orig_currency)}</div>}
      </div>
    </div>
  );
}

function Empty({ text }) {
  return <div className="empty"><div className="ei">○</div>{text && <p>{text}</p>}</div>;
}

function FilterChips({ catF, setCatF }) {
  const chips = [['all', 'הכל'], ['__ap', 'Apple Pay'], ...CAT_ORDER.map(k => [k, CATS[k].label])];
  return (
    <div className="filters">
      {chips.map(([k, label]) => (
        <button key={k} className={'fc' + (catF === k ? ' active' : '')} onClick={() => setCatF(k)}>{label}</button>
      ))}
    </div>
  );
}

function HomeTab({ txAll, monthLabel, changeMonth, goToday, onEdit, setTab }) {
  const stats = useMemo(() => {
    const exp = txAll.filter(t => t.amount < 0);
    const spent = exp.reduce((s, t) => s + Math.abs(t.amount), 0);
    const apCnt = exp.filter(t => t.method === 'Apple Pay').length;
    const avg = exp.length ? spent / exp.length : 0;
    const refundTx = txAll.filter(t => t.amount > 0);
    const refunds = refundTx.reduce((s, t) => s + t.amount, 0);
    return { spent, apCnt, avg, cnt: txAll.length, refunds, refundCnt: refundTx.length };
  }, [txAll]);
  const recent = txAll.slice(0, 7);
  const catBars = useMemo(() => {
    const byc = {};
    txAll.filter(t => t.amount < 0).forEach(t => { const c = t.category || 'other'; byc[c] = (byc[c] || 0) + Math.abs(t.amount); });
    const sorted = Object.entries(byc).sort(([, a], [, b]) => b - a).slice(0, 6);
    const max = sorted[0] ? sorted[0][1] : 1;
    return { sorted, max };
  }, [txAll]);
  return (
    <div className="tab-section active">
      <div className="mnav">
        <div>
          <div className="eyebrow">סקירה חודשית</div>
          <h1>{monthLabel}</h1>
        </div>
        <div className="mnav-ctrls">
          <button className="mbtn" onClick={() => changeMonth(-1)}>‹</button>
          <button className="mtoday" onClick={goToday}>היום</button>
          <button className="mbtn" onClick={() => changeMonth(1)}>›</button>
        </div>
      </div>

      <div className="hero-card">
        <div className="hero-main">
          <div className="hero-label">סך הוצאות החודש</div>
          <div className="hero-amount">{fmt(stats.spent)}</div>
          {stats.refunds > 0 && (
            <div className="hero-refunds">
              <span className="hr-plus">+{fmt(stats.refunds)}</span>
              <span className="hr-label">זיכויים החודש{stats.refundCnt > 1 ? ' · ' + stats.refundCnt + ' עסקאות' : ''}</span>
            </div>
          )}
        </div>
        <div className="hero-row">
          <div className="hero-stat"><div className="hero-stat-label">עסקאות</div><div className="hero-stat-val">{stats.cnt}</div></div>
          <div className="hero-stat"><div className="hero-stat-label">Apple Pay</div><div className="hero-stat-val">{stats.apCnt}</div></div>
          <div className="hero-stat"><div className="hero-stat-label">ממוצע לעסקה</div><div className="hero-stat-val">{fmt(stats.avg)}</div></div>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="sec-hdr">
            <span className="sec-title">עסקאות אחרונות</span>
            <button className="sec-action" onClick={() => setTab('txns')}>הצג הכל ←</button>
          </div>
          <div className="txl">
            {recent.length ? recent.map(t => <TxItem key={t.id} tx={t} onEdit={onEdit} />) : <Empty text="אין עסקאות החודש" />}
          </div>
        </div>
        <div className="card">
          <div className="sec-title" style={{ marginBottom: '22px' }}>לפי קטגוריה</div>
          {catBars.sorted.length ? catBars.sorted.map(([cat, total]) => {
            const c = CATS[cat] || CATS.other;
            return (
              <div className="cb" key={cat}>
                <div className="cbt">
                  <span className="cbn"><span className="cbdot" style={{ background: c.color }}></span>{c.label}</span>
                  <span className="cbv">{fmt(total)}</span>
                </div>
                <div className="cbtrack"><div className="cbfill" style={{ width: Math.round(total / catBars.max * 100) + '%', background: c.color }}></div></div>
              </div>
            );
          }) : <Empty text="אין נתונים" />}
        </div>
      </div>
    </div>
  );
}

function TransactionsTab({ txAll, onEdit }) {
  const [catF, setCatF] = useState('all');
  const [q, setQ] = useState('');
  const items = useMemo(() => {
    let list = txAll;
    if (catF === '__ap') list = list.filter(t => t.method === 'Apple Pay');
    else if (catF !== 'all') list = list.filter(t => t.category === catF);
    const query = q.toLowerCase();
    if (query) list = list.filter(t => (t.merchant || '').toLowerCase().includes(query));
    return list;
  }, [txAll, catF, q]);
  const spent = items.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const refunds = items.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  return (
    <div className="tab-section active">
      <div className="page-title">עסקאות</div>
      <p className="page-sub">כל התנועות בחשבון שלך</p>
      <div className="search-wrap">
        <span className="si">⌕</span>
        <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="חיפוש לפי שם עסק…" />
      </div>
      <FilterChips catF={catF} setCatF={setCatF} />
      <div id="tx-summary">{items.length} עסקאות · סך הוצאה {fmt(spent)}{refunds > 0 ? <span className="tx-sum-refund"> · זיכויים <span dir="ltr">+{fmt(refunds)}</span></span> : ''}</div>
      <div className="card">
        <div className="txl">
          {items.length ? items.map(t => <TxItem key={t.id} tx={t} onEdit={onEdit} />) : <Empty text="לא נמצאו עסקאות" />}
        </div>
      </div>
    </div>
  );
}

function AnalyticsTab() {
  const mRef = useRef(null), cRef = useRef(null), meRef = useRef(null);
  useEffect(() => {
    let charts = {};
    let cancelled = false;
    (async () => {
      const { data: all } = await sb.from('transactions').select('date,amount,category,method').order('date', { ascending: false });
      if (!all || cancelled) return;
      const TICK = '#9A9486', GRID = 'rgba(28,26,20,0.07)';
      const monthly = {};
      all.filter(t => t.amount < 0).forEach(t => { const m = t.date.slice(0, 7); monthly[m] = (monthly[m] || 0) + Math.abs(t.amount); });
      const mKeys = Object.keys(monthly).sort().slice(-6), mVals = mKeys.map(k => Math.round(monthly[k]));
      const mLbls = mKeys.map(k => { const [y, m] = k.split('-'); return MHE[+m - 1].slice(0, 3) + ' ' + y.slice(2); });
      charts.m = new Chart(mRef.current, { type: 'bar', data: { labels: mLbls, datasets: [{ data: mVals, backgroundColor: mVals.map((_, i) => i === mVals.length - 1 ? '#2F4A39' : '#CFC8B8'), borderRadius: 10, borderSkipped: false }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => '₪' + c.raw.toLocaleString('he-IL') } } }, scales: { x: { ticks: { color: TICK, font: { family: 'Heebo' } }, grid: { display: false } }, y: { ticks: { color: TICK, font: { family: 'Heebo' }, callback: v => '₪' + (v / 1000).toFixed(0) + 'k' }, grid: { color: GRID } } } } });
      const byc = {};
      all.filter(t => t.amount < 0).forEach(t => { const c = t.category || 'other'; byc[c] = (byc[c] || 0) + Math.abs(t.amount); });
      const ce = Object.entries(byc).sort(([, a], [, b]) => b - a).slice(0, 8);
      charts.c = new Chart(cRef.current, { type: 'doughnut', data: { labels: ce.map(([c]) => (CATS[c] || CATS.other).label), datasets: [{ data: ce.map(([, v]) => Math.round(v)), backgroundColor: ce.map(([c]) => (CATS[c] || CATS.other).color), borderWidth: 3, borderColor: '#FBF9F3' }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { display: true, position: 'right', labels: { color: '#52503F', font: { family: 'Heebo', size: 12 }, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'circle', padding: 12 } }, tooltip: { callbacks: { label: c => c.label + ': ₪' + c.raw.toLocaleString('he-IL') } } } } });
      const apC = all.filter(t => t.amount < 0 && t.method === 'Apple Pay').length, othC = all.filter(t => t.amount < 0).length - apC;
      charts.me = new Chart(meRef.current, { type: 'bar', data: { labels: ['Apple Pay', 'אמצעים אחרים'], datasets: [{ data: [apC, othC], backgroundColor: ['#2F4A39', '#C9C2B2'], borderRadius: 8, barThickness: 46 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.raw + ' עסקאות' } } }, scales: { x: { ticks: { color: TICK, font: { family: 'Heebo' } }, grid: { color: GRID } }, y: { ticks: { color: '#52503F', font: { family: 'Heebo' } }, grid: { display: false } } } } });
    })();
    return () => { cancelled = true; Object.values(charts).forEach(ch => { try { ch.destroy(); } catch (e) {} }); };
  }, []);
  return (
    <div className="tab-section active">
      <div className="page-title">אנליטיקה</div>
      <p className="page-sub">ניתוח הרגלי הוצאה לאורך זמן</p>
      <div className="card mb18">
        <div className="sec-title" style={{ marginBottom: '22px' }}>הוצאות לפי חודש</div>
        <div style={{ position: 'relative', height: '240px' }}><canvas ref={mRef} role="img" aria-label="הוצאות חודשיות"></canvas></div>
      </div>
      <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '18px' }}>
        <div className="card">
          <div className="sec-title" style={{ marginBottom: '22px' }}>פילוח קטגוריות</div>
          <div style={{ position: 'relative', height: '220px' }}><canvas ref={cRef} role="img" aria-label="קטגוריות"></canvas></div>
        </div>
        <div className="card">
          <div className="sec-title" style={{ marginBottom: '22px' }}>אמצעי תשלום</div>
          <div style={{ position: 'relative', height: '220px' }}><canvas ref={meRef} role="img" aria-label="אמצעי תשלום"></canvas></div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════ IMPORT FROM FILE (CSV / EXCEL / PDF) ════════════════════ */

// ArrayBuffer → base64 (להעלאת PDF)
function bufToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(bin);
}

// פענוח טקסט עם נפילה-לאחור לקידוד עברי (יצוא ישראלי הוא לרוב Windows-1255)
function decodeText(buf) {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  const bad = (utf8.match(/\uFFFD/g) || []).length;
  if (bad > 2) { try { return new TextDecoder('windows-1255', { fatal: false }).decode(buf); } catch (e) {} }
  return utf8;
}

// נרמול תאריך ל-YYYY-MM-DD עם אימות שזה תאריך אמיתי (רשת ביטחון; Claude מתבקש להחזיר ISO)
function normDate(s) {
  if (!s) return null;
  s = String(s).trim();
  let y, mo, d, m;
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else {
    m = s.match(/^(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{2,4})/);
    if (!m) return null;
    d = +m[1]; mo = +m[2]; y = +m[3]; if (m[3].length === 2) y += 2000;
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  const p = n => String(n).padStart(2, '0');
  return y + '-' + p(mo) + '-' + p(d);
}

// בניית ה-payload ל-Edge Function מתוך קובץ
async function buildImportPayload(file) {
  const name = (file.name || '').toLowerCase();
  const buf = await file.arrayBuffer();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    return { fileBase64: bufToBase64(buf), mimeType: 'application/pdf' };
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || /sheet|excel/i.test(file.type)) {
    const wb = XLSX.read(buf, { type: 'array' });
    let text = '';
    wb.SheetNames.forEach(sn => { text += XLSX.utils.sheet_to_csv(wb.Sheets[sn]) + '\n'; });
    return { fileText: text.slice(0, 120000) };
  }
  return { fileText: decodeText(buf).slice(0, 120000) };
}

// אימות + נרמול של השורות ש-Claude החזיר
function normalizeRows(raw) {
  const out = [];
  for (const r of (Array.isArray(raw) ? raw : [])) {
    const merchant = String((r && r.merchant) || '').trim().slice(0, 200);
    const amount = Math.abs(parseFloat(r && r.amount));
    const date = normDate(r && r.date);
    if (!merchant || !amount || isNaN(amount) || !date) continue;
    const category = (r && CATS[r.category]) ? r.category : autocat(merchant);
    const isRefund = !!(r && r.is_refund);
    const currency = (String((r && r.currency) || 'ILS').toUpperCase().slice(0, 4)) || 'ILS';
    const oa = (r && r.orig_amount != null && !isNaN(parseFloat(r.orig_amount))) ? Math.abs(parseFloat(r.orig_amount)) : null;
    const oc = (r && r.orig_currency) ? String(r.orig_currency).toUpperCase().slice(0, 4) : null;
    out.push({ merchant, amount, date, category, isRefund, currency, origAmount: oa, origCurrency: oc, include: true, dup: false });
  }
  out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return out;
}

// סימון כפילויות + זיהוי "תיקון" (עסקה קיימת בסימן שגוי) מול עסקאות קיימות בטווח (RLS מצמצם למשתמש)
async function flagDuplicates(rows) {
  if (!rows.length) return rows;
  const dates = rows.map(r => r.date).sort();
  const minD = dates[0], maxD = dates[dates.length - 1];
  let existing = [];
  try {
    const { data } = await sb.from('transactions').select('id,merchant,amount,date').gte('date', minD).lte('date', maxD);
    existing = data || [];
  } catch (e) {}
  const key = (mer, amt, dt) => (mer || '').trim().toLowerCase() + '|' + Math.abs(+amt).toFixed(2) + '|' + dt;
  // מפתח → רשימת עסקאות קיימות (id + סכום חתום)
  const byKey = {};
  existing.forEach(t => { const k = key(t.merchant, t.amount, t.date); (byKey[k] || (byKey[k] = [])).push({ id: t.id, amount: +t.amount }); });

  return rows.map(r => {
    const matches = byKey[key(r.merchant, r.amount, r.date)] || [];
    let dup = false, fix = false, fixId = null, fixFrom = null;
    if (matches.length) {
      const newSigned = r.isRefund ? r.amount : -r.amount;
      const exactDup = matches.find(m => (m.amount >= 0) === (newSigned >= 0)); // אותו סימן כלכלי = כבר קיים
      if (exactDup) {
        dup = true;
      } else if (r.isRefund) {
        const exp = matches.find(m => m.amount < 0); // הוצאה קיימת שאמורה להיות זיכוי
        if (exp) { fix = true; fixId = exp.id; fixFrom = exp.amount; }
        else { dup = true; }
      } else {
        dup = true; // אי-התאמת סימן אחרת — שמרני, מדלגים
      }
    }
    return { ...r, dup, fix, fixId, fixFrom, include: !dup };
  });
}

// למידה: בניית מפת בית-עסק → קטגוריה מתוך ההיסטוריה של המשתמש (כל הערוצים נשמרים באותה טבלה).
// הסיווג האחרון ביותר לכל בית עסק מנצח, כך שתיקון פעם אחת נזכר. RLS מצמצם למשתמש בלבד.
async function loadLearnedMap() {
  const map = {};
  try {
    const { data } = await sb.from('transactions')
      .select('merchant,category,date,id')
      .not('category', 'is', null)
      .neq('category', 'other')
      .order('date', { ascending: false })
      .order('id', { ascending: false })
      .limit(4000);
    (data || []).forEach(t => {
      const k = (t.merchant || '').trim().toLowerCase();
      if (k && t.category && CATS[t.category] && !(k in map)) map[k] = t.category;
    });
  } catch (e) {}
  return map;
}

function ImportCard({ reload, showToast, setTab, goToMonth }) {
  const [busy, setBusy] = useState('');
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  async function onPick(e) {
    const file = e.target.files && e.target.files[0];
    if (e.target) e.target.value = '';
    if (!file) return;
    setBusy('read');
    try {
      const payload = await buildImportPayload(file);
      setBusy('ai');
      const d = await aiCall('import', payload);
      const raw = normalizeRows(d.transactions || []);
      if (!raw.length) { showToast('לא נמצאו עסקאות בקובץ — נסה קובץ פירוט חיובים', AI_ERR_RED); setBusy(''); return; }
      // למידה: לבתי עסק שכבר סיווגת בעבר — להחיל את הקטגוריה הזכורה אוטומטית
      const learned = await loadLearnedMap();
      const rows = raw.map(r => {
        const k = r.merchant.trim().toLowerCase();
        return learned[k] ? { ...r, category: learned[k], learned: true } : r;
      });
      const flagged = await flagDuplicates(rows);
      setPreview({ rows: flagged, fileName: file.name });
    } catch (err) {
      showToast(aiErr(err), AI_ERR_RED);
    }
    setBusy('');
  }

  return (
    <div className="imp-card">
      <div className="imp-ico">📄✨</div>
      <h3>ייבוא מקובץ עם AI</h3>
      <p>העלה קובץ פירוט עסקאות מחברת האשראי או הבנק — וה‑AI יחלץ, יסווג ויוסיף את כל העסקאות לחודש הנכון אוטומטית.</p>
      <input ref={fileRef} type="file" accept=".csv,.txt,.xls,.xlsx,.pdf,text/csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={onPick} style={{ display: 'none' }} />
      <button className="imp-btn" disabled={!!busy} onClick={() => fileRef.current && fileRef.current.click()}>
        {busy === 'read' ? 'קורא את הקובץ…' : busy === 'ai' ? '✨ ה‑AI מחלץ עסקאות…' : '⬆ בחר קובץ להעלאה'}
      </button>
      <div className="imp-formats">
        <span className="imp-fmt">CSV</span><span className="imp-fmt">Excel</span><span className="imp-fmt">PDF</span>
      </div>
      {preview && <ImportPreviewModal data={preview} onClose={() => setPreview(null)} reload={reload} showToast={showToast} setTab={setTab} goToMonth={goToMonth} />}
    </div>
  );
}

function ImportPreviewModal({ data, onClose, reload, showToast, setTab, goToMonth }) {
  const [rows, setRows] = useState(data.rows);
  const [busy, setBusy] = useState(false);
  const sel = rows.filter(r => r.include);
  const addN = sel.filter(r => !r.fix).length;
  const fixN = sel.filter(r => r.fix).length;
  const dupCount = rows.filter(r => r.dup).length;
  const total = sel.filter(r => !r.fix && !r.isRefund).reduce((s, r) => s + r.amount, 0);

  function toggle(i) { setRows(rs => rs.map((r, idx) => idx === i ? { ...r, include: !r.include } : r)); }
  function setCat(i, c) { setRows(rs => rs.map((r, idx) => idx === i ? { ...r, category: c } : r)); }

  async function addAll() {
    const chosen = rows.filter(r => r.include);
    if (!chosen.length) { showToast('לא נבחרו עסקאות', AI_ERR_RED); return; }
    setBusy(true);
    const { data: { session } } = await sb.auth.getSession();
    const uid = session.user.id;

    const toInsert = chosen.filter(r => !r.fix);
    const toFix = chosen.filter(r => r.fix && r.fixId);

    // הוספות
    const payload = toInsert.map(r => ({
      user_id: uid,
      merchant: r.merchant.slice(0, 200),
      amount: r.isRefund ? Math.abs(r.amount) : -Math.abs(r.amount),
      currency: r.currency || 'ILS',
      date: r.date,
      time: null,
      method: 'כרטיס אשראי',
      category: r.category || autocat(r.merchant),
      orig_amount: r.origAmount,
      orig_currency: r.origCurrency,
      fx_source: r.origCurrency ? 'import' : null,
      source: 'import',
    }));
    let inserted = 0, failed = null;
    for (let i = 0; i < payload.length && !failed; i += 200) {
      const slice = payload.slice(i, i + 200);
      const { error } = await sb.from('transactions').insert(slice);
      if (error) failed = error; else inserted += slice.length;
    }

    // תיקונים (עדכון עסקאות קיימות לזיכוי)
    let fixed = 0;
    for (const r of toFix) {
      if (failed) break;
      const { error } = await sb.from('transactions')
        .update({ amount: Math.abs(r.amount), category: r.category || autocat(r.merchant) })
        .eq('id', r.fixId);
      if (error) failed = error; else fixed++;
    }

    setBusy(false);
    if (failed) { showToast('שגיאה: ' + failed.message, AI_ERR_RED); return; }
    onClose();
    const parts = [];
    if (inserted) parts.push('נוספו ' + inserted + ' עסקאות');
    if (fixed) parts.push('תוקנו ' + fixed + ' זיכויים');
    showToast('✓ ' + (parts.join(' · ') || 'בוצע'));
    const mc = {};
    chosen.forEach(r => { const mk = r.date.slice(0, 7); mc[mk] = (mc[mk] || 0) + 1; });
    const top = Object.entries(mc).sort((a, b) => b[1] - a[1])[0];
    if (top && goToMonth) { const p = top[0].split('-'); goToMonth(+p[0], +p[1]); }
    setTab('home');
    reload();
  }

  return (
    <div className="imp-bg" onClick={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="imp-box">
        <div className="imp-hd">
          <h3>✨ נמצאו {rows.length} עסקאות</h3>
          <div className="imp-fname" dir="ltr">{data.fileName}</div>
          <div className="imp-stats">
            <div className="imp-stat"><b>{addN}</b> ייתווספו</div>
            {fixN > 0 && <div className="imp-stat"><b>{fixN}</b> יתוקנו</div>}
            <div className="imp-stat"><b>{fmt(total)}</b> סך חיובים</div>
          </div>
          {fixN > 0 && <div className="imp-fixnote">🔧 {fixN} עסקאות קיימות שזוהו כזיכוי יעודכנו במקום — בלי כפילויות וללא צורך בתיקון ידני.</div>}
          {dupCount > 0 && <div className="imp-dupwarn">⚠ זוהו {dupCount} עסקאות שכבר קיימות — בוטלו אוטומטית כדי למנוע כפילויות. אפשר לסמן אותן ידנית אם תרצה.</div>}
        </div>
        <div className="imp-list">
          {rows.map((r, i) => (
            <div key={i} className={'imp-row' + (r.include ? '' : ' off')}>
              <input className="imp-cb" type="checkbox" checked={r.include} onChange={() => toggle(i)} />
              <div className="imp-m">
                <div className="imp-mn">{r.merchant}{r.learned && !r.dup && <span className="imp-learnb">נלמד</span>}{r.fix && <span className="imp-fixb">תיקון לזיכוי</span>}{r.dup && <span className="imp-dupb">קיים</span>}</div>
                <div className="imp-md">{r.date}{r.origCurrency ? ' · ' + fmtForeign(r.origAmount, r.origCurrency) : ''}{r.fix && <span className="imp-was"> · היה <span dir="ltr">−{fmt(r.fixFrom)}</span></span>}</div>
              </div>
              <select className="imp-sel" value={r.category} onChange={e => setCat(i, e.target.value)}>
                {CAT_ORDER.map(k => <option key={k} value={k}>{CATS[k].label}</option>)}
              </select>
              <div className={'imp-amt ' + (r.isRefund ? 'pos' : 'neg')}>{r.isRefund ? '+' : '−'}{fmt(r.amount)}</div>
            </div>
          ))}
        </div>
        <div className="imp-ft">
          <button className="btn-save" disabled={busy} onClick={addAll}>{busy ? 'שומר…' : (fixN > 0 ? 'הוסף ' + addN + ' · תקן ' + fixN : 'הוסף ' + addN + ' עסקאות')}</button>
          <button className="btn-ghost" disabled={busy} onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

function AddTab({ reload, showToast, setTab, goToMonth }) {
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Apple Pay');
  const [cat, setCat] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [isRefund, setIsRefund] = useState(false);
  const [busy, setBusy] = useState(false);
  const [learnedMap, setLearnedMap] = useState({});
  useEffect(() => { loadLearnedMap().then(setLearnedMap); }, []);
  const mKey = (merchant || '').trim().toLowerCase();
  const learnedCat = learnedMap[mKey];
  const effCat = cat || learnedCat || autocat(merchant || '');
  const c = CATS[effCat] || CATS.other;
  const amtNum = parseFloat(amount);
  async function addTx() {
    const m = merchant.trim();
    if (!m || !amtNum || isNaN(amtNum)) { showToast('אנא מלא שם עסק וסכום', '#A24B57'); return; }
    setBusy(true);
    const { data: { session } } = await sb.auth.getSession();
    const { error } = await sb.from('transactions').insert({
      user_id: session.user.id, merchant: m.slice(0, 200), amount: isRefund ? Math.abs(amtNum) : -Math.abs(amtNum), currency: 'ILS',
      date: date || new Date().toISOString().split('T')[0], time: new Date().toTimeString().slice(0, 5),
      method, category: cat || learnedMap[m.toLowerCase()] || autocat(m), notes: notes.slice(0, 500) || null, source: 'manual'
    });
    setBusy(false);
    if (error) { showToast('שגיאה: ' + error.message, '#A24B57'); return; }
    setMerchant(''); setAmount(''); setNotes(''); setIsRefund(false);
    showToast('✓ נשמר: ' + m);
    setTab('home');
    reload();
  }
  return (
    <div className="tab-section active">
      <div className="page-title">הוספת עסקה</div>
      <p className="page-sub">ייבוא אוטומטי מקובץ, או רישום ידני</p>
      <ImportCard reload={reload} showToast={showToast} setTab={setTab} goToMonth={goToMonth} />
      <div className="grid2 add-grid" style={{ gridTemplateColumns: '1.4fr 1fr', alignItems: 'start' }}>
        <div className="card">
          <div className="fg"><label className="fl">שם בית העסק *</label>
            <input className="fi" type="text" value={merchant} onChange={e => setMerchant(e.target.value)} placeholder="לדוגמה: שופרסל דיל" /></div>
          <div className="frow">
            <div className="fg"><label className="fl">סכום ₪ *</label>
              <input className="fi" type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" style={{ direction: 'ltr', textAlign: 'left' }} /></div>
            <div className="fg"><label className="fl">אמצעי תשלום</label>
              <select className="fs" value={method} onChange={e => setMethod(e.target.value)}>
                <option>Apple Pay</option><option>כרטיס אשראי</option><option>מזומן</option><option>העברה בנקאית</option><option>הוראת קבע</option>
              </select></div>
          </div>
          <div className="frow">
            <div className="fg"><label className="fl">תאריך</label>
              <input className="fi" type="date" value={date} onChange={e => setDate(e.target.value)} style={{ direction: 'ltr' }} /></div>
            <div className="fg"><label className="fl">קטגוריה</label>
              <select className="fs" value={cat} onChange={e => setCat(e.target.value)}>
                <option value="">זיהוי אוטומטי</option>
                {CAT_ORDER.map(k => <option key={k} value={k}>{CATS[k].label}</option>)}
              </select></div>
          </div>
          {!cat && learnedCat && <div className="learn-hint">✓ סווג ל"{CATS[learnedCat].label}" לפי קטגוריות קודמות של בית עסק זה</div>}
          <div className="fg"><label className="fl">הערות</label>
            <input className="fi" type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="אופציונלי…" /></div>
          <label className="refund-tg">
            <input type="checkbox" checked={isRefund} onChange={e => setIsRefund(e.target.checked)} />
            <span className="rt-txt">זיכוי / החזר <span className="rt-hint">(כסף שנכנס — לא ייספר בהוצאות)</span></span>
          </label>
          <button className="btn-save" disabled={busy} onClick={addTx}>{busy ? 'שומר...' : 'שמור עסקה'}</button>
        </div>
        <div>
          <div className="preview-eyebrow">תצוגה מקדימה</div>
          <div className="preview-card">
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
              <div className="txicon" style={{ width: '50px', height: '50px', fontSize: '22px', background: c.color + '33', color: c.color }}>{(merchant || 'כ').charAt(0)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '16px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{merchant || 'שם בית העסק'}</div>
                <div style={{ fontSize: '12px', color: 'rgba(236,231,219,0.5)', marginTop: '3px' }}>{method}</div>
              </div>
            </div>
            <div style={{ position: 'relative', fontFamily: 'var(--serif)', fontSize: '40px', fontWeight: 700, letterSpacing: '-1px', marginBottom: '10px', color: isRefund ? 'var(--green)' : undefined }}>{isRefund ? '+' : '−'}{fmt(amtNum || 0)}</div>
            <span style={{ position: 'relative', display: 'inline-block', fontSize: '11.5px', fontWeight: 700, color: c.color, background: c.color + '33', padding: '4px 11px', borderRadius: '20px' }}>{c.label}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsTab({ user, reload, showToast }) {
  const [cpPwd, setCpPwd] = useState('');
  const [cpPwd2, setCpPwd2] = useState('');
  const [cpMsg, setCpMsg] = useState(null);
  const [cfgUrl, setCfgUrl] = useState(localStorage.getItem('sb_url') || '');
  const [cfgKey, setCfgKey] = useState(localStorage.getItem('sb_key') || '');
  const initial = (user.email || '?').trim().charAt(0).toUpperCase();

  async function changePassword() {
    if (cpPwd.length < 8) { setCpMsg({ c: 'var(--red)', t: 'הסיסמה חייבת להיות לפחות 8 תווים' }); return; }
    if (cpPwd !== cpPwd2) { setCpMsg({ c: 'var(--red)', t: 'הסיסמאות אינן תואמות' }); return; }
    setCpMsg({ c: 'var(--faint)', t: 'מעדכן...' });
    const { error } = await sb.auth.updateUser({ password: cpPwd });
    if (error) { setCpMsg({ c: 'var(--red)', t: error.message }); return; }
    setCpPwd(''); setCpPwd2('');
    setCpMsg({ c: 'var(--accent)', t: '✓ הסיסמה עודכנה בהצלחה' });
  }
  function saveCfg() {
    if (!cfgUrl.trim() || !cfgKey.trim()) { showToast('מלא URL ומפתח', '#A24B57'); return; }
    localStorage.setItem('sb_url', cfgUrl.trim()); localStorage.setItem('sb_key', cfgKey.trim());
    showToast('✓ נשמר'); location.reload();
  }
  async function signOut() {
    if (!confirm('להתנתק?')) return;
    localStorage.clear(); await sb.auth.signOut(); location.reload();
  }
  function copyUID() { navigator.clipboard.writeText(user.id); showToast('✓ הועתק'); }
  async function exportCSV() {
    const { data: all } = await sb.from('transactions').select('*').order('date', { ascending: false });
    if (!all) return;
    const hdr = 'id,merchant,amount_ils,currency,orig_amount,orig_currency,fx_rate,date,time,method,category,notes,created_at\n';
    const rows = all.map(t => [t.id, '"' + t.merchant + '"', t.amount, t.currency || 'ILS', t.orig_amount ?? '', t.orig_currency ?? '', t.fx_rate ?? '', t.date, t.time || '', t.method, t.category || '', '"' + (t.notes || '') + '"', t.created_at].join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([hdr + rows], { type: 'text/csv;charset=utf-8;' })), download: 'kaspon-' + new Date().toISOString().slice(0, 10) + '.csv' });
    a.click();
  }
  async function recategorizeAll() {
    if (!confirm('הפעולה תזהה מחדש את הקטגוריה של כל עסקה לפי שם בית העסק. ייתכן שקטגוריות שהגדרת ידנית ישתנו. להמשיך?')) return;
    showToast('מסווג מחדש...');
    const { data: all, error } = await sb.from('transactions').select('id,merchant,category');
    if (error || !all) { showToast('שגיאה בטעינה', '#A24B57'); return; }
    let changed = 0;
    for (const t of all) {
      if (t.category === 'income') continue;
      const cat = autocat(t.merchant || '');
      if (cat !== t.category) { const { error: e } = await sb.from('transactions').update({ category: cat }).eq('id', t.id); if (!e) changed++; }
    }
    showToast(changed ? '✓ סווגו מחדש ' + changed + ' עסקאות' : '✓ הכל כבר מסווג נכון');
    reload();
  }
  return (
    <div className="tab-section active">
      <div className="page-title">הגדרות</div>
      <p className="page-sub">חשבון, אבטחה וייצוא נתונים</p>
      <div style={{ maxWidth: '680px' }}>
        <div className="card mb18">
          <div className="sec-title" style={{ marginBottom: '18px' }}>פרופיל</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--accent)', color: '#ECE7DB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: '24px', fontWeight: 700 }}>{initial}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '17px', fontWeight: 600 }}>החשבון שלי</div>
              <div style={{ fontSize: '13px', color: 'var(--faint)', direction: 'ltr', textAlign: 'right' }}>{user.email}</div>
            </div>
            <span className="premium-pill">PREMIUM</span>
          </div>
        </div>

        <div className="card mb18">
          <div className="sec-title" style={{ marginBottom: '14px' }}>שינוי סיסמה</div>
          <div className="fg"><label className="fl">סיסמה חדשה</label>
            <input className="fi" type="password" value={cpPwd} onChange={e => setCpPwd(e.target.value)} placeholder="לפחות 8 תווים" autoComplete="new-password" /></div>
          <div className="fg"><label className="fl">אימות סיסמה</label>
            <input className="fi" type="password" value={cpPwd2} onChange={e => setCpPwd2(e.target.value)} placeholder="הזן שוב" autoComplete="new-password" /></div>
          <button className="btn-ghost" style={{ marginTop: '4px' }} onClick={changePassword}>עדכן סיסמה</button>
          {cpMsg && <div style={{ fontSize: '13px', marginTop: '10px', color: cpMsg.c }}>{cpMsg.t}</div>}
        </div>

        <div className="card mb18">
          <div className="sec-title" style={{ marginBottom: '8px' }}>מצב אבטחה</div>
          <div className="sec-row"><span className="sd"></span><span className="sec-label">אימות משתמש (Auth)</span><span className="sec-val">פעיל</span></div>
          <div className="sec-row"><span className="sd"></span><span className="sec-label">Row Level Security</span><span className="sec-val">פעיל</span></div>
          <div className="sec-row"><span className="sd"></span><span className="sec-label">הצפנת TLS 1.3</span><span className="sec-val">פעיל</span></div>
          <div className="sec-row"><span className="sd"></span><span className="sec-label">Edge Function + Secret Token</span><span className="sec-val">פעיל</span></div>
        </div>

        <div className="card mb18">
          <div className="sec-title" style={{ marginBottom: '14px' }}>מזהה משתמש</div>
          <div className="uid-box">{user.id}</div>
          <button className="btn-ghost" style={{ marginTop: '12px', padding: '9px 16px', fontSize: '13px' }} onClick={copyUID}>העתק</button>
        </div>

        <div className="card mb18">
          <div className="sec-title" style={{ marginBottom: '14px' }}>חיבור Supabase</div>
          <div className="fg"><label className="fl">Project URL</label>
            <input className="fi" type="url" value={cfgUrl} onChange={e => setCfgUrl(e.target.value)} style={{ direction: 'ltr' }} /></div>
          <div className="fg"><label className="fl">Anon Key</label>
            <input className="fi" type="text" value={cfgKey} onChange={e => setCfgKey(e.target.value)} style={{ direction: 'ltr' }} /></div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button className="btn-ghost" onClick={saveCfg}>שמור</button>
            <button className="btn-del" onClick={signOut}>יציאה מהחשבון</button>
          </div>
        </div>

        <div className="card">
          <div className="sec-title" style={{ marginBottom: '14px' }}>ייצוא נתונים</div>
          <button className="btn-ghost" onClick={exportCSV}>⬇ ייצוא CSV</button>
        </div>
        <div className="card">
          <div className="sec-title" style={{ marginBottom: '6px' }}>סיווג אוטומטי</div>
          <div className="page-sub" style={{ marginBottom: '12px' }}>החל את מנגנון הזיהוי המעודכן על כל העסקאות הקיימות</div>
          <button className="btn-ghost" onClick={recategorizeAll}>🔄 סווג מחדש את כל העסקאות</button>
        </div>
      </div>
    </div>
  );
}

function EditModal({ tx, onClose, reload, showToast }) {
  const [merchant, setMerchant] = useState(tx.merchant || '');
  const [amount, setAmount] = useState(Math.abs(tx.amount));
  const [cat, setCat] = useState(tx.category || 'other');
  const [notes, setNotes] = useState(tx.notes || '');
  const [isRefund, setIsRefund] = useState(tx.amount > 0);
  async function save() {
    const signed = isRefund ? Math.abs(+amount) : -Math.abs(+amount);
    const { error } = await sb.from('transactions').update({ merchant, amount: signed, category: cat, notes: notes || null }).eq('id', tx.id);
    if (error) { showToast('שגיאה', '#A24B57'); return; }
    onClose(); showToast('✓ עודכן'); reload();
  }
  async function del() {
    if (!confirm('למחוק עסקה זו?')) return;
    await sb.from('transactions').delete().eq('id', tx.id);
    onClose(); showToast('נמחק', '#A24B57'); reload();
  }
  return (
    <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box">
        <div className="modal-title">עריכת עסקה</div>
        <div className="fg"><label className="fl">שם בית העסק</label><input className="fi" type="text" value={merchant} onChange={e => setMerchant(e.target.value)} /></div>
        <div className="frow">
          <div className="fg"><label className="fl">סכום ₪</label><input className="fi" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} style={{ direction: 'ltr', textAlign: 'left' }} /></div>
          <div className="fg"><label className="fl">קטגוריה</label>
            <select className="fs" value={cat} onChange={e => setCat(e.target.value)}>
              {CAT_ORDER.map(k => <option key={k} value={k}>{CATS[k].label}</option>)}
            </select></div>
        </div>
        <div className="fg"><label className="fl">הערות</label><input className="fi" type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="אופציונלי…" /></div>
        <label className="refund-tg">
          <input type="checkbox" checked={isRefund} onChange={e => setIsRefund(e.target.checked)} />
          <span className="rt-txt">זיכוי / החזר <span className="rt-hint">(כסף שנכנס — לא ייספר בהוצאות)</span></span>
        </label>
        <div className="modal-acts">
          <button className="btn-save" onClick={save}>שמור שינויים</button>
          <button className="btn-del" onClick={del}>מחק</button>
          <button className="btn-ghost" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

function Toast({ toast }) {
  return <div className={'toast' + (toast.show ? ' show' : '')} style={{ background: toast.color }}>{toast.msg}</div>;
}

/* ════════════════════ AI ASSISTANT TAB ════════════════════ */
const AI_ERR_RED = '#E0526A';
function aiErr(e) {
  const m = (e && e.message) || '';
  if (/ANTHROPIC|הוגדר|not configured/i.test(m)) return 'עוזר ה-AI עדיין לא הוגדר. צריך לפרוס את ה-Edge Function ולהגדיר מפתח API (ראה המדריך).';
  if (/Failed to fetch|NetworkError|not found|404|non-2xx/i.test(m)) return 'לא הצלחתי להתחבר לעוזר ה-AI. ודא שה-Edge Function בשם ai-assistant פרוס.';
  if (/Unauthorized|401|JWT/i.test(m)) return 'נדרשת התחברות מחדש — צא והיכנס שוב.';
  return m || 'משהו השתבש. נסה שוב.';
}
async function aiCall(action, extra = {}) {
  const { data, error } = await sb.functions.invoke('ai-assistant', { body: { action, ...extra } });
  if (error) {
    let msg = error.message;
    try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch (_) {}
    throw new Error(msg);
  }
  if (data && data.error) throw new Error(data.error);
  return data || {};
}
function AiText({ text }) {
  return (
    <div className="ai-text">
      {String(text).split('\n').map((line, i) => {
        const t = line.trim();
        if (!t) return null;
        const bullet = t.startsWith('•') || t.startsWith('-') || t.startsWith('*');
        return <div key={i} className={bullet ? 'ai-line bullet' : 'ai-line'}>{bullet ? t.replace(/^[•\-*]\s*/, '') : t}</div>;
      })}
    </div>
  );
}
function AiTab({ txAll, reload, showToast }) {
  const [busy, setBusy] = useState('');
  const [insights, setInsights] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sugg, setSugg] = useState(null);
  const chatEnd = useRef(null);
  useEffect(() => { if (chatEnd.current) chatEnd.current.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function getInsights() {
    setBusy('insights'); setInsights('');
    try { const d = await aiCall('insights'); setInsights(d.text || ''); }
    catch (e) { showToast(aiErr(e), AI_ERR_RED); }
    setBusy('');
  }
  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    setInput(''); setMessages(m => [...m, { role: 'user', text: q }]); setBusy('chat');
    try { const d = await aiCall('chat', { message: q }); setMessages(m => [...m, { role: 'ai', text: d.text || '' }]); }
    catch (e) { setMessages(m => [...m, { role: 'ai', text: aiErr(e) }]); }
    setBusy('');
  }
  async function categorize() {
    setBusy('cat'); setSugg(null);
    try { const d = await aiCall('categorize'); setSugg(d.suggestions || []); if (d.text) showToast(d.text); }
    catch (e) { showToast(aiErr(e), AI_ERR_RED); }
    setBusy('');
  }
  async function applyAll() {
    if (!sugg || !sugg.length) return;
    setBusy('cat'); let n = 0;
    for (const s of sugg) {
      const { error } = await sb.from('transactions').update({ category: s.category }).eq('merchant', s.merchant).eq('category', 'other');
      if (!error) n++;
    }
    setBusy(''); setSugg(null);
    showToast('✓ סווגו ' + n + ' בתי עסק'); reload();
  }
  const uncatCount = txAll.filter(t => (t.category || 'other') === 'other').length;

  return (
    <div className="ai-wrap">
      <div className="page-title">✨ עוזר AI</div>
      <p className="page-sub">בינה מלאכותית שמבינה את ההוצאות שלך — מבוסס Claude</p>

      <div className="card ai-card mb18">
        <div className="ai-card-head">
          <div><div className="sec-title">תובנות חכמות</div><div className="ai-card-sub">ניתוח דפוסי ההוצאה ובתי העסק שלך</div></div>
          <button className="ai-btn" onClick={getInsights} disabled={!!busy}>{busy === 'insights' ? '✨ מנתח…' : '✨ נתח את ההוצאות שלי'}</button>
        </div>
        {insights && <div className="ai-insights"><AiText text={insights} /></div>}
      </div>

      <div className="card ai-card mb18">
        <div className="ai-card-head">
          <div><div className="sec-title">סיווג חכם</div><div className="ai-card-sub">{uncatCount > 0 ? uncatCount + ' עסקאות בקטגוריית "אחר" — ה-AI יסווג אותן' : 'כל העסקאות מסווגות 👌'}</div></div>
          <button className="ai-btn ghost" onClick={categorize} disabled={!!busy || uncatCount === 0}>{busy === 'cat' ? '🏷️ עובד…' : '🏷️ סווג עם AI'}</button>
        </div>
        {sugg && sugg.length > 0 && (
          <div className="ai-sugg">
            {sugg.map((s, i) => (
              <div key={i} className="ai-sugg-row">
                <span className="ai-sugg-merchant">{s.merchant}</span>
                <span className="ai-sugg-arrow">←</span>
                <span className="ai-sugg-cat" style={{ background: ((CATS[s.category] || {}).color || '#999') + '22', color: (CATS[s.category] || {}).color || '#999' }}>{s.label}</span>
              </div>
            ))}
            <button className="ai-btn" style={{ marginTop: 12, width: '100%' }} onClick={applyAll} disabled={!!busy}>החל את כל הסיווגים</button>
          </div>
        )}
        {sugg && sugg.length === 0 && <div className="ai-empty">אין כרגע עסקאות לסיווג.</div>}
      </div>

      <div className="card ai-card">
        <div className="sec-title" style={{ marginBottom: 4 }}>שאל אותי על הכסף שלך</div>
        <div className="ai-card-sub" style={{ marginBottom: 14 }}>לדוגמה: "כמה הוצאתי על מסעדות?", "איפה אני הכי מבזבז?"</div>
        <div className="ai-chat">
          {messages.length === 0 && <div className="ai-empty">התחל שיחה — שאל כל שאלה על ההוצאות שלך</div>}
          {messages.map((m, i) => (<div key={i} className={'ai-bubble ' + m.role}>{m.role === 'ai' ? <AiText text={m.text} /> : m.text}</div>))}
          {busy === 'chat' && <div className="ai-bubble ai typing">✨ חושב…</div>}
          <div ref={chatEnd} />
        </div>
        <div className="ai-input-row">
          <input className="ai-input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send(); }} placeholder="כתוב שאלה…" disabled={busy === 'chat'} />
          <button className="ai-send" onClick={send} disabled={busy === 'chat' || !input.trim()}>↑</button>
        </div>
      </div>
    </div>
  );
}

const NAV = [['home', 'בית', '🏠'], ['txns', 'עסקאות', '🧾'], ['analytics', 'אנליטיקה', '📊'], ['ai', 'עוזר AI', '✨'], ['add', 'הוספת עסקה', '➕'], ['settings', 'הגדרות', '⚙️']];
const BNAV = [['home', 'בית', '🏠'], ['txns', 'עסקאות', '🧾'], ['analytics', 'ניתוח', '📊'], ['ai', 'AI', '✨'], ['add', 'הוסף', '➕'], ['settings', 'הגדרות', '⚙️']];

function Dashboard({ user, txAll, monthLabel, changeMonth, goToday, reload, showToast, goToMonth }) {
  const [tab, setTabState] = useState('home');
  const [editTx, setEditTx] = useState(null);
  const setTab = name => { setTabState(name); window.scrollTo(0, 0); };
  async function lockApp() { await sb.auth.signOut(); }
  return (
    <div className="page active" id="page-app">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">₪</div>
          <div><div className="name">כספון</div><div className="tag">Premium</div></div>
        </div>
        <nav className="sidenav">
          {NAV.map(([k, label, ico]) => (
            <button key={k} className={'tab' + (tab === k ? ' active' : '')} onClick={() => setTab(k)}><span className="tab-ico">{ico}</span>{label}</button>
          ))}
        </nav>
        <div className="spacer"></div>
        <button className="side-add" onClick={() => setTab('add')}>+ עסקה חדשה</button>
        <div className="user-chip">
          <div className="av">{(user.email || '?').trim().charAt(0).toUpperCase()}</div>
          <div className="uinfo"><div className="un">החשבון שלי</div><div className="ue">{user.email}</div></div>
          <div className="dot ok"></div>
          <button className="lock-btn" onClick={lockApp} title="נעל">⏻</button>
        </div>
      </aside>

      <main className="app-main">
        {tab === 'home' && <HomeTab txAll={txAll} monthLabel={monthLabel} changeMonth={changeMonth} goToday={goToday} onEdit={setEditTx} setTab={setTab} />}
        {tab === 'txns' && <TransactionsTab txAll={txAll} onEdit={setEditTx} />}
        {tab === 'analytics' && <AnalyticsTab />}
        {tab === 'ai' && <AiTab txAll={txAll} reload={reload} showToast={showToast} />}
        {tab === 'add' && <AddTab reload={reload} showToast={showToast} setTab={setTab} goToMonth={goToMonth} />}
        {tab === 'settings' && <SettingsTab user={user} reload={reload} showToast={showToast} />}
      </main>

      <nav className="bnav">
        {BNAV.map(([k, label, ico]) => (
          <button key={k} className={'bi' + (tab === k ? ' active' : '')} onClick={() => setTab(k)}><span className="ico">{ico}</span>{label}</button>
        ))}
      </nav>

      {editTx && <EditModal tx={editTx} onClose={() => setEditTx(null)} reload={reload} showToast={showToast} />}
    </div>
  );
}

/* ════════════════════ APP (router + auth) ════════════════════ */

function App() {
  const [page, setPage] = useState('boot');
  const [sbVersion, setSbVersion] = useState(0);
  const [user, setUser] = useState(null);
  const [txAll, setTxAll] = useState([]);
  const now = new Date();
  const [curY, setCurY] = useState(now.getFullYear());
  const [curM, setCurM] = useState(now.getMonth() + 1);
  const [toast, setToast] = useState({ msg: '', color: '#1C1A14', show: false });
  const toastTimer = useRef(null);

  const showToast = useCallback((msg, color = '#1C1A14') => {
    setToast({ msg, color, show: true });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, show: false })), 3000);
  }, []);

  const onSignedIn = useCallback(async (session) => {
    let approved = false;
    try { const { data: prof } = await sb.from('profiles').select('approved').eq('id', session.user.id).maybeSingle(); approved = !!(prof && prof.approved); } catch (e) { approved = false; }
    if (!approved) { setPage('pending'); return; }
    setUser({ id: session.user.id, email: session.user.email || '' });
    const n = new Date(); setCurY(n.getFullYear()); setCurM(n.getMonth() + 1);
    setPage('app');
  }, []);

  // boot + auth listener
  useEffect(() => {
    if (!sb) { setPage('setup'); return; }
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') { setPage('reset-new'); return; }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') { if (session) onSignedIn(session); }
      if (event === 'SIGNED_OUT') { setUser(null); setPage('login'); }
    });
    if (location.hash.includes('type=recovery')) {
      setPage('reset-new');
    } else {
      sb.auth.getSession().then(({ data: { session } }) => { if (session) onSignedIn(session); else setPage('login'); });
    }
    return () => { try { sub.subscription.unsubscribe(); } catch (e) {} };
  }, [sbVersion, onSignedIn]);

  // load month transactions
  const loadMonth = useCallback(async () => {
    if (!sb) return;
    const from = curY + '-' + String(curM).padStart(2, '0') + '-01';
    const to = curY + '-' + String(curM).padStart(2, '0') + '-' + new Date(curY, curM, 0).getDate();
    const { data, error } = await sb.from('transactions').select('*').gte('date', from).lte('date', to).order('date', { ascending: false }).order('time', { ascending: false });
    if (!error) setTxAll(data || []);
  }, [curY, curM]);

  useEffect(() => { if (page === 'app') loadMonth(); }, [page, curY, curM, loadMonth]);

  const changeMonth = d => {
    let m = curM + d, y = curY;
    if (m > 12) { m = 1; y++; } if (m < 1) { m = 12; y--; }
    setCurM(m); setCurY(y);
  };
  const goToday = () => { const n = new Date(); setCurY(n.getFullYear()); setCurM(n.getMonth() + 1); };
  const goToMonth = useCallback((y, m) => { if (y && m) { setCurY(y); setCurM(m); } }, []);
  const monthLabel = MHE[curM - 1] + ' ' + curY;

  let screen;
  if (page === 'boot') screen = <div className="auth-shell"><div className="auth-icon">₪</div></div>;
  else if (page === 'setup') screen = <SetupScreen onConnected={() => { setSbVersion(v => v + 1); setPage('login'); }} />;
  else if (page === 'login') screen = <LoginScreen go={setPage} />;
  else if (page === 'register') screen = <RegisterScreen go={setPage} />;
  else if (page === 'forgot') screen = <ForgotScreen go={setPage} />;
  else if (page === 'reset-new') screen = <ResetNewScreen go={setPage} onSignedIn={onSignedIn} />;
  else if (page === 'pending') screen = <PendingScreen go={setPage} />;
  else if (page === 'app' && user) screen = (
    <Dashboard user={user} txAll={txAll} monthLabel={monthLabel} changeMonth={changeMonth} goToday={goToday} reload={loadMonth} showToast={showToast} goToMonth={goToMonth} />
  );
  else screen = <div className="auth-shell"><div className="auth-icon">₪</div></div>;

  return (
    <React.Fragment>
      {page === 'app' ? screen : <div className="page active">{screen}</div>}
      <Toast toast={toast} />
    </React.Fragment>
  );
}

export default App;




