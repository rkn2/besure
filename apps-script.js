// === Google Apps Script — paste into Extensions > Apps Script in your response spreadsheet ===
// Sheet 1: "Faculty Responses" — interest/status tracking
// Sheet 2: "Placements" — confirmed hires with funding
//
// Email-triggered acceptance (runs under psuaeresearchscholars@gmail.com):
//   Forward an acceptance email to psuaeresearchscholars@gmail.com.
//   Type "Student Name / PI Name" on the first line of the body.
//   The script picks it up, updates the sheet to "Student accepted",
//   and creates an onboarding draft in the psuaeresearchscholars Gmail.
//
//   Setup:
//   1. In psuaeresearchscholars@gmail.com, create a label "BESURE-Accept"
//   2. Create a filter: to:psuaeresearchscholars@gmail.com → apply label "BESURE-Accept"
//   3. In Apps Script, go to Triggers (clock icon) → Add Trigger:
//      Function: processAcceptanceEmails, Time-driven, Minutes timer, Every 5 minutes

var RESPONSE_SHEET = 'Faculty Responses';
var PLACEMENT_SHEET = 'Placements';

function getOrCreateSheet(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

function doGet(e) {
  var action = (e.parameter.action || 'read').trim();

  if (action === 'placements') {
    return handleReadPlacements();
  }
  if (action === 'submitPlacement') {
    return handleSubmitPlacement(e);
  }
  if (action === 'timestamps') {
    return handleTimestamps();
  }

  var page = (e.parameter.page || '').trim();
  if (!page) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'page parameter required' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'submit') {
    return handleSubmit(e, page);
  }

  // Default: read responses for a page
  var sheet = getOrCreateSheet(RESPONSE_SHEET,
    ['Timestamp', 'Page Slug', 'Student Email', 'Student Name', 'Faculty Name', 'Status']);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var responses = [];

  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === page) {
      var row = {};
      for (var j = 0; j < headers.length; j++) {
        row[headers[j]] = data[i][j];
      }
      responses.push(row);
    }
  }

  return ContentService.createTextOutput(JSON.stringify(responses))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleSubmit(e, page) {
  var studentEmail = (e.parameter.studentEmail || '').trim();
  var studentName = (e.parameter.studentName || '').trim();
  var facultyName = (e.parameter.facultyName || '').trim();
  var status = (e.parameter.status || '').trim();

  if (!studentEmail || !facultyName || !status) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'studentEmail, facultyName, and status are required' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var sheet = getOrCreateSheet(RESPONSE_SHEET,
    ['Timestamp', 'Page Slug', 'Student Email', 'Student Name', 'Faculty Name', 'Status']);
  var data = sheet.getDataRange().getValues();

  var found = false;
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === page && data[i][2] === studentEmail && data[i][4] === facultyName) {
      sheet.getRange(i + 1, 1).setValue(new Date());
      sheet.getRange(i + 1, 6).setValue(status);
      found = true;
      break;
    }
  }

  if (!found) {
    sheet.appendRow([new Date(), page, studentEmail, studentName, facultyName, status]);
  }

  return ContentService.createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleSubmitPlacement(e) {
  var studentEmail = (e.parameter.studentEmail || '').trim();
  var studentName = (e.parameter.studentName || '').trim();
  var facultyName = (e.parameter.facultyName || '').trim();
  var periodType = (e.parameter.periodType || '').trim();
  var fund1 = (e.parameter.fund1 || '').trim();
  var fund2 = (e.parameter.fund2 || '').trim();

  if (!studentEmail || !facultyName || !periodType) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'studentEmail, facultyName, and periodType are required' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var headers = ['Timestamp', 'Student Name', 'Student Email', 'Faculty Name', 'Period Type',
                 'Period 1 Label', 'Period 1 Fund', 'Period 2 Label', 'Period 2 Fund'];
  var sheet = getOrCreateSheet(PLACEMENT_SHEET, headers);

  var label1 = (e.parameter.label1 || '').trim();
  var label2 = (e.parameter.label2 || '').trim();
  if (!label1) {
    if (periodType === 'Academic Year') {
      label1 = 'Fall';
      label2 = 'Spring';
    } else {
      label1 = '1st Half Summer';
      label2 = '2nd Half Summer';
    }
  }

  // Upsert by (studentEmail, facultyName)
  var data = sheet.getDataRange().getValues();
  var found = false;
  for (var i = 1; i < data.length; i++) {
    if (data[i][2] === studentEmail && data[i][3] === facultyName) {
      sheet.getRange(i + 1, 1).setValue(new Date());
      sheet.getRange(i + 1, 5).setValue(periodType);
      sheet.getRange(i + 1, 6).setValue(label1);
      sheet.getRange(i + 1, 7).setValue(fund1);
      sheet.getRange(i + 1, 8).setValue(label2);
      sheet.getRange(i + 1, 9).setValue(fund2);
      found = true;
      break;
    }
  }

  if (!found) {
    sheet.appendRow([new Date(), studentName, studentEmail, facultyName, periodType, label1, fund1, label2, fund2]);
  }

  return ContentService.createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleTimestamps() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheets()[0];
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return ContentService.createTextOutput(JSON.stringify({}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var headers = data[0].map(function(h) { return h.toString().toLowerCase().trim(); });
  var tsCol = -1, emailCol = -1;
  for (var j = 0; j < headers.length; j++) {
    if (headers[j] === 'timestamp') tsCol = j;
    if (headers[j].indexOf('email') !== -1) emailCol = j;
  }

  if (tsCol === -1 || emailCol === -1) {
    return ContentService.createTextOutput(JSON.stringify({}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var result = {};
  for (var i = 1; i < data.length; i++) {
    var email = (data[i][emailCol] || '').toString().trim().toLowerCase();
    var ts = data[i][tsCol];
    if (email && ts) {
      result[email] = ts instanceof Date ? ts.toISOString() : ts.toString();
    }
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleReadPlacements() {
  var headers = ['Timestamp', 'Student Name', 'Student Email', 'Faculty Name', 'Period Type',
                 'Period 1 Label', 'Period 1 Fund', 'Period 2 Label', 'Period 2 Fund'];
  var sheet = getOrCreateSheet(PLACEMENT_SHEET, headers);
  var data = sheet.getDataRange().getValues();
  var hdrs = data[0];
  var placements = [];

  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < hdrs.length; j++) {
      row[hdrs[j]] = data[i][j];
    }
    placements.push(row);
  }

  return ContentService.createTextOutput(JSON.stringify(placements))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Email-triggered acceptance ──────────────────────────────────────

var ADMIN_EMAIL = 'rjn5308@psu.edu';
var FINANCE_EMAIL = 'ldw5@psu.edu';
var ACCEPT_LABEL = 'BESURE-Accept';

var FACULTY_EMAILS = {
  'Nathan Brown': 'ncb5048@psu.edu',
  'Rebecca Napolitano': 'rjn5308@psu.edu',
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

function processAcceptanceEmails() {
  var label = GmailApp.getUserLabelByName(ACCEPT_LABEL);
  if (!label) return;

  var threads = label.getThreads();
  if (!threads.length) return;

  var sheet = getOrCreateSheet(RESPONSE_SHEET,
    ['Timestamp', 'Page Slug', 'Student Email', 'Student Name', 'Faculty Name', 'Status']);
  var data = sheet.getDataRange().getValues();

  threads.forEach(function(thread) {
    var messages = thread.getMessages();
    var latest = messages[messages.length - 1];
    var body = latest.getPlainBody() || '';
    // Grab the first non-empty line the sender typed (before forwarded content)
    var lines = body.split(/\r?\n/);
    var firstLine = '';
    for (var li = 0; li < lines.length; li++) {
      var trimmed = lines[li].trim();
      if (trimmed && !/^[-=_>]/.test(trimmed) && !/^(from|sent|to|cc|subject|date):/i.test(trimmed)) {
        firstLine = trimmed;
        break;
      }
    }
    var match = firstLine.match(/^(.+?)\s*\/\s*(.+)$/);

    if (!match) {
      latest.reply(
        'Could not parse names.\n' +
        'Type "Student Name / PI Name" on the first line when forwarding.');
      label.removeFromThread(thread);
      return;
    }

    var studentName = match[1].trim();
    var piName = match[2].trim();
    var studentNameLower = studentName.toLowerCase();
    var piNameLower = piName.toLowerCase();

    var foundRow = -1;
    var studentEmail = '';
    for (var i = 1; i < data.length; i++) {
      var rowStudent = (data[i][3] || '').toString().trim().toLowerCase();
      var rowFaculty = (data[i][4] || '').toString().trim().toLowerCase();
      if (rowStudent === studentNameLower && rowFaculty === piNameLower) {
        foundRow = i;
        studentEmail = (data[i][2] || '').toString().trim();
        studentName = data[i][3].toString().trim();
        piName = data[i][4].toString().trim();
        break;
      }
    }

    if (foundRow === -1) {
      thread.getMessages()[0].reply(
        'No matching entry found for "' + studentName + '" with "' + piName + '".\n' +
        'A faculty member needs to submit interest through the website first.');
      label.removeFromThread(thread);
      return;
    }

    sheet.getRange(foundRow + 1, 1).setValue(new Date());
    sheet.getRange(foundRow + 1, 6).setValue('Student accepted');

    var funding = lookupFunding(studentEmail, piName);
    createOnboardingDraft(studentName, studentEmail, piName, funding);
    label.removeFromThread(thread);
  });
}

function lookupFunding(studentEmail, facultyName) {
  var headers = ['Timestamp', 'Student Name', 'Student Email', 'Faculty Name', 'Period Type',
                 'Period 1 Label', 'Period 1 Fund', 'Period 2 Label', 'Period 2 Fund'];
  var sheet = getOrCreateSheet(PLACEMENT_SHEET, headers);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][2] === studentEmail && data[i][3] === facultyName) {
      return {
        label1: data[i][5] || '', fund1: data[i][6] || '',
        label2: data[i][7] || '', fund2: data[i][8] || ''
      };
    }
  }
  return { label1: '', fund1: '', label2: '', fund2: '' };
}

function createOnboardingDraft(studentName, studentEmail, piName, funding) {
  var piEmail = FACULTY_EMAILS[piName] || '';
  var fundLine1 = funding.fund1
    ? ('    •    Funding Source 1: ' + funding.label1 + ' on IO ' + funding.fund1)
    : ('    •    Funding Source 1: TBD');
  var fundLine2 = funding.fund2
    ? ('    •    Funding Source 2: ' + funding.label2 + ' on IO ' + funding.fund2)
    : ('    •    Funding Source 2: TBD');

  var subject = 'New AE Research Scholar Payroll Information';
  var body = 'Hi Latrisha, this email is to confirm the payroll details for our new student researcher:\n\n' +
    '    •    Student: ' + studentName + '\n' +
    '    •    Faculty Mentor/Supervisor: ' + piName + ' (They will be responsible for approving their hours).\n' +
    fundLine1 + '\n' +
    fundLine2 + '\n\n' +
    'Please let me know if you need any additional information to get them set up in the system!\n\n' +
    'Thanks,\nBecca';

  var cc = [piEmail, studentEmail].filter(function(e) { return e; }).join(',');

  GmailApp.createDraft(FINANCE_EMAIL, subject, body, { cc: cc });
}
