# AE Research Scholars

**Architectural Engineering Undergraduate Research**

Matches undergraduate students with AE faculty for paid research positions ($15/hr, ~5-10 hrs/week).

**Live site:** https://rkn2.github.io/besure/
**Faculty cohort page:** https://rkn2.github.io/besure/view/
**Placements & funding (for finance):** https://rkn2.github.io/besure/placements.html

## How it works

1. Students fill out the application via Google Form (linked from `/apply.html`)
2. Submissions land in a linked Google Sheet (with resumes in Google Drive)
3. At the start of each semester, export the Google Sheet as CSV
4. Run `admin/generate_cohorts.py` to match students → faculty and generate cohort pages + draft emails
5. Push the generated `view/` pages, copy the draft emails, send
6. Track placements and funding with the local Flask admin app

## Status workflow

Three statuses, each with an automated action:

| Status | Dropdown label | What happens |
|--------|---------------|--------------|
| **Interested** | Interested | Logged to sheet. Nothing else. |
| **Emailed** | Send introduction email to student | Sends an email from `psuaeresearchscholars@gmail.com` to the student introducing them to the faculty member. CC: Becca + PI. Confirmation popup before sending. |
| **Accepted** | Accept — send payroll to finance | Two emails fire: (1) payroll setup to Latrisha Hough (ldw5@psu.edu), CC Becca + PI; (2) welcome email to the student, CC Becca + PI + Latrisha. Welcome email varies by new vs. returning student (see below). Student does not see the finance info. Confirmation popup before sending. |
| **Not interested** | Not interested — remove from my list | Logged to sheet. Removes the faculty member's interest. |

Both "Emailed" and "Accepted" show a confirmation popup so nothing fires by accident.

## Email flow (how the two scripts work together)

There are two Google Apps Scripts that work together:

