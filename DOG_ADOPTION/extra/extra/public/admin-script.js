// 🧠 CDO DogFinder Admin Dashboard JS
document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.querySelector(".sidebar");
  const toggleBtn = document.querySelector(".toggle-btn");

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
    });
  }

  // Highlight active link
  const current = location.pathname.split("/").pop();
  document.querySelectorAll(".sidebar a").forEach(a => {
    if (a.getAttribute("href") === current) a.classList.add("active");
  });

  // Add logout button to sidebar (if not present)
  try {
    const navList = document.querySelector('.sidebar nav ul');
    if (navList && !document.getElementById('logoutBtn')) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '#';
      a.id = 'logoutBtn';
      a.innerHTML = `<i class="fa-solid fa-right-from-bracket"></i><span>Logout</span>`;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        // Clear locally stored user session and redirect to login
        try { localStorage.removeItem('loggedUser'); } catch(_) {}
        try {
          if (window.supabase && supabase.auth && typeof supabase.auth.signOut === 'function') {
            supabase.auth.signOut().catch(() => {});
          }
        } catch (_) {}
        window.location.href = 'login.html';
      });
      li.appendChild(a);
      navList.appendChild(li);
    }
  } catch (err) {
    console.warn('Could not add logout button to sidebar:', err);
  }
});
// ------------------ ADMIN SCRIPT ------------------
// Make sure you have window.supabase initialized before this script loads.

// Optional: endpoint for a serverless email sender (recommended: Supabase Edge Function or Netlify/Cloud Function)
// Example: set to 'https://<project>.functions.supabase.co/send-email' after you deploy the function.
const SEND_EMAIL_ENDPOINT = ""; // <-- set this to your deployed email function URL

// Send email by calling your serverless function. The function should accept JSON { to, subject, text, html }
async function sendEmailViaFunction({ to, subject, text, html }) {
  if (!SEND_EMAIL_ENDPOINT) {
    console.warn('SEND_EMAIL_ENDPOINT not configured — skipping email send.');
    return false;
  }

  try {
    const resp = await fetch(SEND_EMAIL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, text, html })
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      console.warn('Email function returned non-OK:', resp.status, body);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to call email function:', err);
    return false;
  }
}

// Small HTML escaper to avoid injecting raw DB values into the DOM
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

