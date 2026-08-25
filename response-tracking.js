// Faculty response tracking for AE Research Scholars cohort pages.
// Reads/writes faculty interest via a Google Apps Script web app.
// The only per-page requirement is: <script src="../../response-tracking.js"></script>

(function () {
  var SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxl3x4KWmjHufkroWiXieWjBcACjWxSguj9EjonvpSxPDfVUYhfg88uhnVjRMhXuAJx/exec';

  var FACULTY = [
    'Nathan Brown',
    'Rebecca Napolitano',
    'Yuqing Hu',
    'Greg Pavlak',
    'Wangda Zuo',
    'Donghyun Rim',
    'Julian Wang',
    'Dorukalp Durmus',
    'John Messner',
    'Rob Leicht',
    'Juan Pablo Gevaudan'
  ];

  var STATUSES = [
    'Interested',
    'Emailed student',
    'Offered position',
    'Did not offer position'
  ];

  var pageSlug = location.pathname.split('/').filter(Boolean).pop() || '';

  if (!pageSlug || SCRIPT_URL === 'YOUR_APPS_SCRIPT_URL') {
    showUnavailable();
    return;
  }

  var cards = document.querySelectorAll('.student-card');
  if (!cards.length) return;

  var students = [];
  cards.forEach(function (card) {
    var name = (card.querySelector('h3') || {}).textContent || '';
    var meta = (card.querySelector('.meta') || {}).textContent || '';
    var email = meta.split('·')[0].trim(); // split on middot
    students.push({ card: card, name: name.trim(), email: email });
    renderForm(card, name.trim(), email);
  });

  loadResponses();

  function loadResponses() {
    var url = SCRIPT_URL + '?page=' + encodeURIComponent(pageSlug);
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var byStudent = {};
        data.forEach(function (row) {
          var key = row['Student Email'];
          if (!byStudent[key]) byStudent[key] = [];
          byStudent[key].push(row);
        });
        students.forEach(function (s) {
          renderResponses(s.card, byStudent[s.email] || []);
        });
      })
      .catch(function () {
        students.forEach(function (s) {
          var el = s.card.querySelector('.response-display');
          if (el) el.innerHTML = '<p class="response-unavailable">Could not load faculty responses.</p>';
        });
      });
  }

  function renderResponses(card, responses) {
    var container = card.querySelector('.response-display');
    if (!container) return;
    container.innerHTML = '';

    if (!responses.length) {
      container.innerHTML = '<p class="response-none">No faculty responses yet.</p>';
      return;
    }

    var list = document.createElement('div');
    list.className = 'response-list';
    responses.forEach(function (r) {
      var item = document.createElement('div');
      item.className = 'response-item';
      var statusClass = 'response-status--default';
      var s = (r['Status'] || '').toLowerCase();
      if (s === 'offered position') statusClass = 'response-status--offered';
      else if (s === 'interested' || s === 'emailed student') statusClass = 'response-status--interested';
      else if (s === 'did not offer position') statusClass = 'response-status--declined';
      item.innerHTML =
        '<span class="response-faculty">' + escapeHtml(r['Faculty Name']) + '</span>' +
        '<span class="response-status ' + statusClass + '">' + escapeHtml(r['Status']) + '</span>';
      list.appendChild(item);
    });
    container.appendChild(list);
  }

  function renderForm(card, studentName, studentEmail) {
    var wrapper = document.createElement('div');
    wrapper.className = 'response-section';

    var display = document.createElement('div');
    display.className = 'response-display';
    display.innerHTML = '<p class="response-none" style="color:var(--text-secondary);font-size:0.85rem;">Loading...</p>';

    var form = document.createElement('form');
    form.className = 'response-form';
    form.innerHTML =
      '<label class="response-form-label">Indicate your interest:</label>' +
      '<div class="response-form-row">' +
        '<select class="response-select" name="faculty" required>' +
          '<option value="">Your name</option>' +
          FACULTY.map(function (f) { return '<option value="' + escapeHtml(f) + '">' + escapeHtml(f) + '</option>'; }).join('') +
        '</select>' +
        '<select class="response-select" name="status" required>' +
          '<option value="">Status</option>' +
          STATUSES.map(function (s) { return '<option value="' + escapeHtml(s) + '">' + escapeHtml(s) + '</option>'; }).join('') +
        '</select>' +
        '<button type="submit" class="btn btn-primary response-submit">Submit</button>' +
      '</div>' +
      '<div class="response-msg"></div>';

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var faculty = form.querySelector('[name="faculty"]').value;
      var status = form.querySelector('[name="status"]').value;
      if (!faculty || !status) return;

      var btn = form.querySelector('.response-submit');
      var msg = form.querySelector('.response-msg');
      btn.disabled = true;
      btn.textContent = 'Submitting...';

      var params = new URLSearchParams({
        action: 'submit',
        page: pageSlug,
        studentEmail: studentEmail,
        studentName: studentName,
        facultyName: faculty,
        status: status
      });

      fetch(SCRIPT_URL + '?' + params.toString())
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.success) {
            msg.className = 'response-msg response-msg--ok';
            msg.textContent = 'Saved.';
            form.reset();
            loadResponses();
          } else {
            msg.className = 'response-msg response-msg--err';
            msg.textContent = data.error || 'Something went wrong.';
          }
        })
        .catch(function () {
          msg.className = 'response-msg response-msg--err';
          msg.textContent = 'Could not reach the server. Try again.';
        })
        .finally(function () {
          btn.disabled = false;
          btn.textContent = 'Submit';
        });
    });

    wrapper.appendChild(display);
    wrapper.appendChild(form);
    card.appendChild(wrapper);
  }

  function showUnavailable() {
    var cards = document.querySelectorAll('.student-card');
    cards.forEach(function (card) {
      var note = document.createElement('div');
      note.className = 'response-section';
      note.innerHTML = '<p class="response-unavailable">Faculty response tracking is not yet configured.</p>';
      card.appendChild(note);
    });
  }

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
})();