### 1. Spreadsheet script (`apps-script.js`)
- Lives in the response tracking spreadsheet (Extensions > Apps Script)
- Deployed as a web app (must redeploy as **new version** after any code change)
- Handles form submissions from the faculty-facing website
- On **Emailed**: writes a row to the "Pending Introductions" sheet
- On **Accepted**: writes a row to the "Pending Onboarding" sheet
- Does NOT send emails (can't send from psuaeresearchscholars)

### 2. Standalone script (`apps-script-email.js`)
- Lives under the `psuaeresearchscholars@gmail.com` Google account (script.google.com)
- Runs on a 5-minute timer trigger (NOT a web app -- saving is enough, no deploy needed)
- Two functions run on triggers:
  - **`processPendingIntroductions`**: picks up rows from "Pending Introductions", sends introduction email to the student from psuaeresearchscholars, marks row as sent
  - **`processPendingOnboarding`**: picks up rows from "Pending Onboarding", sends payroll email to Latrisha AND welcome email to student from psuaeresearchscholars, marks row as sent
- Also handles email-triggered acceptance via Gmail label (`aers-accept`)

### Updating the scripts

**Spreadsheet script** (handles website submissions):
1. Copy entire contents of `apps-script.js`
2. Paste into the spreadsheet's Apps Script editor (Extensions > Apps Script)
3. Save
4. **Deploy > Manage deployments > pencil icon > New version > Deploy** (required -- saving alone does NOT update the live web app)

**Standalone script** (sends emails):
1. Copy entire contents of `apps-script-email.js`
2. Paste into the standalone script at script.google.com (logged in as psuaeresearchscholars)
3. Save (no deploy needed -- it runs on a timer)

### Triggers (set up in the standalone script)

| Function | Type | Interval |
|----------|------|----------|
| `processPendingIntroductions` | Time-driven, Minutes timer | Every 5 minutes |
| `processPendingOnboarding` | Time-driven, Minutes timer | Every 5 minutes |

## Resumes

Student resumes are uploaded via the Google Form and stored in a Google Drive folder ("AE Research Scholars (File responses)"). The folder is shared as "Anyone with the link can view" so faculty can click "View Resume" on student cards without requesting access. The resume links are unguessable URLs only visible on the faculty-facing cohort page.

If the folder permissions get reset (e.g., after re-creating the form), re-share the folder: Google Drive > find "AE Research Scholars (File responses)" > Share > "Anyone with the link" > Viewer.

## Emails sent

### Introduction email (on "Emailed")
- **From:** psuaeresearchscholars@gmail.com
- **To:** student
- **CC:** Becca (rjn5308@psu.edu), PI
- **Subject:** AE Research Scholars — Introduction to [faculty name]
- **Body:** Lets the student know the faculty member is interested, asks them to reach out directly

### Payroll email (on "Accepted")
- **From:** psuaeresearchscholars@gmail.com
- **To:** Latrisha Hough (ldw5@psu.edu)
- **CC:** Becca (rjn5308@psu.edu), PI
- **Subject:** New AE Research Scholar Payroll Information
- **Body:** Student name, faculty mentor, funding sources with IO numbers

### Welcome email — new student (on "Accepted", sent at the same time as payroll)
- **From:** psuaeresearchscholars@gmail.com
- **To:** student
- **CC:** Becca (rjn5308@psu.edu), PI, Latrisha (ldw5@psu.edu)
- **Subject:** Welcome to the AE Research Scholars Program!
- **Body:** Teams channel info, poster session, pay rate ($15/hr), HR application instructions (REQ_0000072675), tells student to let Latrisha know once they apply. Signed "Doc Nap."

### Welcome email — returning student (on "Accepted", sent at the same time as payroll)
- **From:** psuaeresearchscholars@gmail.com
- **To:** student
- **CC:** Becca (rjn5308@psu.edu), PI, Latrisha (ldw5@psu.edu)
- **Subject:** Welcome to the AE Research Scholars Program!
- **Body:** Same as new student email, but instead of application instructions, tells them they're already in the system and don't need to reapply.

### Returning student detection
A student is considered "returning" if their name appears in the **Previous Scholars** sheet in the response tracking spreadsheet or in the existing **Placements** sheet. Name matching normalizes "Last, First" and "First Last" formats. Newly accepted students are automatically added to the Previous Scholars sheet for future rounds.

## Setup

### Google Form (one-time)
1. Create a Google Form with these questions:
   - Full name (Short answer, Required)
   - Email address (Short answer, Required)
   - Expected graduation year (Short answer)
   - What is your (intended) major? (Short answer)
   - Are you a US citizen or permanent resident? (Multiple choice: Yes / No / Prefer not to say)
   - Rate your interest in Structures (Multiple choice: High interest / Moderate interest / Low interest / Not at all)
   - Rate your interest in Mechanical / Energy (same options)
   - Rate your interest in Lighting / Electrical (same options)
   - Rate your interest in Construction (same options)
   - What type of research work interests you? (Paragraph, optional)
   - Is there a faculty member you would like to work with? (Paragraph, optional)
   - Please upload a copy of your resume (File upload)
2. Link it to a Google Sheet: open form → Responses tab → green Sheets icon
3. In `apply.html`, replace `YOUR_GOOGLE_FORM_URL` with the form's public link
4. Commit and push

### Local admin tools
```
cd admin
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Generating cohort pages

Export the linked Google Sheet as CSV (File → Download → CSV). The script auto-detects column names from both Google Forms exports (full question text headers) and short-name CSVs.

```
cd ~/Code/besure-admin
python generate_cohorts.py submissions.csv --semester "Fall 2026" --resumes-dir ./resumes
```

This generates a single page at `view/index.html` with all students embedded as data, prints draft emails, and flags:
- Students who matched zero cohorts (all Moderate/Low, no named faculty)
- Students who named unrecognized faculty

Then push from the website repo:
```
cd ~/Code/besure
git add view/
git commit -m "Generate Fall 2026 cohort pages"
git push
```

All faculty get the same link — `https://rkn2.github.io/besure/view/` — select their name to see students matched to their research area, with filters to browse others.

## Matching rules

- **High interest only** for option cohort assignment (Moderate/Low/None excluded)
- Students who name a specific faculty member get a dedicated page + email for that faculty
- Students with zero high-interest options AND no named faculty are flagged for manual review
- Citizenship is available as a filter checkbox on faculty-facing pages (not shown on individual cards)

## Faculty roster

| Faculty | Option(s) | Email |
|---|---|---|
| Nathan Brown | Structures | ncb5048@psu.edu |
| Rebecca Napolitano | Structures | rjn5308@psu.edu |
| Tyler Hull | Structures | thull@psu.edu |
| Botong Zheng | Structures | bbz5226@psu.edu |
| Mariantonieta Gutierrez Soto | Structures, Construction | mvg5899@psu.edu |
| Yuqing Hu | Mechanical/Energy, Construction | yfh5204@psu.edu |
| Greg Pavlak | Mechanical/Energy | gxp93@psu.edu |
| Wangda Zuo | Mechanical/Energy | wangda.zuo@psu.edu |
| Jin Wen | Mechanical/Energy | jvw6499@psu.edu |
| Donghyun Rim | Mechanical/Energy | dxr51@psu.edu |
| Moses Ling | Mechanical/Energy | mdl5@psu.edu |
| Julian Wang | Lighting/Electrical | jqw5965@psu.edu |
| Dorukalp Durmus | Lighting/Electrical | alp@psu.edu |
| John Messner | Construction | jim101@psu.edu |
| Rob Leicht | Construction | rml167@psu.edu |
| Juan Pablo Gevaudan | Construction | j.p.gevaudan@psu.edu |

Faculty emails are maintained in `FACULTY_EMAILS` in three files: `apps-script.js`, `apps-script-email.js`, and `response-tracking.js`. Update all three when adding/removing faculty, plus `FACULTY_OPTIONS` in `view/index.html`.

## Key contacts

| Role | Name | Email |
|------|------|-------|
| Program coordinator | Becca Napolitano | rjn5308@psu.edu |
| Finance / payroll | Latrisha Hough | ldw5@psu.edu |
| Program email account | — | psuaeresearchscholars@gmail.com |

## Common tasks

### Removing a student
If a student applied by mistake or needs to be removed:
1. Open the Google Sheet linked to the form
2. Find their row, right-click the row number, delete row
3. The website pulls data live from the sheet — they disappear immediately

### Adding or removing faculty
Update `FACULTY_EMAILS` in **all three** scripts:
- `apps-script.js` (spreadsheet script — redeploy after saving)
- `apps-script-email.js` (standalone psuaeresearchscholars script — save only, no deploy needed)
- `response-tracking.js` (client-side — push to GitHub, auto-deploys via Pages)

Also update the `FACULTY_OPTIONS` map in `view/index.html` and the faculty roster table in this README.

### Resume access issues
If faculty report needing to "request access" for resumes, the Google Drive subfolder permissions have reset. Fix: Google Drive > search "Please attach a pdf of your resume" > Share > "Anyone with the link" > Viewer. See the Resumes section above.

## Security

- **API key**: All requests to the Apps Script web app require a `key` parameter. The key is in `apps-script.js` (server-side check) and in the client-side files (`response-tracking.js`, `placements.html`, `view/index.html`). It blocks unauthorized API access but is visible in page source — it stops casual abuse, not a determined attacker.
- **Input sanitization**: Student and faculty names are stripped of newlines/tabs before being used in email bodies to prevent content injection.
- **Spreadsheet access**: The response tracking spreadsheet is set to Restricted (not public). Only shared accounts can access it directly.
- **Student PII**: Applicant data (names, emails, citizenship, resumes) is served through the API key-protected endpoint. Resume links use unguessable Google Drive URLs.

## Admin tools

Admin tools (matching script, Flask dashboard, email templates) live in the private repo: [besure-admin](https://github.com/rkn2/besure-admin)

## TODO

- [ ] **Move `FACULTY_EMAILS` to a Google Sheet** — currently hardcoded in `apps-script.js`, `apps-script-email.js`, and `response-tracking.js`. Adding/removing faculty requires updating all three plus `view/index.html`. Pull from a "Faculty" sheet instead so there's one source of truth.
- [ ] Consider custom subdomain (e.g., `scholars.ae.psu.edu`) — requires CNAME from dept IT pointing to `rkn2.github.io`, then configure in GitHub Pages settings
- [ ] Consider private hosting for cohort pages (currently public repo with unguessable URLs — fine for now)
- [ ] Update `generate_cohorts.py` template in `besure-admin` when adding new features to cohort page
