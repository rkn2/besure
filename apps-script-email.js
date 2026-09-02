// === Standalone Apps Script for psuaeresearchscholars@gmail.com ===
// Sends onboarding notification emails to Becca when faculty accept students.
//
// Setup:
//   1. Share the response tracking spreadsheet with psuaeresearchscholars@gmail.com (Editor)
//   2. Go to Triggers (clock icon) → Add Trigger:
//      Function: processPendingOnboarding, Time-driven, Minutes timer, Every 5 minutes

var SPREADSHEET_ID = '1BgrIr-u9Jwty0_1oRt-KzMbswWcci9gwJVy9Ae7X2Wc';
var RESPONSE_SHEET = 'Faculty Responses';
var PLACEMENT_SHEET = 'Placements';

var ADMIN_EMAIL = 'rjn5308@psu.edu';
var FINANCE_EMAIL = 'ldw5@psu.edu';
var ACCEPT_LABEL = 'aers-accept';

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

function getSheet(name, headers) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

function processAcceptanceEmails() {
  var label = GmailApp.getUserLabelByName(ACCEPT_LABEL);
  if (!label) return;

  var threads = label.getThreads();
  if (!threads.length) return;

  var sheet = getSheet(RESPONSE_SHEET,
    ['Timestamp', 'Page Slug', 'Student Email', 'Student Name', 'Faculty Name', 'Status']);
  var data = sheet.getDataRange().getValues();

  threads.forEach(function(thread) {
    var messages = thread.getMessages();
    var latest = messages[messages.length - 1];

    function findMatch(text) {
      var lines = text.split(/\r?\n/);
      for (var li = 0; li < lines.length; li++) {
        var trimmed = lines[li].trim();
        if (!trimmed || /^[-=_>]/.test(trimmed) || /^(from|sent|to|cc|subject|date):/i.test(trimmed)) continue;
        var m = trimmed.match(/^(.+?)\s*\/\s*(.+)$/);
        if (m) return m;
      }
      return null;
    }

    var match = findMatch(latest.getPlainBody() || '');

    if (!match) {
      var html = latest.getBody() || '';
      var text = html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&');
      match = findMatch(text);
    }

    if (!match) {
      Logger.log('Could not parse. Plain body: ' + (latest.getPlainBody() || '').substring(0, 500));
      Logger.log('HTML body: ' + (latest.getBody() || '').substring(0, 500));
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
      latest.reply(
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
  var sheet = getSheet(PLACEMENT_SHEET, headers);
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

// ── Process pending onboarding from website ────────────────────────

function processPendingOnboarding() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Pending Onboarding');
  if (!sheet) return;

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return;

  for (var i = 1; i < data.length; i++) {
    var sent = (data[i][8] || '').toString().trim();
    if (sent) continue;

    var studentName = (data[i][1] || '').toString().trim();
    var studentEmail = (data[i][2] || '').toString().trim();
    var facultyName = (data[i][3] || '').toString().trim();
    var label1 = (data[i][4] || '').toString().trim();
    var fund1 = (data[i][5] || '').toString().trim();
    var label2 = (data[i][6] || '').toString().trim();
    var fund2 = (data[i][7] || '').toString().trim();

    if (!studentName || !facultyName) continue;

    var piEmail = FACULTY_EMAILS[facultyName] || '';
    var fundLine1 = fund1
      ? ('    •    Funding Source 1: ' + label1 + ' on IO ' + fund1)
      : ('    •    Funding Source 1: TBD');
    var fundLine2 = fund2
      ? ('    •    Funding Source 2: ' + label2 + ' on IO ' + fund2)
      : ('    •    Funding Source 2: TBD');

    var forwardBody = 'Hi Latrisha, this email is to confirm the payroll details for our new student researcher:\n\n' +
      '    •    Student: ' + studentName + '\n' +
      '    •    Faculty Mentor/Supervisor: ' + facultyName + ' (They will be responsible for approving their hours).\n' +
      fundLine1 + '\n' +
      fundLine2 + '\n\n' +
      'Please let me know if you need any additional information to get them set up in the system!\n\n' +
      'Thanks,\nBecca';

    var notifySubject = 'Ready to send: Onboarding for ' + studentName + ' with ' + facultyName;
    var notifyBody = 'A faculty member marked ' + studentName + ' as accepted with ' + facultyName + '.\n\n' +
      'Review the email below and forward it to Latrisha (' + FINANCE_EMAIL + ').\n' +
      'CC: ' + [piEmail, studentEmail].filter(Boolean).join(', ') + '\n\n' +
      '--- FORWARD THIS ---\n\n' +
      'Subject: New AE Research Scholar Payroll Information\n\n' +
      forwardBody;

    GmailApp.sendEmail(ADMIN_EMAIL, notifySubject, notifyBody);
    sheet.getRange(i + 1, 9).setValue(new Date().toISOString());
  }
}
