// ------------- Supabase-powered script.js ---------------
// Make sure window.supabase is initialized in the HTML as shown.

let dogs = [];
let selectedDog = null;

// Small HTML escaper used by notification rendering
function escapeHtml(input) {
  try {
    return String(input === undefined || input === null ? '' : input)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  } catch (e) {
    return '';
  }
}
// small cleanup: earlier temporary comment removed

function closeDogModal() {
  document.getElementById('dogInfoModal').style.display = 'none';
}
function closeAdoptModal() {
  document.getElementById('adoptFormModal').style.display = 'none';
}
function openAdoptModal() {
  closeDogModal();
  document.getElementById('adoptFormModal').style.display = 'flex';
}

// Submit adoption to Supabase
async function submitAdoption(formElement) {
  const formData = Object.fromEntries(new FormData(formElement));

  // Minimal payload that matches the `adoptions` table columns
  const payload = {
    dog_id: selectedDog?.id || null,
    applicant_name: formData.name || formData.applicant_name || '',
    applicant_age: formData.age ? parseInt(formData.age) : null,
    applicant_gender: formData.gender || '',
    contact: formData.contact || ''
  };

  try {
    console.log('Submitting adoption payload:', payload);
    const { data, error } = await supabase
      .from('adoptions')
      .insert([payload]);

    if (error) {
      // Log full error object from Supabase for debugging
      console.error('Supabase insert error:', error);
      // If there is a details field, show it too
      if (error.details) console.error('Error details:', error.details);
      throw error;
    }

    console.log('Adoption insert result:', data);

    // Mark dog as Adopted in the dogs table
    if (selectedDog?.id) {
      await supabase
        .from('dogs')
        .update({ status: 'Adopted' })
        .eq('id', selectedDog.id);
    }

    alert('Adoption application submitted — thank you!');
    formElement.reset();
    closeAdoptModal();
  } catch (err) {
    console.error('Adoption submission failed', err);
    alert('Failed to submit adoption. See console for details.');
  }
}

// Wire up DOM events
document.addEventListener('DOMContentLoaded', () => {
  // load dogs
  // Ensure a Supabase client exists for pages that only include the library (like notification.html)
  const ok = ensureSupabaseClientForNotifications();
  if (!ok) {
    console.warn('Supabase client not initialized on DOMContentLoaded; loadDogs will be skipped.');
    // show a friendly message in the dog containers if present
    const g = document.getElementById('dog-gallery'); if (g) g.innerHTML = '<p>Supabase not configured on this page.</p>';
    const l = document.getElementById('dog-list'); if (l) l.innerHTML = '<p>Supabase not configured on this page.</p>';
  } else {
    // load dogs (only if the page provides the function)
    if (typeof loadDogs === 'function') {
      loadDogs();
    } else {
      console.debug('loadDogs not defined on this page; skipping loadDogs.');
    }
  }

  // Adopt Now button (in the dog info modal)
  const adoptNowBtn = document.getElementById('dogAdoptNow');
  if (adoptNowBtn) adoptNowBtn.addEventListener('click', openAdoptModal);

  // Form submit
  const form = document.getElementById('adoptForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submitAdoption(form);
    });
  }

  // Close modal when clicking outside
  window.onclick = (e) => {
    const modals = [document.getElementById('dogInfoModal'), document.getElementById('adoptFormModal')];
    modals.forEach(m => {
      if (e.target === m) m.style.display = 'none';
    });
  };
});

// ---------------- Shared logout logic (migrated from shared-auth.js) ----------------
async function logoutAndRedirect() {
  // Ensure Supabase client available before queries
  if (!ensureSupabaseClientForNotifications()) {
    console.warn('loadDogs: Supabase client not available, aborting loadDogs.');
    const container = document.getElementById('dog-gallery') || document.getElementById('dog-list');
    if (container) container.innerHTML = '<p>Unable to load dogs: Supabase client not initialized.</p>';
    return;
  }
  try {
    if (window.supabase && supabase.auth && typeof supabase.auth.signOut === 'function') {
      await supabase.auth.signOut();
    }
  } catch (e) {
    console.warn('Supabase signOut error:', e);
  }

  try { localStorage.removeItem('loggedUser'); } catch (_) {}
  window.location.href = 'login.html';
}