// ===================== 🧮 DASHBOARD ANALYTICS =====================
document.addEventListener('DOMContentLoaded', () => {
  // Support both id styles (kebab-case and camelCase) in different HTML files
  const totalDogs = document.getElementById('total-dogs') || document.getElementById('totalDogs');
  const adoptedDogs = document.getElementById('adopted-dogs') || document.getElementById('adoptedDogs');
  const availableDogs = document.getElementById('available-dogs') || document.getElementById('availableDogs');
  const totalApplications = document.getElementById('total-applications') || document.getElementById('totalApplications');
  const approvedApplications = document.getElementById('approved-applications') || document.getElementById('approvedApplications');
  const rejectedApplications = document.getElementById('rejected-applications') || document.getElementById('rejectedApplications');
  const chartCanvas = document.getElementById('adoptionChart');

  if (totalDogs) {
    loadDashboardData();
  }
  // If on user-management page, load users table
  const usersTableBody = document.getElementById('usersTableBody');
  if (usersTableBody) loadUsers();

  async function loadDashboardData() {
    try {
      // Fetch rows and compute counts (more robust across Supabase client versions)
      const { data: allDogs, error: dogsErr } = await supabase.from('dogs').select('*');
      if (dogsErr) throw dogsErr;
      const dogCount = (allDogs || []).length;

      // Filter adopted dogs by status (case-insensitive, safe for undefined)
      const adoptedList = (allDogs || []).filter(d => 
        d.status && typeof d.status === 'string' && d.status.toLowerCase().includes('adopt')
      );
      const adoptedCount = adoptedList.length;

      // Available dogs: treat any dog that is NOT adopted as available (includes unknown/blank status)
      const availableCount = (allDogs || []).filter(d => {
        return !(d.status && typeof d.status === 'string' && d.status.toLowerCase().includes('adopt'));
      }).length;

      // Applications - fetch all and filter locally
      const { data: allApps, error: appsErr } = await supabase.from('adoptions').select('*');
      if (appsErr) throw appsErr;
      const totalAppCount = (allApps || []).length;

      const approvedList = (allApps || []).filter(a => 
        a.status && typeof a.status === 'string' && a.status.toLowerCase().includes('approved')
      );
      const approvedCount = approvedList.length;

      const rejectedList = (allApps || []).filter(a => 
        a.status && typeof a.status === 'string' && a.status.toLowerCase().includes('reject')
      );
      const rejectedCount = rejectedList.length;

      // Debug: log counts
      console.log('Total Dogs:', dogCount, 'Adopted:', adoptedCount, 'Available:', availableCount);
      console.log('Total Apps:', totalAppCount, 'Approved:', approvedCount, 'Rejected:', rejectedCount);

      // 🧩 Update UI - handle both full-card text and span-in-card patterns
      function setStat(el, label, value){
            if(!el) return;
            // If the element itself is a span used for the number, set only the number
            if (el.tagName && el.tagName.toLowerCase() === 'span') {
              el.textContent = value;
              return;
            }

            // if the element is a container that already contains label + span, try to set inner span
            const span = el.querySelector && el.querySelector('span');
            if(span) {
              span.textContent = value;
              return;
            }

            // fallback: write full label + value only if it doesn't already contain it
            if (!el.textContent.includes(label)) {
              el.textContent = `${label}: ${value}`;
            } else {
              // already has the label, just update the number part
              el.textContent = `${label}: ${value}`;
            }
      }

      setStat(totalDogs, 'Total Dogs', dogCount ?? 0);
      setStat(adoptedDogs, 'Adopted Dogs', adoptedCount ?? 0);
      setStat(availableDogs, 'Available Dogs', availableCount ?? 0);
      setStat(totalApplications, 'Total Applications', totalAppCount ?? 0);
      setStat(approvedApplications, 'Approved', approvedCount ?? 0);
      setStat(rejectedApplications, 'Rejected', rejectedCount ?? 0);

      // 📊 Build chart
      renderAdoptionChart(approvedCount ?? 0, rejectedCount ?? 0, totalAppCount ?? 0);
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
    }
  }
  // expose for other functions to refresh dashboard stats
  window.loadDashboardData = loadDashboardData;

  function renderAdoptionChart(approved, rejected, total) {
    if (!chartCanvas) return;

    const ctx = chartCanvas.getContext('2d');
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Approved', 'Rejected', 'Total'],
        datasets: [
          {
            label: 'Adoption Stats',
            data: [approved, rejected, total],
            backgroundColor: [
              'rgba(75, 192, 192, 0.7)',
              'rgba(255, 99, 132, 0.7)',
              'rgba(255, 206, 86, 0.7)',
            ],
            borderWidth: 1,
          },
        ],
      },
      options: {
        scales: {
          y: { beginAtZero: true },
        },
      },
    });
  }
});

// ===================== 🛠️ ADMIN - ADOPTION MANAGEMENT =====================
async function loadAdoptionApplications() {
  const tableBody = document.getElementById('adoptionTableBody');
  if (!tableBody) {
    console.log('adoptionTableBody element not found');
    return;
  }

  console.log('Loading adoption applications...');

  const { data: adoptions, error } = await supabase
    .from('adoptions')
    .select('*')
    .order('id', { ascending: false });

  console.log('Adoptions fetched:', adoptions, 'Error:', error);

  if (error) {
    console.error('Failed to fetch adoptions:', error);
    tableBody.innerHTML = '<tr><td colspan="5">Failed to load data: ' + error.message + '</td></tr>';
    return;
  }

  if (!adoptions || adoptions.length === 0) {
    console.log('No adoptions found');
    tableBody.innerHTML = '<tr><td colspan="5">No adoption applications yet.</td></tr>';
    return;
  }

  console.log('Rendering ' + adoptions.length + ' adoptions');

  tableBody.innerHTML = adoptions
    .map(
      (a) => {
        console.log('Rendering adoption:', a);
        return `
    <tr>
      <td>${a.id}</td>
      <td>${a.applicant_name || a.name || 'N/A'}</td>
      <td>${a.email || 'N/A'}</td>
      <td>${a.status || 'Pending'}</td>
      <td>
        <button onclick="approveAdoption('${a.id}')">Approve</button>
        <button onclick="rejectAdoption('${a.id}')">Reject</button>
      </td>
    </tr>`;
      }
    )
    .join('');
}

