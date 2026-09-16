// Sign-in and cloud save.
//
// The tool works with no account. Everything lives in this browser, which is what
// a coach wants at a field with no signal. Signing in adds a copy in the cloud, so
// the same team opens on a phone, a laptop, or an assistant coach's device.
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
  let loading = false, timer = null, note = '', noteTimer = null;

  // ---- Start ----
  const sdk = document.createElement('script');
  sdk.src = SDK;
  sdk.onerror = () => { note = 'Cloud save is offline. Your team is still saved in this browser.'; render(); };
  sdk.onload = async () => {
    supa = window.supabase.createClient(cfg.url, key);
    const { data } = await supa.auth.getSession();
    user = (data.session && data.session.user) || null;
    supa.auth.onAuthStateChange((_event, session) => {
      const next = (session && session.user) || null;
      const changedUser = (next && next.id) !== (user && user.id);
      user = next;
      if (changedUser) refresh(); else render();
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
  function render() {
    if (!supa) { bar.innerHTML = noteHTML(); return; }
    bar.innerHTML = user ? signedInHTML() : signedOutHTML();
  }
  function noteHTML() {
    return note ? `<span class="acct-note">${esc(note)}</span>` : '';
  }
  function signedOutHTML() {
    return `<form class="acct" id="acct-form">
      <span class="acct-label">Save your teams to your account</span>
      <input type="email" id="acct-email" placeholder="you@example.com" autocomplete="email" required>
      <button type="submit" class="primary">Email me a link</button>
      ${noteHTML()}
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
      <button id="acct-out">Sign out</button>
    </div>`;
  }
  function setNote(text, keep) {
    note = text;
    clearTimeout(noteTimer);
    if (!keep) noteTimer = setTimeout(() => { note = ''; render(); }, 3000);
    render();
  }

  bar.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('acct-email').value.trim();
    if (!email) return;
    setNote('Sending…', true);
    const { error } = await supa.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: location.origin + location.pathname },
    });
    if (error) return setNote('That did not send: ' + error.message, true);
    // A session can already exist here if the coach signed in on another tab.
    if (!user) setNote('Check your email. The link signs you in.', true);
  });

  bar.addEventListener('click', async e => {
    const id = e.target.id;
    if (id === 'acct-save') return saveNow();
    if (id === 'acct-new') { teamId = null; localStorage.removeItem(TEAM_KEY); return saveNow(); }
    if (id === 'acct-out') {
      await supa.auth.signOut();
      localStorage.removeItem(TEAM_KEY);
      // The team stays in this browser. Signing out drops the cloud copy only.
      setNote('Signed out.');
    }
  });

  bar.addEventListener('change', e => {
    if (e.target.id !== 'acct-team') return;
    const id = e.target.value;
    if (id) openTeam(id);
    else { teamId = null; localStorage.removeItem(TEAM_KEY); render(); }
  });

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
    ['innings', 'early', 'outfield'].forEach(k => { if (typeof set[k] === 'number') s[k] = set[k]; });
    if (typeof set.pcInfield === 'boolean') s.pcInfield = set.pcInfield;
    if (typeof set.printPlayers === 'boolean') s.printPlayers = set.printPlayers;
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
      settings: { innings: s.innings, early: s.early, outfield: s.outfield, pcInfield: s.pcInfield, printPlayers: s.printPlayers },
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
