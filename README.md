# AE Research Scholars

**Architectural Engineering Undergraduate Research**

Matches undergraduate students with AE faculty for paid research positions ($15/hr, ~5-10 hrs/week).

**Live site:** https://rkn2.github.io/besure/

## How it works

1. Students fill out the application via Google Form (linked from `/apply.html`)
2. Submissions land in a linked Google Sheet (with resumes in Google Drive)
3. At the start of each semester, export the Google Sheet as CSV
4. Run `admin/generate_cohorts.py` to match students → faculty and generate cohort pages + draft emails
5. Push the generated `view/` pages, copy the draft emails, send
6. Track placements and funding with the local Flask admin app

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
python admin/generate_cohorts.py submissions.csv --semester "Fall 2026" --resumes-dir ./resumes
```

This generates static HTML pages in `view/` with unguessable URLs, prints draft emails, and flags:
- Students who matched zero cohorts (all Moderate/Low, no named faculty)
- Students who named unrecognized faculty

Then push:
```
git add view/
git commit -m "Generate Fall 2026 cohort pages"
git push
```

Faculty get a link like `https://rkn2.github.io/besure/view/random-slug/` — no login needed.

## Matching rules

- **High interest only** for option cohort assignment (Moderate/Low/None excluded)
- Students who name a specific faculty member get a dedicated page + email for that faculty
- Students with zero high-interest options AND no named faculty are flagged for manual review
- Citizenship field is never shown on faculty-facing pages

## Faculty roster

| Faculty | Option(s) |
|---|---|
| Nathan Brown | Structures |
| Rebecca Napolitano | Structures |
| Yuqing Hu | Mechanical/Energy, Construction |
| Greg Pavlak | Mechanical/Energy |
| Wangda Zuo | Mechanical/Energy |
| Donghyun Rim | Mechanical/Energy |
| Julian Wang | Lighting/Electrical |
| Dorukalp Durmus | Lighting/Electrical |
| John Messner | Construction |
| Rob Leicht | Construction |
| Juan Pablo Gevaudan | Construction |

## Admin tools

Admin tools (matching script, Flask dashboard, email templates) live in the private repo: [besure-admin](https://github.com/rkn2/besure-admin)

Pipeline: emailed → confirmed with faculty → confirmed with student

Funding tracked per semester with separate source label and IO number fields. Payroll emails go to Michele Kephart.

## TODO

- [ ] **Create Google Form** with the 12 fields listed above and plug the URL into `apply.html`
- [ ] **Faculty response tracking on cohort pages** — let faculty indicate interest directly on the student pages (e.g., write their name + status: "emailed student", "offered position", "did not offer position") so other faculty can see who is still available vs already claimed. Could be a simple form on each cohort page that writes back to a shared sheet or updates the page.
- [ ] Decide on private hosting for cohort pages (public repo means `view/` is browsable — URLs are unguessable but not truly private)