// ===================== 👥 ADMIN - USER MANAGEMENT =====================
async function loadUsers() {
  const tableBody = document.getElementById('usersTableBody');
  if (!tableBody) return;

  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('Failed to fetch users:', error);
      tableBody.innerHTML = '<tr><td colspan="5">Failed to load users: ' + error.message + '</td></tr>';
      return;
    }

    if (!users || users.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5">No users found.</td></tr>';
      return;
    }

    tableBody.innerHTML = users
      .map(u => `
      <tr>
        <td>${u.id}</td>
        <td>${u.name || 'N/A'}</td>
        <td>${u.email || 'N/A'}</td>
        <td>${u.role || 'N/A'}</td>
        <td>
          <button onclick="editUser(${u.id})">Edit</button>
          <button onclick="deleteUser(${u.id})">Delete</button>
        </td>
      </tr>`)
      .join('');

  } catch (err) {
    console.error('Error loading users:', err);
    tableBody.innerHTML = '<tr><td colspan="5">Error loading users.</td></tr>';
  }
}

async function deleteUser(userId) {
  if (!confirm('Delete user ' + userId + '?')) return;
  try {
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) throw error;
    loadUsers();
  } catch (err) {
    console.error('Failed to delete user:', err);
    alert('Failed to delete user.');
  }
}

function editUser(userId) {
  alert('Edit user: ' + userId + ' (edit UI not implemented)');
}

// ===================== 🐕 ADMIN - DOG STATUS MANAGEMENT =====================
async function loadDogs() {
  const tableBody = document.getElementById('dogsTableBody');
  const debugDiv = document.getElementById('dogsDebug');
  if (!tableBody) {
    console.error('dogsTableBody element not found');
    return;
  }

  if (debugDiv) debugDiv.textContent = 'Loading dogs from Supabase...';
  console.log('Loading dogs from Supabase...');

  try {
    if (debugDiv) debugDiv.textContent = 'Calling supabase.from("dogs").select()...';
    console.log('Calling supabase.from("dogs").select()...');

    const { data: dogs, error, status, statusText } = await supabase
      .from('dogs')
      .select('*')
      .order('id', { ascending: true });

    console.log('Dogs fetched:', dogs, 'Error:', error, 'status:', status, 'statusText:', statusText);
    if (debugDiv) {
      if (error) {
        debugDiv.textContent = 'Error fetching dogs: ' + (error.message || JSON.stringify(error));
      } else {
        try {
          // show a concise summary and a small JSON preview
          const preview = Array.isArray(dogs) ? dogs.slice(0, 10) : dogs;
          debugDiv.innerHTML = 'Fetched ' + ((dogs && dogs.length) || 0) + ' dogs. <pre style="white-space:pre-wrap; max-height:220px; overflow:auto; background:#fff; color:#111; padding:8px; border-radius:6px;">' + escapeHtml(JSON.stringify(preview, null, 2)) + '</pre>';
        } catch (e) {
          debugDiv.textContent = 'Fetched ' + ((dogs && dogs.length) || 0) + ' dogs (could not render JSON preview).';
        }
      }
    }

    if (error) {
      console.error('Failed to fetch dogs:', error);
      tableBody.innerHTML = '<tr><td colspan="8">Failed to load data: ' + escapeHtml(error.message) + '</td></tr>';
      return;
    }

    if (!dogs || dogs.length === 0) {
      console.log('No dogs found in database');
      if (debugDiv) debugDiv.textContent = 'No dogs found in the database.';
      tableBody.innerHTML = '<tr><td colspan="8">No dogs found. Add a dog to get started.</td></tr>';
      return;
    }

    console.log('Rendering ' + dogs.length + ' dogs');

    tableBody.innerHTML = dogs
      .map(
        (d) => `
      <tr>
        <td>${escapeHtml(d.id)}</td>
        <td>${escapeHtml(d.name || 'N/A')}</td>
        <td>${escapeHtml(d.breed || 'N/A')}</td>
        <td>${escapeHtml(d.age ?? 'N/A')}</td>
        <td>${escapeHtml(d.gender ?? '')}</td>
        <td>${escapeHtml(d.description ?? '')}</td>
        <td><span class="status ${(d.status || '').toLowerCase()}">${escapeHtml(d.status || 'Unknown')}</span></td>
        <td>
          <button class="edit-btn" onclick="editDog(${d.id}, '${(d.name || '').replace(/'/g, "\\'")}', '${(d.breed || '').replace(/'/g, "\\'")}', ${d.age || 0}, '${d.status || ''}', '${(d.image_url || '').replace(/'/g, "\\'")}')">Edit</button>
          <button class="delete-btn" onclick="deleteDog(${d.id})">Delete</button>
          <button class="toggle-btn" onclick="toggleDogStatus('${d.id}', '${d.status}')">Toggle Status</button>
        </td>
      </tr>`
      )
      .join('');
  } catch (err) {
    console.error('Exception in loadDogs:', err);
    tableBody.innerHTML = '<tr><td colspan="6">Error: ' + err.message + '</td></tr>';
  }
}

