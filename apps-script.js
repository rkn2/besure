// === Google Apps Script — paste into Extensions > Apps Script in your response spreadsheet ===
// Sheet 1: "Faculty Responses" — interest/status tracking
// Sheet 2: "Placements" — confirmed hires with funding

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

  var label1, label2;
  if (periodType === 'Academic Year') {
    label1 = 'Fall';
    label2 = 'Spring';
  } else {
    label1 = '1st Half Summer';
    label2 = '2nd Half Summer';
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
