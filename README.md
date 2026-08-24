# BE-SURE Program

**Building Engineering — Seminal Undergraduate Research Experience**

Matches undergraduate students with AE faculty for paid research positions ($15/hr, ~5-10 hrs/week).

**Live site:** https://rkn2.github.io/besure/

## How it works

1. Students fill out the application form at `/apply.html`
2. Submissions go to Formspree (email notification + stored in dashboard)
3. At the start of each semester, export submissions as CSV and download resumes from Formspree
4. Run `admin/generate_cohorts.py` to match students → faculty and generate cohort pages + draft emails
5. Push the generated `view/` pages, copy the draft emails, send
6. Track placements and funding with the local Flask admin app

## Setup

### Formspree (one-time)
1. Create a free account at https://formspree.io
2. Create a new form
3. In `apply.html`, replace `YOUR_FORM_ID` with your form ID
4. Commit and push

### Local admin tools
```
cd admin
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Generating cohort pages

Export form submissions as CSV from Formspree. Column names should match the form field names (`name`, `email`, `graduation_year`, `major`, `citizenship`, `interest_structures`, `interest_mechanical`, `interest_lighting`, `interest_construction`, `additional_interests`, `faculty_preference`, `resume`).

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

## Local Flask admin (optional)

For tracking placements, funding, and generating welcome/payroll emails:

```
cd admin
source venv/bin/activate
FLASK_DEBUG=1 python app.py
```

Admin dashboard at `http://localhost:5050/admin` (password: `changeme` in dev mode).

Pipeline: emailed → confirmed with faculty → confirmed with student

Funding tracked per semester with separate source label and IO number fields. Payroll emails go to Michele Kephart.

## TODO

- [ ] Set up Formspree account and plug in form ID in `apply.html`
- [ ] Decide on private hosting for cohort pages (public repo means `view/` is browsable — URLs are unguessable but not truly private)
