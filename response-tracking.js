// Faculty response tracking for AE Research Scholars cohort pages.
// Reads/writes faculty interest via a Google Apps Script web app.
// The only per-page requirement is: <script src="../../response-tracking.js"></script>

(function () {
  var SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxl3x4KWmjHufkroWiXieWjBcACjWxSguj9EjonvpSxPDfVUYhfg88uhnVjRMhXuAJx/exec';

  var ADMIN_EMAIL = 'rjn5308@psu.edu';
  var FINANCE_EMAIL = 'ldw5@psu.edu';

  var FACULTY_EMAILS = {
    'Nathan Brown': 'ncb5048@psu.edu',
    'Rebecca Napolitano': ADMIN_EMAIL,
    'Tyler Hull': 'thull@psu.edu',
    'Botong Zheng': 'bbz5226@psu.edu',
    'Yuqing Hu': 'yfh5204@psu.edu',
    'Greg Pavlak': 'gxp93@psu.edu',
    'Wangda Zuo': 'wangda.zuo@psu.edu',
    'Jin Wen': 'jvw6499@psu.edu',
    'Donghyun Rim': 'dxr51@psu.edu',
    'Julian Wang': 'jqw5965@psu.edu',
    'Dorukalp Durmus': 'alp@psu.edu',
    'John Messner': 'jim101@psu.edu',
    'Rob Leicht': 'rml167@psu.edu',
    'Juan Pablo Gevaudan': 'j.p.gevaudan@psu.edu'
  };
  var FACULTY = Object.keys(FACULTY_EMAILS);

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
            var mailtoUrl = '';
            if (status === 'Student accepted') {
              var labels = getPeriodLabels(periodSelect.value);
              mailtoUrl = buildOnboardingMailto(studentName, studentEmail, faculty, labels[0], fund1Input.value, labels[1], fund2Input.value);
            } else if (status === 'Program accepted') {
              mailtoUrl = buildCongratsMailto(studentName, studentEmail, faculty);
            }
            if (mailtoUrl) {
              msg.innerHTML = 'Saved. <a href="' + mailtoUrl + '" class="btn btn-primary draft-email-btn">Draft email</a>';
            } else {
              msg.textContent = 'Saved.';
            }
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

  function buildOnboardingMailto(studentName, studentEmail, facultyName, label1, fund1, label2, fund2) {
    var piEmail = FACULTY_EMAILS[facultyName] || '';
    var to = [ADMIN_EMAIL, FINANCE_EMAIL].join(',');
    var cc = [piEmail, studentEmail].filter(Boolean).join(',');
    var subject = 'New AE Research Scholar Payroll Information';
    var fundLine1 = fund1 ? ('    •    Funding Source 1: ' + label1 + ' on IO ' + fund1) : ('    •    Funding Source 1: ' + label1 + ' — TBD');
    var fundLine2 = fund2 ? ('    •    Funding Source 2: ' + label2 + ' on IO ' + fund2) : ('    •    Funding Source 2: ' + label2 + ' — TBD');
    var body = 'Hi Latrisha, this email is to confirm the payroll details for our new student researcher:\r\n\r\n' +
      '    •    Student: ' + studentName + '\r\n' +
      '    •    Faculty Mentor/Supervisor: ' + facultyName + ' (They will be responsible for approving their hours).\r\n' +
      fundLine1 + '\r\n' +
      fundLine2 + '\r\n\r\n' +
      'Please let me know if you need any additional information to get them set up in the system!\r\n\r\n' +
      'Thanks,\r\nBecca';
    return 'mailto:' + encodeURIComponent(to) +
      '?cc=' + encodeURIComponent(cc) +
      '&subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);
  }

  function buildCongratsMailto(studentName, studentEmail, facultyName) {
    var piEmail = FACULTY_EMAILS[facultyName] || '';
    var cc = [ADMIN_EMAIL, piEmail].filter(Boolean).join(',');
    var firstName = studentName.split(' ')[0];
    var subject = 'Welcome to the AE Research Scholars Program!';
    var body = 'Dear ' + firstName + ',\r\n\r\n' +
      'Welcome to the AE Research Scholars program! We are thrilled to have you join us!!\r\n\r\n' +
      'To help you get started and stay connected, we have added you to the official AE Research Scholars channel on Microsoft Teams. ' +
      'This channel is our primary hub for communication, where we post important information about graduate school fellowships, ' +
      'research scholarships, professional development events, and other opportunities relevant to your academic and research career!\r\n\r\n' +
      'A key component of the program is sharing your work with the broader community. To that end, all student researchers participate ' +
      'in a poster session at the end of each year (April) to present their progress and accomplishments. We will share more details ' +
      'about the poster session as the end of the semester approaches.\r\n\r\n' +
      'The position pays $15/hour, and the average time commitment is about 5 hours per week, though some students work up to 10 hours. ' +
      'This is something you and your faculty mentor can decide together based on your project and schedule. Please note that you must ' +
      'wait until you are officially in the university system before starting any work. Latrisha Hough will send you instructions on how ' +
      'to apply for the paid research position through the university system, please keep an eye out for her email.\r\n\r\n' +
      'In terms of research mentoring and meetings, your faculty mentor is your primary contact. Some students meet weekly, others monthly, ' +
      'and some prefer quick check-ins via Teams. Have a conversation with your mentor about what works best for both of you and your project. ' +
      'If you run into any issues with this, please reach back out to me, I\'m happy to help.\r\n\r\n' +
      'We are looking forward to seeing the great work you will do with your faculty mentor! Please don\'t hesitate to reach out if you have any questions.\r\n\r\n' +
      'Best regards,\r\nDoc Nap';
    return 'mailto:' + encodeURIComponent(studentEmail) +
      '?cc=' + encodeURIComponent(cc) +
      '&subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);
  }

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
})();