function attachLogoutHandler(el) {
  if (!el) return;
  el.addEventListener('click', function (e) {
    if (e) e.preventDefault();
    logoutAndRedirect();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('logoutBtn');
  if (btn) {
    try {
      const hasLocal = !!localStorage.getItem('loggedUser');
      btn.style.display = hasLocal ? 'inline-block' : 'none';
    } catch (e) {
      btn.style.display = 'inline-block';
    }
    attachLogoutHandler(btn);
  }
});

// ---------------- Public sidebar proximity expand/collapse ----------------
document.addEventListener('DOMContentLoaded', () => {
  const publicSidebar = document.querySelector('body > .sidebar');
  const content = document.querySelector('.content');
  if (!publicSidebar) return;

  // start collapsed on wide screens
  function setCollapsed() {
    publicSidebar.classList.add('collapsed');
    publicSidebar.classList.remove('expanded');
    if (content) content.style.marginLeft = '100px';
  }
  function setExpanded() {
    publicSidebar.classList.remove('collapsed');
    publicSidebar.classList.add('expanded');
    if (content) content.style.marginLeft = '240px';
  }

  // initialize collapsed on desktop widths
  if (window.innerWidth > 900) setCollapsed(); else setExpanded();

  let collapseTimer = null;

  // Expand when cursor is near left edge (within 60px) or when hovering the sidebar
  function handleProximity(e) {
    try {
      if (window.innerWidth <= 900) return;
      if (e.clientX <= 60) {
        if (collapseTimer) { clearTimeout(collapseTimer); collapseTimer = null; }
        setExpanded();
      } else {
        if (collapseTimer) clearTimeout(collapseTimer);
        // collapse only if cursor is not over the sidebar
        if (!publicSidebar.matches(':hover')) setCollapsed();
      }
    } catch (err) {
      // ignore
    }
  }

  document.addEventListener('mousemove', handleProximity);

  // Also respond to direct enter/leave on sidebar
  publicSidebar.addEventListener('mouseenter', () => {
    if (collapseTimer) { clearTimeout(collapseTimer); collapseTimer = null; }
    setExpanded();
  });
  publicSidebar.addEventListener('mouseleave', () => {
    if (collapseTimer) clearTimeout(collapseTimer);
    setCollapsed();
  });

  // cleanup on resize
  window.addEventListener('resize', () => {
    if (window.innerWidth <= 900) {
      publicSidebar.classList.remove('collapsed');
      if (content) content.style.marginLeft = '';
    } else {
      setCollapsed();
    }
  });
});

/* ---------------- Notifications (moved from notification.html) ---------------- */
// Supabase details (keeps same project used in home.html)
const NOTIF_SUPABASE_URL = "https://ncfsmxmqipfugyphfmmp.supabase.co";
const NOTIF_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jZnNteG1xaXBmdWd5cGhmbW1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NDcwMTIsImV4cCI6MjA3ODUyMzAxMn0.EPB8S9FCggS3YRDBL9NcyiLJs-1On009BfCpQhX1G9U";

function ensureSupabaseClientForNotifications() {
  // If window.supabase already looks like a Supabase client (has `from`), we're good.
  try {
    if (window.supabase && typeof window.supabase.from === 'function') return true;
  } catch (e) { /* ignore */ }

  // If the supabase library is available (global `supabase`), create a client and assign it.
  if (typeof supabase === 'undefined' || !supabase || typeof supabase.createClient !== 'function') {
    console.warn('Supabase library not available on page. Ensure the CDN script is included in the HTML head.');
    return false;
  }

  try {
    window.supabase = supabase.createClient(NOTIF_SUPABASE_URL, NOTIF_SUPABASE_ANON_KEY);
    return true;
  } catch (e) {
    console.error('Could not create Supabase client for notifications:', e);
    return false;
  }
}

function fmtDate(iso) {
  try { const d = new Date(iso); return d.toLocaleString(); } catch (e) { return iso || ''; }
}

async function loadNotifications() {
  const listEl = document.getElementById('notification-list');
  const countEl = document.getElementById('notifCount');
  if (!listEl) return;
  console.debug('loadNotifications: start');
  listEl.innerHTML = '<li class="notif-card">Loading...</li>';

  if (!ensureSupabaseClientForNotifications()) {
    listEl.innerHTML = '<li class="notif-card">Supabase client missing. See console.</li>';
    if (countEl) countEl.textContent = '0';
    return;
  }

  try {
    console.debug('loadNotifications: attempting to read from notifications table');
    // Prefer a dedicated `notifications` table when available
    const { data: notifs, error: notifsErr } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    console.debug('notifications query result:', { notifsErr, notifsCount: (notifs||[]).length });
    if (!notifsErr && Array.isArray(notifs) && notifs.length) {
      // Render notifications table rows
      listEl.innerHTML = '';
      notifs.forEach(n => {
        const li = document.createElement('li');
        li.className = 'notif-card';
        const created = fmtDate(n.created_at || n.created || '');
        const status = (n.status || 'unread');
        const pillClass = status.toLowerCase().includes('read') ? 'status-pending' : 'status-pending';
        li.innerHTML = `
          <img class="notif-avatar" src="" alt="" style="display:none" />
          <div class="notif-body">
            <div class="notif-title">${escapeHtml(n.message || (n.type || 'Notification'))}</div>
            <div class="notif-meta">${escapeHtml(n.recipient || '')} • ${created}</div>
          </div>
          <div style="margin-left:12px; text-align:right;">
            <div class="status-pill ${pillClass}">${escapeHtml(status)}</div>
          </div>
        `;
        listEl.appendChild(li);
      });
      if (countEl) countEl.textContent = String(notifs.length);
      console.debug('loadNotifications: rendered notifications table rows, count=', notifs.length);
      return;
    }

    // Fallback: show recent adoptions (backwards compatibility)
    // Prefer selecting adoptions for the current user (by email/contact) when available,
    // otherwise try an unfiltered query. If permissions prevent reading adoptions for
    // anonymous users, show a friendly message prompting the user to sign in.
    const recipient = await getCurrentRecipientIdentifier();
    // Adaptive query: sequentially try likely recipient columns instead of
    // building a complex `.or()` expression. This avoids malformed requests
    // and reduces 400 errors from PostgREST when values contain special chars.
    const adoptionsRes = await (async function queryAdoptionsWithAdaptiveFilter(recipient) {
      const candidates = ['email', 'contact', 'applicant_email', 'applicant_name'];

      async function tryColumn(col) {
        try {
          const res = await supabase
            .from('adoptions')
            .select('*')
            .eq(col, recipient)
            .order('created_at', { ascending: false })
            .limit(50);
          // If the column doesn't exist, PostgREST may return an error mentioning it.
          if (res && res.error) {
            const msg = String(res.error.message || res.error || '');
            const m = msg.match(/column "?((?:[a-z0-9_]+\.)?([a-z0-9_]+))"? does not exist/i);
            const missingCol = m ? (m[2] || m[1]) : null;
            if (missingCol === col) {
              return { data: null, error: { missingColumn: true, original: res.error } };
            }
            return res;
          }
          return res;
        } catch (e) {
          const msg = String(e?.message || e);
          const m = msg.match(/column "?((?:[a-z0-9_]+\.)?([a-z0-9_]+))"? does not exist/i);
          const missingCol = m ? (m[2] || m[1]) : null;
          if (missingCol === col) return { data: null, error: { missingColumn: true, original: e } };
          return { data: null, error: e };
        }
      }

      if (recipient) {
        for (const col of candidates) {
          const r = await tryColumn(col);
          if (r && r.error && r.error.missingColumn) {
            // column not present; try next candidate
            continue;
          }
          if (r && r.error) {
            // some other error (permissions/network); return it so caller can handle
            return r;
          }
          if (r && Array.isArray(r.data) && r.data.length) {
            return r;
          }
          // no rows, try next column
        }
      }

      // As a last resort, try an unfiltered request (may be blocked by RLS)
      try {
        return await supabase
          .from('adoptions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);
      } catch (e) {
        return { data: null, error: e };
      }
    })(recipient);

    const { data: adoptions, error } = adoptionsRes || {};
    // If we received a permissions error and there is no recipient filter, prompt login
    if (error) {
      console.warn('Adoptions query error:', error);
      // If we tried an unfiltered request and it failed, ask the user to sign in
      if (!recipient) {
        listEl.innerHTML = '<li class="notif-card">No notifications available. Please sign in to view your notifications.</li>';
        if (countEl) countEl.textContent = '0';
        return;
      }
      // If we filtered by recipient but got an error, surface the fallback message
      throw error;
    }

    if (!adoptions || !adoptions.length) {
      listEl.innerHTML = '<li class="notif-card">No notifications yet.</li>';
      if (countEl) countEl.textContent = '0';
      console.debug('loadNotifications: no adoptions found for fallback');
      return;
    }

    const dogIds = [...new Set(adoptions.map(a => a.dog_id).filter(Boolean))];
    let dogsMap = {};
    if (dogIds.length) {
      const { data: dogs } = await supabase.from('dogs').select('id,name,image_url').in('id', dogIds);
      (dogs || []).forEach(d => { dogsMap[d.id] = d; });
    }

    listEl.innerHTML = '';
    adoptions.forEach(a => {
      const dog = dogsMap[a.dog_id] || {};
      const status = (a.status || 'Pending').toString();
      const pillClass = status.toLowerCase().includes('approve') ? 'status-approved' : (status.toLowerCase().includes('reject') ? 'status-rejected' : 'status-pending');

      // Compose a readable message similar to what the admin script inserts into `notifications`.
      const shortMessage = (function() {
        const base = `Your adoption request${a.dog_id ? ' (dog #' + a.dog_id + ')' : ''}`;
        if (status.toLowerCase().includes('approve')) return base + ' has been Approved.';
        if (status.toLowerCase().includes('reject')) return base + ' has been Rejected.';
        return base + ` is ${status}.`;
      })();

      const li = document.createElement('li');
      li.className = 'notif-card';
      li.innerHTML = `
        <img class="notif-avatar" src="${dog.image_url || ''}" alt="${dog.name || ''}" onerror="this.style.display='none'" />
        <div class="notif-body">
          <div class="notif-title">${escapeHtml(shortMessage)}</div>
          <div class="notif-meta">Applicant: ${escapeHtml(a.applicant_name || a.contact || '—')} • ${fmtDate(a.created_at)}</div>
        </div>
        <div style="margin-left:12px; text-align:right;">
          <div class="status-pill ${pillClass}">${escapeHtml(status)}</div>
        </div>
      `;
      listEl.appendChild(li);
    });

    if (countEl) countEl.textContent = String(adoptions.length);
    console.debug('loadNotifications: rendered adoptions fallback, count=', adoptions.length);
  } catch (err) {
    console.error('Failed to load notifications', err);
    listEl.innerHTML = `<li class="notif-card">Unable to load notifications. ${escapeHtml(err?.message || String(err))}</li>`;
    if (countEl) countEl.textContent = '0';
  }
}

// Auto-load notifications when the page contains the notification-list element
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('notification-list')) {
    if (ensureSupabaseClientForNotifications()) loadNotifications();
    setInterval(loadNotifications, 30000);
  }
});

