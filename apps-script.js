// === Google Apps Script — paste into Extensions > Apps Script in your response spreadsheet ===
// Sheet: "Faculty Responses"
// Columns: Timestamp | Page Slug | Student Email | Student Name | Faculty Name | Status

var SHEET_NAME = 'Faculty Responses';

function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['Timestamp', 'Page Slug', 'Student Email', 'Student Name', 'Faculty Name', 'Status']);
  }
  return sheet;
}

function doGet(e) {
  var page = (e.parameter.page || '').trim();
  if (!page) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'page parameter required' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var action = (e.parameter.action || 'read').trim();

  if (action === 'submit') {
    return handleSubmit(e, page);
  }

  // Default: read
  var sheet = getOrCreateSheet();
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

  var sheet = getOrCreateSheet();
  var data = sheet.getDataRange().getValues();

  // Upsert: find existing row for this (page, studentEmail, facultyName) and update it
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