// 🐕 CREATE DOG
async function createDog(formData) {
  try {
    const { name, breed, age, status, image_url } = formData;
    
    if (!name || !breed || !age || !status) {
      alert('❌ Please fill all required fields');
      return;
    }

    const { data, error } = await supabase
      .from('dogs')
      .insert([{ name, breed, age: Number(age), status, image_url: image_url || null }])
      .select();

    if (error) throw error;

    alert('✅ Dog added successfully!');
    document.getElementById('dogForm').reset();
    loadDogs();
    if (window.loadDashboardData) window.loadDashboardData();
  } catch (err) {
    console.error('Failed to create dog:', err);
    alert('❌ Error creating dog: ' + err.message);
  }
}

// 🐕 EDIT DOG (modal or inline)
async function editDog(dogId, name, breed, age, status, imageUrl) {
  const newName = prompt('Edit name:', name);
  if (newName === null) return;

  const newBreed = prompt('Edit breed:', breed);
  if (newBreed === null) return;

  const newAge = prompt('Edit age:', age);
  if (newAge === null) return;

  const newStatus = prompt('Edit status (Available/Adopted):', status);
  if (newStatus === null) return;

  try {
    const { data, error } = await supabase
      .from('dogs')
      .update({ name: newName, breed: newBreed, age: Number(newAge), status: newStatus })
      .eq('id', dogId)
      .select();

    if (error) throw error;

    alert('✅ Dog updated successfully!');
    loadDogs();
    if (window.loadDashboardData) window.loadDashboardData();
  } catch (err) {
    console.error('Failed to update dog:', err);
    alert('❌ Error updating dog: ' + err.message);
  }
}

// 🐕 DELETE DOG
async function deleteDog(dogId) {
  const id = Number(dogId);
  if (!confirm('Are you sure you want to delete this dog? This action cannot be undone.')) return;

  if (Number.isNaN(id)) {
    console.error('deleteDog: invalid id', dogId);
    alert('❌ Invalid dog id: ' + dogId);
    return;
  }

  try {
    // use .select() to get response rows when possible
    const { data, error, status } = await supabase
      .from('dogs')
      .delete()
      .eq('id', id)
      .select();

    console.log('deleteDog result:', { id, status, data, error });

    if (error) {
      console.error('Failed to delete dog (supabase error):', error);
      let message = error.message || JSON.stringify(error);
      // Detect common PostgREST / schema cache issues
      if (error.code === 'PGRST204' || (error.details && /schema/i.test(error.details))) {
        message += '\nPossible DB schema or Row-Level Security (RLS) issue. Check that required columns exist and that RLS policies allow deletes for your client role.';
      }
      alert('❌ Error deleting dog: ' + message);
      return;
    }

    alert('✅ Dog deleted successfully!');
    loadDogs();
    if (window.loadDashboardData) window.loadDashboardData();
  } catch (err) {
    console.error('Exception deleting dog:', err);
    alert('❌ Error deleting dog: ' + (err.message || JSON.stringify(err)));
  }
}

