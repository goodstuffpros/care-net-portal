var BASE = window.location.pathname.replace(/\/becky-admin\/?$/, '');

function toast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(function() { t.classList.remove('show'); }, 2500);
}
function startEdit(id) {
  document.getElementById('edit-form-' + id).style.display = 'block';
  document.getElementById('actions-' + id).style.display = 'none';
  document.getElementById('response-display-' + id).style.display = 'none';
  document.getElementById('prompt-display-' + id).style.display = 'none';
}
function cancelEdit(id) {
  document.getElementById('edit-form-' + id).style.display = 'none';
  document.getElementById('actions-' + id).style.display = 'flex';
  document.getElementById('response-display-' + id).style.display = 'block';
  document.getElementById('prompt-display-' + id).style.display = 'block';
}
async function saveEntry(id) {
  var prompt = document.getElementById('prompt-input-' + id).value.trim();
  var response = document.getElementById('response-input-' + id).value.trim();
  if (!prompt || !response) { toast('Please fill in both fields'); return; }
  var r = await fetch(BASE + '/api/becky-library/' + id, {
    method: 'PATCH', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ examplePrompt: prompt, response: response, isPlaceholder: 0 })
  });
  if (r.ok) {
    document.getElementById('prompt-display-' + id).textContent = prompt;
    document.getElementById('response-display-' + id).textContent = response;
    var card = document.getElementById('card-' + id);
    var badge = card.querySelector('.badge');
    badge.className = 'badge done'; badge.textContent = 'Your Response';
    cancelEdit(id);
    toast('Saved \u2713');
  } else { toast('Error saving \u2014 try again'); }
}
function deleteEntry(id) {
  document.getElementById('confirm-' + id).style.display = 'block';
  document.getElementById('actions-' + id).style.display = 'none';
}
async function deleteConfirm(id) {
  var r = await fetch(BASE + '/api/becky-library/' + id, { method: 'DELETE' });
  if (r.ok) { document.getElementById('card-' + id).remove(); toast('Deleted'); }
  else { toast('Error deleting \u2014 try again'); }
}
function deleteCancel(id) {
  document.getElementById('confirm-' + id).style.display = 'none';
  document.getElementById('actions-' + id).style.display = 'flex';
}

document.addEventListener('click', function(e) {
  var btn = e.target.closest('[data-action]');
  if (!btn) return;
  var action = btn.dataset.action;
  var id = btn.dataset.id;
  if (action === 'edit') startEdit(id);
  else if (action === 'cancel') cancelEdit(id);
  else if (action === 'save') saveEntry(id);
  else if (action === 'delete') deleteEntry(id);
  else if (action === 'delete-confirm') deleteConfirm(id);
  else if (action === 'delete-cancel') deleteCancel(id);
});

document.getElementById('filters').addEventListener('click', function(e) {
  var btn = e.target.closest('.filter-btn');
  if (!btn) return;
  document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  var theme = btn.dataset.theme;
  document.querySelectorAll('.card').forEach(function(c) {
    c.style.display = (!theme || c.dataset.theme === theme) ? 'block' : 'none';
  });
});

document.getElementById('btn-open-add').addEventListener('click', function() {
  document.getElementById('add-modal').classList.add('open');
});
document.getElementById('btn-close-add').addEventListener('click', function() {
  document.getElementById('add-modal').classList.remove('open');
});
document.getElementById('new-theme').addEventListener('change', function() {
  document.getElementById('new-theme-input-wrap').style.display = this.value === 'new' ? 'block' : 'none';
});
document.getElementById('btn-submit-new').addEventListener('click', async function() {
  var theme = document.getElementById('new-theme').value;
  if (theme === 'new') theme = document.getElementById('new-theme-input').value.trim().toLowerCase().replace(/\s+/g, '_');
  var prompt = document.getElementById('new-prompt').value.trim();
  var response = document.getElementById('new-response').value.trim();
  if (!theme || !prompt || !response) { toast('Please fill in all fields'); return; }
  var r = await fetch(BASE + '/api/becky-library', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ theme: theme, examplePrompt: prompt, response: response })
  });
  if (r.ok) { toast('Entry saved! Refresh to see it.'); document.getElementById('add-modal').classList.remove('open'); }
  else { toast('Error \u2014 try again'); }
});