// ---------------- Real-time subscription for notifications ----------------
// This will push new notifications to the user in real-time (if server supports Realtime).
let _notifChannel = null;
async function getCurrentRecipientIdentifier() {
  // Try Supabase auth first
  try {
    if (window.supabase && supabase.auth && typeof supabase.auth.getUser === 'function') {
      const { data } = await supabase.auth.getUser();
      if (data && data.user && data.user.email) return data.user.email;
    }
  } catch (e) {
    // ignore
  }

  // Try localStorage.loggedUser (could be JSON with email)
  try {
    const raw = localStorage.getItem('loggedUser');
    if (raw) {
      try {
        const obj = JSON.parse(raw);
        if (obj && obj.email) return obj.email;
        if (typeof raw === 'string' && raw.includes('@')) return raw;
      } catch (e) {
        if (raw.includes('@')) return raw;
      }
    }
  } catch (e) { /* ignore */ }

  // Try common keys
  try { const e = localStorage.getItem('userEmail'); if (e) return e; } catch (e) {}
  try { const e = localStorage.getItem('email'); if (e) return e; } catch (e) {}

  // No identifier available
  return null;
}

async function subscribeNotificationsRealtime() {
  if (!ensureSupabaseClientForNotifications()) return;
  if (_notifChannel) return; // already subscribed

  const recipient = await getCurrentRecipientIdentifier();
  // subscribe to INSERTs on `notifications` table; server will deliver all inserts, filter client-side
  try {
    // Use a single channel that listens for both notifications INSERT and adoptions UPDATE
    _notifChannel = supabase.channel('public:notifications-and-adoptions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        try {
          const n = payload?.new;
          if (!n) return;
          // If notification has a recipient and it doesn't match current user, ignore
          if (n.recipient && recipient && n.recipient !== recipient) return;
          // If the client doesn't know recipient, still refresh on any insert
          // Prepend the new notification to the list and update badge
          const listEl = document.getElementById('notification-list');
          const countEl = document.getElementById('notifCount');
          if (listEl) {
            const li = document.createElement('li');
            li.className = 'notif-card';
            li.innerHTML = `
              <img class="notif-avatar" src="" alt="" style="display:none" />
              <div class="notif-body">
                <div class="notif-title">${escapeHtml(n.message || 'Notification')}</div>
                <div class="notif-meta">${escapeHtml(n.recipient || '')} • ${fmtDate(n.created_at || n.created || '')}</div>
              </div>
              <div style="margin-left:12px; text-align:right;"><div class="status-pill status-pending">${escapeHtml(n.status || 'unread')}</div></div>
            `;
            listEl.prepend(li);
          }
          if (countEl) {
            try { countEl.textContent = String(Number(countEl.textContent || 0) + 1); } catch(e) { countEl.textContent = '1'; }
          }
        } catch (e) { console.error('Realtime notification handler error:', e); }
      })
      // Also listen for updates to the `adoptions` table as a fallback when a dedicated
      // `notifications` table is not present. This ensures admin approve/reject actions
      // reflect immediately in the notifications UI without requiring the notifications table.
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'adoptions' }, (payload) => {
        try {
          const updated = payload?.new;
          if (!updated) return;
          // If the notifications list is present on the page, refresh it so status changes show up.
          if (document.getElementById('notification-list')) {
            console.log('Adoptions update received; refreshing notifications display.');
            // debounce slightly to avoid thrashing if multiple updates arrive
            try { if (window._loadNotificationsDebounce) clearTimeout(window._loadNotificationsDebounce); } catch(e) {}
            window._loadNotificationsDebounce = setTimeout(() => {
              try { loadNotifications(); } catch(e) { console.error('Error reloading notifications after adoptions update:', e); }
            }, 200);
          }
        } catch (e) { console.error('Realtime adoptions handler error:', e); }
      })
      .subscribe();
  } catch (e) {
    console.warn('Could not subscribe to realtime notifications:', e);
  }
}

// Start realtime subscription on pages that have notifications list
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('notification-list')) subscribeNotificationsRealtime();
});