async function toggleDogStatus(dogId, currentStatus) {
  const newStatus = (currentStatus === 'Available') ? 'Adopted' : 'Available';
  try {
    await supabase.from('dogs').update({ status: newStatus }).eq('id', dogId);
    alert(`✅ Dog status changed to ${newStatus}!`);
    loadDogs();
    if (window.loadDashboardData) window.loadDashboardData();
  } catch (err) {
    console.error('Failed to toggle dog status:', err);
    alert('❌ Error updating dog.');
  }
}

async function approveAdoption(adoptionId) {
  try {
    const id = Number(adoptionId);
    console.log('Approving adoption id=', id);
    
    // Try the update and return the updated row
    const { data, error } = await supabase
      .from('adoptions')
      .update({ status: 'Approved' })
      .eq('id', id)
      .select();
    
    console.log('approveAdoption result:', { data, error });
    
    if (error) {
      console.error('Full error object:', JSON.stringify(error, null, 2));
      alert('❌ Error approving adoption:\n' + (error.message || JSON.stringify(error)));
      return;
    }

    // Attempt to insert an in-app notification and send email to applicant
    try {
      const updated = Array.isArray(data) ? data[0] : data;
      const recipient = updated?.email || updated?.contact || updated?.applicant_email || null;
      const message = `Your adoption request${updated?.dog_id ? ' (dog #' + updated.dog_id + ')' : ''} has been Approved.`;

      // Insert in-app notification (graceful if notifications table doesn't exist)
      try {
        const { error: notifErr } = await supabase.from('notifications').insert([{
          adoption_id: updated?.id || id,
          recipient: recipient,
          message: message,
          type: 'adoption',
          status: 'unread'
        }]);
        if (notifErr) console.warn('Could not insert notification (notifications table may be missing):', notifErr.message || notifErr);
      } catch (e) { console.warn('Notification insert failed:', e); }

      // Send email via configured serverless function (if endpoint set)
      if (recipient) {
        const subject = 'CDO DogFinder — Adoption Approved';
        const text = `${message}\n\nThank you for using CDO DogFinder.`;
        sendEmailViaFunction({ to: recipient, subject, text }).then(ok => {
          if (!ok) console.warn('Email send failed or endpoint not configured.');
        });
      }
    } catch (e) {
      console.warn('Post-approval notification/email failed:', e);
    }

    alert('✅ Adoption Approved!');
    loadAdoptionApplications();
    if (window.loadDashboardData) window.loadDashboardData();
  } catch (err) {
    console.error('Exception in approveAdoption:', err);
    alert('❌ Error approving adoption: ' + err.message);
  }
}

async function rejectAdoption(adoptionId) {
  try {
    const id = Number(adoptionId);
    console.log('Rejecting adoption id=', id);
    const { data, error } = await supabase.from('adoptions').update({ status: 'Rejected' }).eq('id', id).select();
    console.log('rejectAdoption result', { data, error });
    if (error) {
      console.error('Failed to reject adoption (supabase):', error);
      alert('❌ Error rejecting adoption: ' + (error.message || JSON.stringify(error)));
      return;
    }

    // Insert in-app notification and optionally send email
    try {
      const updated = Array.isArray(data) ? data[0] : data;
      const recipient = updated?.email || updated?.contact || updated?.applicant_email || null;
      const message = `Your adoption request${updated?.dog_id ? ' (dog #' + updated.dog_id + ')' : ''} has been Rejected.`;

      try {
        const { error: notifErr } = await supabase.from('notifications').insert([{
          adoption_id: updated?.id || id,
          recipient: recipient,
          message: message,
          type: 'adoption',
          status: 'unread'
        }]);
        if (notifErr) console.warn('Could not insert notification (notifications table may be missing):', notifErr.message || notifErr);
      } catch (e) { console.warn('Notification insert failed:', e); }

      if (recipient) {
        const subject = 'CDO DogFinder — Adoption Rejected';
        const text = `${message}\n\nIf you have questions, please contact the shelter.`;
        sendEmailViaFunction({ to: recipient, subject, text }).then(ok => {
          if (!ok) console.warn('Email send failed or endpoint not configured.');
        });
      }
    } catch (e) {
      console.warn('Post-rejection notification/email failed:', e);
    }

    alert('✅ Adoption Rejected.');
    loadAdoptionApplications();
    if (window.loadDashboardData) window.loadDashboardData();
  } catch (err) {
    console.error('Failed to reject adoption:', err);
  }
}
