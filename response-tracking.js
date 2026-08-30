// Faculty response tracking for AE Research Scholars cohort pages.
// Reads/writes faculty interest via a Google Apps Script web app.
// The only per-page requirement is: <script src="../../response-tracking.js"></script>

(function () {
  var SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxl3x4KWmjHufkroWiXieWjBcACjWxSguj9EjonvpSxPDfVUYhfg88uhnVjRMhXuAJx/exec';

  var FACULTY = [
    'Nathan Brown',
    'Rebecca Napolitano',
    'Tyler Hull',
    'Botong Zheng',
    'Yuqing Hu',
    'Greg Pavlak',
    'Wangda Zuo',
    'Jin Wen',
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
    'Student accepted',
    'Doing paperwork',
    'Program accepted'
  ];

  var pageSlug = location.pathname.split('/').filter(Boolean).pop() || '';

  // Read semester from page (e.g., "Fall 2026") to compute period labels with years
  var semesterEl = document.querySelector('.hero-eyebrow');
  var semesterText = semesterEl ? semesterEl.textContent.trim() : '';
  var semesterMatch = semesterText.match(/(Fall|Spring|Summer)\s+(\d{4})/i);
  var cohortSeason = semesterMatch ? semesterMatch[1] : '';
  var cohortYear = semesterMatch ? parseInt(semesterMatch[2], 10) : 0;
  var yy = cohortYear % 100;

  function getPeriodLabels(periodType) {
    if (!cohortYear) return periodType === 'Academic Year'
      ? ['Fall', 'Spring'] : ['Summer 1st Half', 'Summer 2nd Half'];
    if (periodType === 'Academic Year') {
      if (/spring/i.test(cohortSeason)) return ['Spring ' + yy, 'Fall ' + yy];
      return ['Fall ' + yy, 'Spring ' + ((yy + 1) % 100)];
    }
    var sy = /fall/i.test(cohortSeason) ? (yy + 1) % 100 : yy;
    return ['Summer ' + sy + ' 1st Half', 'Summer ' + sy + ' 2nd Half'];
  }

  if (!pageSlug || SCRIPT_URL === 'YOUR_APPS_SCRIPT_URL') {
    showUnavailable();
    return;
  }

  var cards = document.querySelectorAll('.student-card');
  if (!cards.length) return;

  var students = [];
  cards.forEach(function (card) {
    var h3 = card.querySelector('h3');
    var name = h3 ? h3.childNodes[0].textContent : '';
    var meta = (card.querySelector('.meta') || {}).textContent || '';
    var email = meta.split('·')[0].trim();
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
      if (s === 'program accepted') statusClass = 'response-status--program';
      else if (s === 'doing paperwork') statusClass = 'response-status--paperwork';
      else if (s === 'student accepted') statusClass = 'response-status--confirmed';
      else if (s === 'offered position') statusClass = 'response-status--offered';
      else if (s === 'interested' || s === 'emailed student') statusClass = 'response-status--interested';
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
      '<div class="funding-fields" style="display:none;">' +
        '<label class="response-form-label" style="margin-top:0.6rem;">Funding information:</label>' +
        '<p style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:0.4rem;">One semester is funded by BESURE (department), the other by PI funds. Enter the fund source or IO number for each period.</p>' +
        '<div class="response-form-row" style="margin-bottom:0.4rem;">' +
          '<select class="response-select" name="periodType">' +
            '<option value="Academic Year">Academic Year (Fall + Spring)</option>' +
            '<option value="Summer">Summer (1st Half + 2nd Half)</option>' +
          '</select>' +
        '</div>' +
        '<div class="response-form-row">' +
          '<input type="text" class="response-select" name="fund1" placeholder="Fall — e.g., BESURE">' +
          '<input type="text" class="response-select" name="fund2" placeholder="Spring — e.g., IO number">' +
        '</div>' +
      '</div>' +
      '<div class="response-msg"></div>';

    var statusSelect = form.querySelector('[name="status"]');
    var fundingFields = form.querySelector('.funding-fields');
    var periodSelect = form.querySelector('[name="periodType"]');
    var fund1Input = form.querySelector('[name="fund1"]');
    var fund2Input = form.querySelector('[name="fund2"]');

    statusSelect.addEventListener('change', function () {
      if (statusSelect.value === 'Student accepted') {
        fundingFields.style.display = '';
        updateFundLabels();
      } else {
        fundingFields.style.display = 'none';
      }
    });

    periodSelect.addEventListener('change', updateFundLabels);

    function updateFundLabels() {
      var labels = getPeriodLabels(periodSelect.value);
      fund1Input.placeholder = labels[0] + ' — e.g., BESURE';
      fund2Input.placeholder = labels[1] + ' — e.g., IO number';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var faculty = form.querySelector('[name="faculty"]').value;
      var status = statusSelect.value;
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

      var statusPromise = fetch(SCRIPT_URL + '?' + params.toString())
        .then(function (r) { return r.json(); });

      var placementPromise;
      if (status === 'Student accepted') {
        var labels = getPeriodLabels(periodSelect.value);
        var placementParams = new URLSearchParams({
          action: 'submitPlacement',
          studentEmail: studentEmail,
          studentName: studentName,
          facultyName: faculty,
          periodType: periodSelect.value,
          label1: labels[0],
          label2: labels[1],
          fund1: fund1Input.value,
          fund2: fund2Input.value
        });
        placementPromise = fetch(SCRIPT_URL + '?' + placementParams.toString())
          .then(function (r) { return r.json(); });
      } else {
        placementPromise = Promise.resolve({ success: true });
      }

      Promise.all([statusPromise, placementPromise])
        .then(function (results) {
          if (results[0].success && results[1].success) {
            msg.className = 'response-msg response-msg--ok';
            msg.textContent = 'Saved.';
            form.reset();
            fundingFields.style.display = 'none';
            loadResponses();
          } else {
            msg.className = 'response-msg response-msg--err';
            msg.textContent = results[0].error || results[1].error || 'Something went wrong.';
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
