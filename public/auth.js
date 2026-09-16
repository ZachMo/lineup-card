// Sign-in and cloud save.
//
// The tool works with no account. Everything lives in this browser, which is what
// a coach wants at a field with no signal. Signing in adds a copy in the cloud, so
// the same team opens on a phone, a laptop, or an assistant coach's device.
//
// Two ways in. A password is quicker for a coach who opens this every Saturday. An
// emailed link suits anyone who would rather not keep one more password.
//
// This file loads after the app and uses the app's own state (`s`), its save hook
// and its `changed()` redraw. With no project configured, it does nothing at all.
(function () {
  const cfg = window.LINEUP_CONFIG || {};
  const key = cfg.publishableKey || cfg.anonKey; // Supabase renamed this key in 2025.
  const bar = document.getElementById('account');
  if (!bar || !cfg.url || !key) return;

  const SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
  const TEAM_KEY = 'lineup-card-team';
  const SAVE_WAIT = 1500;

  let supa = null, user = null, teams = [], teamId = null;
  let mode = 'closed';  // closed | password | link | recover
  let loading = false, timer = null, note = '', noteTimer = null, busy = false;

  // These styles belong to sign-in, so they travel with it.
  const css = document.createElement('style');
  css.textContent = `
    .acct-panel {
      display: grid; gap: 10px; padding: 16px; width: 100%; max-width: 360px;
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,.10); text-align: left;
    }
    .acct-panel h3 { margin: 0; font-size: 1rem; }
    /* 16px keeps iOS from zooming the page when a field takes focus. */
    .acct-panel input { width: 100%; font-size: 16px; padding: 11px 12px; }
    .acct-panel .go button { padding: 11px 14px; font-size: .95rem; }
    @media (max-width: 720px) {
      .acct-panel { max-width: none; }
      .acct-links { gap: 10px 16px; font-size: .85rem; }
      .acct-links button { font-size: .85rem; }
    }
    .acct-panel .go { display: flex; gap: 8px; flex-wrap: wrap; }
    .acct-panel .go button { flex: 1 1 auto; }
    .acct-links { display: flex; flex-wrap: wrap; gap: 4px 14px; }
    .acct-links button {
      border: 0; background: none; padding: 0; font-size: .8rem; font-weight: 600;
      color: var(--accent); cursor: pointer; text-decoration: underline;
    }
    .acct-links button:hover { background: none; filter: brightness(1.12); }
  `;
  document.head.appendChild(css);

  // ---- Start ----
  const sdk = document.createElement('script');
  sdk.src = SDK;
  sdk.onerror = () => { note = 'Cloud save is offline. Your team is still saved in this browser.'; render(); };
  sdk.onload = async () => {
    supa = window.supabase.createClient(cfg.url, key);
    const { data } = await supa.auth.getSession();
    user = (data.session && data.session.user) || null;
    supa.auth.onAuthStateChange((event, session) => {
      const next = (session && session.user) || null;
      const swapped = (next && next.id) !== (user && user.id);
      user = next;
      // A recovery link signs the coach in for one purpose: setting a password.
      if (event === 'PASSWORD_RECOVERY') { mode = 'recover'; note = ''; return render(); }
      if (swapped) refresh(); else render();
    });
    refresh();
  };
  document.head.appendChild(sdk);

  async function refresh() {
    teams = [];
    teamId = null;
    note = ''; // Signing in answers "check your email", so drop that line.
    clearTimeout(noteTimer);
    if (user) {
      mode = 'closed';
      const saved = localStorage.getItem(TEAM_KEY);
      await loadTeams();
      if (saved && teams.some(t => t.id === saved)) teamId = saved;
    }
    render();
  }

  async function loadTeams() {
    const { data, error } = await supa.from('teams').select('id,name,updated_at').order('updated_at', { ascending: false });
    teams = error ? [] : (data || []);
    if (error) note = 'Could not read your teams.';
  }

  // ---- The bar at the top of the page ----
  let lastMode = null;
  function render() {
    if (!supa) { bar.innerHTML = noteHTML(); return; }
    if (user && mode !== 'recover') bar.innerHTML = signedInHTML();
    else if (mode === 'closed') bar.innerHTML = closedHTML();
    else bar.innerHTML = panelHTML();
    // Focus the first field when the panel opens, not on every redraw.
    if (mode !== 'closed' && mode !== lastMode) {
      const first = bar.querySelector('input');
      if (first) first.focus({ preventScroll: true });
    }
    lastMode = mode;
  }

  // The slot stays in the page, so a message can change without redrawing the
  // form. A redraw would wipe whatever the coach has typed.
  const noteHTML = () => `<span class="acct-note" data-note ${note ? '' : 'hidden'}>${esc(note)}</span>`;

  function closedHTML() {
    return `<div class="acct">
      ${noteHTML()}
      <span class="acct-label">Save your teams to your account</span>
      <button id="acct-open" class="primary">Sign in</button>
    </div>`;
  }

  function panelHTML() {
    if (mode === 'recover') {
      return `<form class="acct-panel" id="acct-form" data-mode="recover">
        <h3>${user ? 'Set a password' : 'Pick a new password'}</h3>
        <input type="password" id="acct-pass" placeholder="New password" autocomplete="new-password" minlength="8" required>
        <div class="go"><button type="submit" class="primary">Save password</button></div>
        ${noteHTML()}
        ${user ? '<div class="acct-links"><button type="button" data-go="closed">Cancel</button></div>' : ''}
      </form>`;
    }
    if (mode === 'link') {
      return `<form class="acct-panel" id="acct-form" data-mode="link">
        <h3>Email me a link</h3>
        <input type="email" id="acct-email" placeholder="you@example.com" autocomplete="email" required>
        <div class="go"><button type="submit" class="primary">Send the link</button></div>
        ${noteHTML()}
        <div class="acct-links">
          <button type="button" data-go="password">Use a password instead</button>
          <button type="button" data-go="closed">Cancel</button>
        </div>
      </form>`;
    }
    return `<form class="acct-panel" id="acct-form" data-mode="password">
      <h3>Sign in</h3>
      <input type="email" id="acct-email" placeholder="you@example.com" autocomplete="email" required>
      <input type="password" id="acct-pass" placeholder="Password" autocomplete="current-password" minlength="8" required>
      <div class="go">
        <button type="submit" class="primary">Sign in</button>
        <button type="button" id="acct-new-user">Create account</button>
      </div>
      ${noteHTML()}
      <div class="acct-links">
        <button type="button" data-go="link">Email me a link instead</button>
        <button type="button" id="acct-forgot">Forgot password</button>
        <button type="button" data-go="closed">Cancel</button>
      </div>
    </form>`;
  }

  function signedInHTML() {
    const options = teams.map(t => `<option value="${esc(t.id)}" ${t.id === teamId ? 'selected' : ''}>${esc(t.name || 'My team')}</option>`).join('');
    return `<div class="acct">
      ${teams.length ? `<select id="acct-team" aria-label="Your teams"><option value="">Not saved yet</option>${options}</select>` : ''}
      <button id="acct-save" class="${teamId ? '' : 'primary'}">${teamId ? 'Save now' : 'Save this team'}</button>
      ${teamId ? '<button id="acct-new">Save as new</button>' : ''}
      ${noteHTML()}
      <span class="acct-user">${esc(user.email || 'Signed in')}</span>
      <button id="acct-pass-set">Set a password</button>
      <button id="acct-out">Sign out</button>
    </div>`;
  }

  function setNote(text, keep) {
    note = text;
    clearTimeout(noteTimer);
    if (!keep) noteTimer = setTimeout(() => { note = ''; paintNote(); }, 3000);
    paintNote();
  }
  function paintNote() {
    const el = bar.querySelector('[data-note]');
    if (!el) return render();
    el.textContent = note;
    el.hidden = !note;
  }

  // Supabase speaks in its own terms. Coaches should not have to.
  function plain(error) {
    const m = (error && error.message) || 'Something went wrong.';
    if (/invalid login credentials/i.test(m)) return 'That email and password do not match.';
    if (/already registered/i.test(m)) return 'That email already has an account. Sign in instead.';
    if (/email not confirmed/i.test(m)) return 'Confirm your email first. Check your inbox for the link.';
    if (/should be at least|password.*6 char/i.test(m)) return 'Use a password of at least 8 characters.';
    if (/rate limit|too many|for security purposes/i.test(m)) return 'Too many tries. Wait a minute, then try again.';
    return m;
  }

  const field = id => ((document.getElementById(id) || {}).value || '');

  // ---- Buttons ----
  bar.addEventListener('click', async e => {
    const go = e.target.closest('[data-go]');
    if (go) { mode = go.dataset.go; note = ''; return render(); }
    const id = e.target.id;
    if (id === 'acct-open') { mode = 'password'; note = ''; return render(); }
    // Signed in by link, and would rather have a password next time.
    if (id === 'acct-pass-set') { mode = 'recover'; note = ''; return render(); }
    if (id === 'acct-new-user') return signUp();
    if (id === 'acct-forgot') return forgot();
    if (id === 'acct-save') return saveNow();
    if (id === 'acct-new') { teamId = null; localStorage.removeItem(TEAM_KEY); return saveNow(); }
    if (id === 'acct-out') {
      await supa.auth.signOut();
      localStorage.removeItem(TEAM_KEY);
      // The team stays in this browser. Signing out drops the cloud copy only.
      setNote('Signed out.');
    }
  });

  bar.addEventListener('submit', e => {
    e.preventDefault();
    if (busy) return;
    const how = e.target.dataset.mode;
    if (how === 'recover') return newPassword();
    if (how === 'link') return sendLink();
    return signIn();
  });

  bar.addEventListener('change', e => {
    if (e.target.id !== 'acct-team') return;
    const id = e.target.value;
    if (id) openTeam(id);
    else { teamId = null; localStorage.removeItem(TEAM_KEY); render(); }
  });

  // ---- Ways in ----
  async function signIn() {
    const email = field('acct-email').trim(), password = field('acct-pass');
    if (!email || !password) return;
    busy = true; setNote('Signing in…', true);
    const { error } = await supa.auth.signInWithPassword({ email, password });
    busy = false;
    if (error) setNote(plain(error), true);
    // On success, onAuthStateChange redraws the bar.
  }

  async function signUp() {
    const email = field('acct-email').trim(), password = field('acct-pass');
    if (!email || !password) return setNote('Fill in an email and a password first.', true);
    if (password.length < 8) return setNote('Use a password of at least 8 characters.', true);
    busy = true; setNote('Creating your account…', true);
    const { data, error } = await supa.auth.signUp({
      email, password,
      options: { emailRedirectTo: location.origin + location.pathname },
    });
    busy = false;
    if (error) return setNote(plain(error), true);
    // Supabase will not say whether an address is taken, so an existing account
    // comes back as success with no identities and no email sent. Saying "check
    // your email" there sends a coach to an empty inbox.
    const known = data.user && Array.isArray(data.user.identities) && !data.user.identities.length;
    if (known) return setNote('That email already has an account. Use Forgot password to set one.', true);
    if (!data.session) setNote('Check your email to confirm the account, then sign in.', true);
  }

  async function sendLink() {
    const email = field('acct-email').trim();
    if (!email) return;
    busy = true; setNote('Sending…', true);
    const { error } = await supa.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: location.origin + location.pathname },
    });
    busy = false;
    if (error) return setNote(plain(error), true);
    // A session can already exist here if the coach signed in on another tab.
    if (!user) setNote('Check your email. The link signs you in.', true);
  }

  async function forgot() {
    const email = field('acct-email').trim();
    if (!email) return setNote('Type your email first, then press Forgot password.', true);
    busy = true; setNote('Sending…', true);
    const { error } = await supa.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    busy = false;
    setNote(error ? plain(error) : 'Check your email for a link to set a new password.', true);
  }

  async function newPassword() {
    const password = field('acct-pass');
    if (password.length < 8) return setNote('Use a password of at least 8 characters.', true);
    busy = true; setNote('Saving…', true);
    const { error } = await supa.auth.updateUser({ password });
    busy = false;
    if (error) return setNote(plain(error), true);
    mode = 'closed';
    setNote('Password saved.');
    refresh();
  }

  // ---- Cloud copy ----
  async function openTeam(id) {
    const { data, error } = await supa.from('teams').select('*').eq('id', id).single();
    if (error) return setNote('Could not open that team.');
    teamId = id;
    localStorage.setItem(TEAM_KEY, id);
    apply(data);
    setNote('Opened ' + (data.name || 'team') + '.');
  }

  function apply(row) {
    loading = true;
    const set = row.settings || {}, game = row.lineup || {};
    s.team = row.name || '';
    s.players = Array.isArray(row.players) ? row.players : [];
    ['innings', 'early', 'outfield', 'minPlay'].forEach(k => { if (typeof set[k] === 'number') s[k] = set[k]; });
    if (typeof set.pcInfield === 'boolean') s.pcInfield = set.pcInfield;
    if (typeof set.printPlayers === 'boolean') s.printPlayers = set.printPlayers;
    if (Array.isArray(set.positions) && set.positions.length) s.positions = set.positions;
    s.posCaps = set.posCaps && typeof set.posCaps === 'object' ? set.posCaps : {};
    s.season = Array.isArray(set.season) ? set.season : [];
    if (set.pitch && typeof set.pitch === 'object') s.pitch = set.pitch;
    s.grid = Array.isArray(game.grid) ? game.grid : [];
    s.opponent = game.opponent || '';
    s.date = game.date || '';
    changed(true);
    loading = false;
  }

  function row() {
    return {
      name: s.team || 'My team',
      players: s.players,
      settings: {
        innings: s.innings, early: s.early, outfield: s.outfield, minPlay: s.minPlay,
        pcInfield: s.pcInfield, printPlayers: s.printPlayers,
        positions: s.positions, posCaps: s.posCaps, season: s.season, pitch: s.pitch,
      },
      lineup: { grid: s.grid, opponent: s.opponent, date: s.date },
      updated_at: new Date().toISOString(),
    };
  }

  async function saveNow() {
    if (!user) return;
    clearTimeout(timer);
    if (teamId) {
      const { error } = await supa.from('teams').update(row()).eq('id', teamId);
      if (error) return setNote('Could not save. Your team is still in this browser.', true);
      await loadTeams();
      return setNote('Saved.');
    }
    const { data, error } = await supa.from('teams').insert(row()).select('id').single();
    if (error) return setNote('Could not save. Your team is still in this browser.', true);
    teamId = data.id;
    localStorage.setItem(TEAM_KEY, teamId);
    await loadTeams();
    setNote('Saved.');
  }

  // Every edit already calls the app's save(). Follow it to the cloud, once the
  // typing stops, and only for a team that is already saved.
  const appSave = window.save;
  window.save = function () {
    appSave();
    if (loading || !user || !teamId) return;
    clearTimeout(timer);
    timer = setTimeout(saveNow, SAVE_WAIT);
  };
})();
