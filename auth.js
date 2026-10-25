/* I Hate Trains v35 accounts. Standalone, vanilla, zero dependencies.
   Loaded AFTER app.js. It never edits app.js state and never touches the
   panic, breathe, ride, trip, pet, voice, sound, or metro code paths.

   HARD RULES, enforced in code, not just in docs:
   - Guest is the default. With no config, state is "guest" and the whole
     app works exactly as today. Nothing in this file gates any screen.
   - Until the owner approves provisioning AND a real config is supplied,
     every sign in button is disabled and labeled "Coming soon". This file
     never invents a session. A signed in state comes only from a real
     Supabase session (supabase.auth.getSession / onAuthStateChange).
   - Local preview is opt in only (config.localPreview = true) and is
     labeled in the UI as a local preview, never as a real account. It
     stores one flag on this phone and talks to no server.
   - No secret is in this file. The config holds placeholders only. The
     service role key must never appear here or in the browser at all.

   CONFIG: the coordinator sets window.IHT_ACCOUNT_CONFIG before this
   script runs (see the snippet file). Any field left at its placeholder
   value means "not configured".

   SUPABASE PASSKEY NOTE: Supabase Auth sign in today is OAuth (Apple,
   Google) or email magic link. Passkeys are the FIRST button in the UI
   and, once configured, use Supabase Auth MFA WebAuthn enrollment and
   verification (factorType "webauthn") after a first sign in, so a
   returning user can unlock with Face ID or Touch ID on their phone.
   A passkey button never creates a session on its own, and on a phone
   without a platform authenticator it says so plainly instead of failing
   silently. See SUPABASE_SETUP.md for the dashboard steps.
*/
(function () {
  'use strict';

  var PLACEHOLDER_URL = 'https://YOUR-PROJECT.supabase.co';
  var PLACEHOLDER_KEY = 'YOUR-SUPABASE-ANON-KEY';
  var PREVIEW_FLAG = 'iht_account_preview';
  var PET_DEFAULTS = { blob: 'Mochi', bird: 'Pip', cat: 'Miso', fox: 'Rusty', frog: 'Fern', panda: 'Bao', bunny: 'Mallow' };

  /* The single config object. Placeholders only. Never a real credential. */
  var config = window.IHT_ACCOUNT_CONFIG || {};
  config.supabaseUrl = config.supabaseUrl || PLACEHOLDER_URL;
  config.supabaseAnonKey = config.supabaseAnonKey || PLACEHOLDER_KEY;
  config.localPreview = config.localPreview === true;

  function isConfigured() {
    return !!config.supabaseUrl && config.supabaseUrl !== PLACEHOLDER_URL &&
      config.supabaseUrl.indexOf('https://') === 0 &&
      !!config.supabaseAnonKey && config.supabaseAnonKey !== PLACEHOLDER_KEY;
  }

  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function readJSON(k, fb) { try { var v = JSON.parse(read(k)); return v == null ? fb : v; } catch (e) { return fb; } }
  function $(id) { return document.getElementById(id); }

  /* On device names, read straight from the keys app.js already owns.
     This file reads them; it never writes iht_profile or iht_pet. */
  function petName() {
    var pet = readJSON('iht_pet', null) || {};
    return pet.name || PET_DEFAULTS[pet.type] || 'Mochi';
  }
  function userName() {
    var profile = readJSON('iht_profile', null) || {};
    return (profile.name || '').trim();
  }

  /* State: "guest" | "preview" | "signed-in". Guest is the default. */
  var state = { status: 'guest', user: null, error: '' };
  var client = null;
  var clientPromise = null;

  function refreshPreviewState() {
    if (config.localPreview && read(PREVIEW_FLAG) === '1') { state.status = 'preview'; }
    else if (state.status === 'preview') { state.status = 'guest'; }
  }

  function petGreeting() {
    var pet = petName();
    var name = userName();
    if (state.status === 'signed-in' && state.user) {
      var who = (state.user.user_metadata && state.user.user_metadata.full_name) || state.user.email || name || 'friend';
      return 'Hi ' + who + '. ' + pet + ' is glad you are back. One tap and you are riding again.';
    }
    if (state.status === 'preview') {
      return 'Hi ' + (name || 'friend') + '. ' + pet + ' is riding with you. This is a local preview, not a real account yet.';
    }
    if (name) {
      return 'Hi ' + name + '. ' + pet + ' is riding with you, account or no account.';
    }
    return 'Hi there. ' + pet + ' is riding with you, account or no account.';
  }

  function goHome() {
    var home = document.querySelector('[data-go="screen-home"]');
    if (home) { home.click(); return; }
    /* Fallback if the router is not present: show home, hide account. */
    var acct = $('screen-account');
    var homeScreen = $('screen-home');
    if (acct) { acct.classList.remove('active'); }
    if (homeScreen) { homeScreen.classList.add('active'); }
  }

  function setStatus(msg) {
    var el = $('acct-status');
    if (el) { el.textContent = msg || ''; }
    state.error = msg || '';
  }

  /* Render every account element that exists. Safe to call before the
     snippet is pasted in: it simply does nothing when the ids are absent. */
  function render() {
    refreshPreviewState();
    var configured = isConfigured();
    var signedIn = state.status === 'signed-in';
    var preview = state.status === 'preview';

    var greet = $('acct-greet');
    if (greet) { greet.textContent = petGreeting(); }
    var banner = $('acct-preview-banner');
    if (banner) { banner.hidden = !preview; }
    var homeName = $('acct-home-name');
    if (homeName) {
      homeName.textContent = signedIn ? 'Signed in. Tap to manage your account.' :
        preview ? 'Local preview. Tap to manage.' :
        'Guest. Tap to see account options. No account needed.';
    }
    var signedBlock = $('acct-signed-block');
    if (signedBlock) { signedBlock.hidden = !(signedIn || preview); }
    var guestBlock = $('acct-guest-block');
    if (guestBlock) { guestBlock.hidden = signedIn || preview; }
    var who = $('acct-who');
    if (who) {
      who.textContent = signedIn && state.user ? (state.user.email || 'Signed in') :
        preview ? 'Local preview on this phone only' : 'Guest on this phone';
    }

    /* Honest buttons: disabled plus "Coming soon" while unconfigured.
       Signed in and preview states enable only sign out and deletion. */
    var actions = document.querySelectorAll('[data-acct-action]');
    for (var i = 0; i < actions.length; i++) {
      var btn = actions[i];
      var action = btn.getAttribute('data-acct-action');
      var base = btn.getAttribute('data-acct-label') || btn.textContent.replace(/\s*Coming soon\s*$/, '');
      if (!btn.getAttribute('data-acct-label')) { btn.setAttribute('data-acct-label', base); }
      var soon = btn.querySelector('.acct-soon');
      if (action === 'continue-guest' || action === 'sign-out' || action === 'delete-request') {
        btn.disabled = false;
        btn.setAttribute('aria-disabled', 'false');
        if (soon) { soon.remove(); }
        btn.textContent = base;
        if (action === 'sign-out') { btn.disabled = !(signedIn || preview); }
        if (action === 'delete-request') { btn.disabled = false; }
      } else if (!configured && !preview) {
        btn.disabled = true;
        btn.setAttribute('aria-disabled', 'true');
        btn.textContent = base;
        var tag = document.createElement('span');
        tag.className = 'acct-soon';
        tag.textContent = 'Coming soon';
        btn.appendChild(tag);
      } else {
        btn.disabled = false;
        btn.setAttribute('aria-disabled', 'false');
        btn.textContent = base;
        if (action === 'passkey' && !preview && !signedIn) {
          /* First sign in still needs OAuth or magic link; passkey is
             enrolled after that. The label says so on the button row
             note, and the handler explains it rather than faking it. */
        }
      }
    }
  }

  function loadClient() {
    if (client) { return Promise.resolve(client); }
    if (clientPromise) { return clientPromise; }
    if (!isConfigured()) { return Promise.reject(new Error('Accounts are not configured yet.')); }
    clientPromise = new Promise(function (resolve, reject) {
      if (window.supabase && window.supabase.createClient) {
        client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
        resolve(client);
        return;
      }
      /* Supabase JS is loaded only when configured, never for guests. */
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      s.onload = function () {
        try {
          client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
          resolve(client);
        } catch (e) { reject(e); }
      };
      s.onerror = function () { reject(new Error('Could not load the sign in service. Try again with signal.')); };
      document.head.appendChild(s);
    });
    return clientPromise;
  }

  function requireConfigured() {
    if (!isConfigured()) {
      setStatus('Accounts are coming soon. Nothing to sign in to yet, and guest mode works fully.');
      render();
      return false;
    }
    return true;
  }

  function passkeySupported() {
    if (!window.PublicKeyCredential) { return Promise.resolve(false); }
    try {
      if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        return window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      }
    } catch (e) {}
    return Promise.resolve(true);
  }

  function signInWithPasskey() {
    if (!requireConfigured()) { return Promise.resolve({ ok: false, reason: 'unconfigured' }); }
    return passkeySupported().then(function (ok) {
      if (!ok) {
        setStatus('This phone does not offer Face ID, Touch ID, or another passkey unlock, so passkeys cannot work here. Apple, Google, or a magic link still will.');
        return { ok: false, reason: 'no-platform-authenticator' };
      }
      if (!state.user) {
        setStatus('Passkeys unlock a return visit after your first sign in. Sign in once with Apple, Google, or a magic link, then add a passkey from your account screen.');
        return { ok: false, reason: 'needs-first-sign-in' };
      }
      return loadClient().then(function (c) {
        /* Enroll a WebAuthn factor on the signed in session. This is the
           real Supabase Auth MFA WebAuthn path, not a local shortcut. */
        return c.auth.mfa.enroll({ factorType: 'webauthn', friendlyName: 'This phone' }).then(function (res) {
          if (res.error) { setStatus('Passkey setup hit a snag: ' + res.error.message); return { ok: false, reason: 'enroll-failed' }; }
          setStatus('Passkey added on this phone. Next time, it is one tap.');
          return { ok: true, factorId: res.data && res.data.id };
        });
      }).catch(function (e) { setStatus(e.message || 'Passkey setup failed.'); return { ok: false, reason: 'error' }; });
    });
  }

  function signInWithOAuth(provider) {
    if (!requireConfigured()) { return Promise.resolve({ ok: false, reason: 'unconfigured' }); }
    return loadClient().then(function (c) {
      return c.auth.signInWithOAuth({
        provider: provider,
        options: { redirectTo: window.location.origin + window.location.pathname }
      });
    }).then(function (res) {
      if (res && res.error) { setStatus(res.error.message); return { ok: false, reason: 'oauth-failed' }; }
      return { ok: true };
    }).catch(function (e) { setStatus(e.message || 'Sign in failed.'); return { ok: false, reason: 'error' }; });
  }

  function sendMagicLink(email) {
    email = (email || '').trim();
    if (!email || email.indexOf('@') === -1) {
      setStatus('Type an email address first, and the magic link will go there.');
      return Promise.resolve({ ok: false, reason: 'bad-email' });
    }
    if (!requireConfigured()) { return Promise.resolve({ ok: false, reason: 'unconfigured' }); }
    return loadClient().then(function (c) {
      return c.auth.signInWithOtp({
        email: email,
        options: { emailRedirectTo: window.location.origin + window.location.pathname }
      });
    }).then(function (res) {
      if (res && res.error) { setStatus(res.error.message); return { ok: false, reason: 'otp-failed' }; }
      setStatus('Magic link sent to ' + email + '. Open it on this phone to sign in.');
      return { ok: true };
    }).catch(function (e) { setStatus(e.message || 'Magic link failed.'); return { ok: false, reason: 'error' }; });
  }

  function signOut() {
    if (state.status === 'preview') {
      try { localStorage.removeItem(PREVIEW_FLAG); } catch (e) {}
      state.status = 'guest';
      state.user = null;
      setStatus('Local preview ended. You are back to guest mode, and nothing changed on this phone.');
      render();
      return Promise.resolve({ ok: true });
    }
    if (!isConfigured() || !client) {
      state.status = 'guest';
      state.user = null;
      render();
      return Promise.resolve({ ok: true });
    }
    return client.auth.signOut().then(function () {
      state.status = 'guest';
      state.user = null;
      render();
      return { ok: true };
    });
  }

  function requestAccountDeletion() {
    if (state.status === 'guest') {
      setStatus('You are in guest mode, so there is no account to delete. Everything here lives only on this phone, and the Privacy screen can erase it.');
      return Promise.resolve({ ok: false, reason: 'guest-no-account' });
    }
    if (state.status === 'preview') {
      try { localStorage.removeItem(PREVIEW_FLAG); } catch (e) {}
      state.status = 'guest';
      setStatus('Local preview cleared. There was never a real account behind it.');
      render();
      return Promise.resolve({ ok: true, mode: 'preview' });
    }
    if (!requireConfigured()) { return Promise.resolve({ ok: false, reason: 'unconfigured' }); }
    return loadClient().then(function (c) {
      return c.from('account_deletion_requests').insert({ user_id: state.user.id, status: 'pending' });
    }).then(function (res) {
      if (res && res.error) { setStatus('Deletion request failed: ' + res.error.message); return { ok: false, reason: 'insert-failed' }; }
      setStatus('Deletion requested. Your account data is queued for removal, and you are now signed out.');
      return signOut().then(function () { return { ok: true }; });
    }).catch(function (e) { setStatus(e.message || 'Deletion request failed.'); return { ok: false, reason: 'error' }; });
  }

  /* Local snapshot, keyed exactly to the on device keys app.js owns.
     The backup plan contact phone number is deliberately left out of
     cloud sync: it belongs to someone else and stays on this phone. */
  function collectLocalSnapshot() {
    var plan = readJSON('iht_plan', null) || {};
    var safePlan = {};
    var planKeys = ['exit', 'reach', 'reachName', 'pocket', 'c1', 'c2', 'c3'];
    planKeys.forEach(function (k) { if (plan[k] !== undefined) { safePlan[k] = plan[k]; } });
    return {
      profile: readJSON('iht_profile', {}),
      pet: readJSON('iht_pet', {}),
      prefs: readJSON('iht_prefs', {}),
      plan: safePlan,
      journal: readJSON('iht_journal', []),
      trips: readJSON('iht_trips', []),
      comfort: readJSON('iht_comfort', null),
      collectedAt: new Date().toISOString()
    };
  }

  function pushToCloud() {
    if (state.status !== 'signed-in' || !state.user) {
      return Promise.resolve({ ok: false, reason: 'not-signed-in' });
    }
    if (!requireConfigured()) { return Promise.resolve({ ok: false, reason: 'unconfigured' }); }
    var snap = collectLocalSnapshot();
    return loadClient().then(function (c) {
      var profileRow = {
        id: state.user.id,
        display_name: (snap.profile && snap.profile.name) || null,
        city: (snap.profile && snap.profile.city) || null,
        line: (snap.profile && snap.profile.line) || null,
        pet_type: (snap.pet && snap.pet.type) || null,
        pet_name: (snap.pet && snap.pet.name) || null,
        pet_color: (snap.pet && snap.pet.color) || null,
        pet_accessory: (snap.pet && snap.pet.accessory) || null,
        prefs: snap.prefs || {},
        updated_at: new Date().toISOString()
      };
      return c.from('profiles').upsert(profileRow).then(function (res) {
        if (res.error) { throw res.error; }
        var rows = [
          { user_id: state.user.id, data_key: 'plan', data_value: snap.plan },
          { user_id: state.user.id, data_key: 'journal', data_value: snap.journal },
          { user_id: state.user.id, data_key: 'trips', data_value: snap.trips },
          { user_id: state.user.id, data_key: 'comfort', data_value: snap.comfort }
        ];
        return c.from('user_data').upsert(rows, { onConflict: 'user_id,data_key' });
      });
    }).then(function (res) {
      if (res && res.error) { throw res.error; }
      return { ok: true };
    }).catch(function (e) { return { ok: false, reason: 'sync-failed', message: e.message }; });
  }

  function pullFromCloud() {
    if (state.status !== 'signed-in' || !state.user) {
      return Promise.resolve({ ok: false, reason: 'not-signed-in' });
    }
    if (!requireConfigured()) { return Promise.resolve({ ok: false, reason: 'unconfigured' }); }
    return loadClient().then(function (c) {
      return c.from('user_data').select('data_key,data_value').eq('user_id', state.user.id);
    }).then(function (res) {
      if (res.error) { throw res.error; }
      var out = {};
      (res.data || []).forEach(function (r) { out[r.data_key] = r.data_value; });
      return { ok: true, data: out };
    }).catch(function (e) { return { ok: false, reason: 'sync-failed', message: e.message }; });
  }

  function startLocalPreview() {
    if (!config.localPreview) { return false; }
    store(PREVIEW_FLAG, '1');
    state.status = 'preview';
    render();
    return true;
  }

  var initDone = false;
  function init() {
    if (initDone) { render(); return; }
    initDone = true;
    refreshPreviewState();
    if (isConfigured()) {
      loadClient().then(function (c) {
        return c.auth.getSession();
      }).then(function (res) {
        if (res && res.data && res.data.session && res.data.session.user) {
          state.status = 'signed-in';
          state.user = res.data.session.user;
        }
        render();
      }).catch(function () { render(); });
      loadClient().then(function (c) {
        c.auth.onAuthStateChange(function (event, session) {
          if (session && session.user) { state.status = 'signed-in'; state.user = session.user; }
          else if (state.status === 'signed-in') { state.status = 'guest'; state.user = null; }
          render();
        });
      }).catch(function () {});
    }
    render();
  }

  function wire() {
    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-acct-action]') : null;
      if (!t) { return; }
      var action = t.getAttribute('data-acct-action');
      if (t.disabled) { return; }
      if (action === 'continue-guest') { goHome(); }
      else if (action === 'passkey') { signInWithPasskey(); }
      else if (action === 'apple') { signInWithOAuth('apple'); }
      else if (action === 'google') { signInWithOAuth('google'); }
      else if (action === 'sign-out') { signOut(); }
      else if (action === 'sync') {
        pushToCloud().then(function (r) {
          setStatus(r.ok ? 'Synced. Your co-rider and setup are backed up.' :
            'Sync did not run: ' + (r.reason || 'not signed in') + '. Guest mode still works fully.');
          render();
        });
      }
      else if (action === 'delete-request') {
        if (window.confirm('Request deletion of this account and its synced data? This cannot be undone.')) {
          requestAccountDeletion();
        }
      } else if (action === 'preview') { startLocalPreview(); }
    });
    document.addEventListener('submit', function (e) {
      var f = e.target && e.target.id === 'acct-magic-form' ? e.target : null;
      if (!f) { return; }
      e.preventDefault();
      var input = $('acct-magic-email');
      sendMagicLink(input ? input.value : '');
    });
    document.addEventListener('DOMContentLoaded', init);
    if (document.readyState !== 'loading') { init(); }
  }

  window.IHTAuth = {
    config: config,
    isConfigured: isConfigured,
    getState: function () { refreshPreviewState(); return { status: state.status, user: state.user, configured: isConfigured(), preview: config.localPreview }; },
    isGuest: function () { refreshPreviewState(); return state.status === 'guest'; },
    isSignedIn: function () { return state.status === 'signed-in'; },
    isPreview: function () { refreshPreviewState(); return state.status === 'preview'; },
    petGreeting: petGreeting,
    render: render,
    init: init,
    signInWithPasskey: signInWithPasskey,
    signInWithApple: function () { return signInWithOAuth('apple'); },
    signInWithGoogle: function () { return signInWithOAuth('google'); },
    sendMagicLink: sendMagicLink,
    signOut: signOut,
    requestAccountDeletion: requestAccountDeletion,
    collectLocalSnapshot: collectLocalSnapshot,
    pushToCloud: pushToCloud,
    pullFromCloud: pullFromCloud,
    startLocalPreview: startLocalPreview,
    passkeySupported: passkeySupported
  };

  wire();
})();
