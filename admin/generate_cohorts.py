#!/usr/bin/env python3
"""Generate static cohort pages from form submissions.

Usage:
    python generate_cohorts.py submissions.csv [--semester "Fall 2026"] [--resumes-dir ./resumes]

Reads a CSV export of form submissions (from Formspree or any source with the
expected column names) and generates static HTML cohort pages in ../view/.

Each option (structures, mechanical, lighting, construction) gets its own page
at a random unguessable URL. Students who named a specific faculty member get
an additional dedicated page for that faculty member.

Outputs:
  - Static HTML pages in ../view/<slug>/index.html
  - A summary printed to stdout with cohort URLs and draft emails
  - Resumes copied to ../view/<slug>/resumes/ if --resumes-dir is provided
"""

import argparse
import csv
import os
import re
import secrets
import shutil
import sys
from datetime import datetime, timezone

SITE_DIR = os.path.join(os.path.dirname(__file__), "..")
VIEW_DIR = os.path.join(SITE_DIR, "view")

OPTION_COLUMNS = {
    "structures": "interest_structures",
    "mechanical": "interest_mechanical",
    "lighting": "interest_lighting",
    "construction": "interest_construction",
}

OPTION_LABELS = {
    "structures": "Structures",
    "mechanical": "Mechanical / Energy",
    "lighting": "Lighting / Electrical",
    "construction": "Construction",
}

FACULTY = [
    {"name": "John Messner", "options": ["construction"]},
    {"name": "Rob Leicht", "options": ["construction"]},
    {"name": "Yuqing Hu", "options": ["mechanical", "construction"]},
    {"name": "Greg Pavlak", "options": ["mechanical"]},
    {"name": "Wangda Zuo", "options": ["mechanical"]},
    {"name": "Donghyun Rim", "options": ["mechanical"]},
    {"name": "Julian Wang", "options": ["lighting"]},
    {"name": "Dorukalp Durmus", "options": ["lighting"]},
    {"name": "Nathan Brown", "options": ["structures"]},
    {"name": "Rebecca Napolitano", "options": ["structures"]},
    {"name": "Juan Pablo Gevaudan", "options": ["construction"]},
]


def extract_faculty_names(text):
    if not text or not text.strip():
        return [], []
    text_lower = text.lower().strip()
    tokens = []
    for f in FACULTY:
        parts = f["name"].split()
        last = parts[-1].lower()
        tokens.append((last, f))
        if len(parts) > 2:
            tokens.append((" ".join(p.lower() for p in parts[:-1]), f))

    matched, found_ids = [], set()
    for token, fac in tokens:
        if re.search(rf"\b{re.escape(token)}\b", text_lower) and id(fac) not in found_ids:
            matched.append(fac)
            found_ids.add(id(fac))
    if not matched:
        cleaned = re.sub(r"[^a-z\s,/&]", "", text_lower)
        cleaned = re.sub(
            r"\b(i have|i haven't|talked|talk|not yet|yes|no|"
            r"interested|work with|professor|dr|prof|would like|check out)\b",
            "", cleaned,
        )
        remaining = [w.strip() for w in re.split(r"[,/&]", cleaned) if w.strip()]
        return [], [n for n in remaining if len(n) > 2]
    return matched, []


def read_submissions(csv_path):
    students = []
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            def val(key):
                return (row.get(key) or "").strip()
            students.append({
                "name": val("name"),
                "email": val("email"),
                "graduation_year": val("graduation_year"),
                "major": val("major"),
                "citizenship": val("citizenship"),
                "interest_structures": val("interest_structures"),
                "interest_mechanical": val("interest_mechanical"),
                "interest_lighting": val("interest_lighting"),
                "interest_construction": val("interest_construction"),
                "additional_interests": val("additional_interests"),
                "faculty_preference": val("faculty_preference"),
                "resume_filename": val("resume"),
            })
    return students


def match_students(students):
    option_cohorts = {opt: [] for opt in OPTION_COLUMNS}
    faculty_specific = {}
    unmatched = []
    unknown_refs = []

    for s in students:
        high_options = []
        for opt, col in OPTION_COLUMNS.items():
            if s.get(col) == "High interest":
                high_options.append(opt)
                option_cohorts[opt].append(s)

        matched_fac, unmatched_names = extract_faculty_names(s.get("faculty_preference", ""))
        for fac in matched_fac:
            key = fac["name"]
            if key not in faculty_specific:
                faculty_specific[key] = {"faculty": fac, "students": []}
            faculty_specific[key]["students"].append(s)

        if unmatched_names:
            unknown_refs.append({"student": s, "names": unmatched_names, "raw": s["faculty_preference"]})

        if not high_options and not matched_fac:
            unmatched.append(s)

    return option_cohorts, faculty_specific, unmatched, unknown_refs


def escape(text):
    return (text or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def render_student_card(s, slug, resumes_dir):
    resume_link = ""
    if s["resume_filename"] and resumes_dir:
        resume_link = f'<a href="resumes/{escape(s["resume_filename"])}" class="btn btn-secondary" style="padding:0.35rem 0.75rem;font-size:0.82rem;" target="_blank">View Resume</a>'
    interests_html = ""
    for opt, col in OPTION_COLUMNS.items():
        val = s.get(col, "")
        if val == "High interest":
            interests_html += f'<span class="badge badge-high">{OPTION_LABELS[opt]}: High</span> '
        elif val == "Moderate interest":
            interests_html += f'<span class="badge badge-moderate">{OPTION_LABELS[opt]}: Moderate</span> '

    meta_parts = [escape(s["email"])]
    if s["graduation_year"]:
        meta_parts.append(f'Graduating {escape(s["graduation_year"])}')
    if s["major"]:
        meta_parts.append(escape(s["major"]))

    desc = ""
    if s["additional_interests"]:
        desc += f'<div class="description">{escape(s["additional_interests"])}</div>'
    if s["faculty_preference"]:
        desc += f'<div class="description" style="color:var(--text-secondary);font-style:italic;">Faculty preference: {escape(s["faculty_preference"])}</div>'

    return f"""<div class="student-card">
  <h3>{escape(s["name"])}</h3>
  <div class="meta">{" &middot; ".join(meta_parts)}</div>
  <div class="interests">{interests_html}</div>
  {desc}
  {resume_link}
</div>"""


def render_cohort_page(title, semester, students, slug, resumes_dir):
    cards = "\n".join(render_student_card(s, slug, resumes_dir) for s in students)
    count = len(students)
    intro = (
        "This student has expressed interest in working with you through the BE-SURE program."
        if count == 1 else
        f"These {count} students have expressed interest in this area through the BE-SURE program."
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>{escape(title)}</title>
<link rel="stylesheet" href="../../style.css">
</head>
<body>

<header class="hero hero--compact" style="border-bottom:2px solid var(--hero-accent);">
  <div class="hero-inner">
    <p class="hero-eyebrow">{escape(semester)}</p>
    <h1>{escape(title)}</h1>
  </div>
</header>

<section class="section">
  <div class="section-inner">
    <p style="margin-bottom:1.5rem;color:var(--text-secondary);">
      {intro}
      If you'd like to interview any of them, contact Doc Nap and she'll make the introduction.
    </p>

    {cards}
  </div>
</section>

<footer class="site-footer">
  <p>BE-SURE Program &middot; Department of Architectural Engineering &middot; Penn State</p>
</footer>

</body>
</html>"""


def generate(csv_path, semester, resumes_dir):
    students = read_submissions(csv_path)
    print(f"Read {len(students)} submissions from {csv_path}")

    option_cohorts, faculty_specific, unmatched, unknown_refs = match_students(students)

    os.makedirs(VIEW_DIR, exist_ok=True)

    cohort_urls = {}

    for opt, opt_students in option_cohorts.items():
        if not opt_students:
            continue
        slug = secrets.token_urlsafe(24)
        page_dir = os.path.join(VIEW_DIR, slug)
        os.makedirs(page_dir, exist_ok=True)

        if resumes_dir:
            resume_dest = os.path.join(page_dir, "resumes")
            os.makedirs(resume_dest, exist_ok=True)
            for s in opt_students:
                src = os.path.join(resumes_dir, s["resume_filename"]) if s["resume_filename"] else None
                if src and os.path.exists(src):
                    shutil.copy2(src, resume_dest)

        title = f"BE-SURE — {OPTION_LABELS[opt]} Students"
        html = render_cohort_page(title, semester, opt_students, slug, resumes_dir)
        with open(os.path.join(page_dir, "index.html"), "w") as f:
            f.write(html)

        cohort_urls[opt] = slug
        faculty_in_opt = [fac["name"] for fac in FACULTY if opt in fac["options"]]
        print(f"\n{'='*60}")
        print(f"  {OPTION_LABELS[opt]}: {len(opt_students)} student(s)")
        print(f"  URL: view/{slug}/")
        print(f"  Faculty: {', '.join(faculty_in_opt)}")

    for fac_name, data in faculty_specific.items():
        slug = secrets.token_urlsafe(24)
        page_dir = os.path.join(VIEW_DIR, slug)
        os.makedirs(page_dir, exist_ok=True)

        if resumes_dir:
            resume_dest = os.path.join(page_dir, "resumes")
            os.makedirs(resume_dest, exist_ok=True)
            for s in data["students"]:
                src = os.path.join(resumes_dir, s["resume_filename"]) if s["resume_filename"] else None
                if src and os.path.exists(src):
                    shutil.copy2(src, resume_dest)

        title = f"BE-SURE — Students for {fac_name}"
        html = render_cohort_page(title, semester, data["students"], slug, resumes_dir)
        with open(os.path.join(page_dir, "index.html"), "w") as f:
            f.write(html)

        cohort_urls[f"faculty:{fac_name}"] = slug
        print(f"\n{'='*60}")
        print(f"  Faculty-specific: {fac_name} — {len(data['students'])} student(s)")
        print(f"  URL: view/{slug}/")
        for s in data["students"]:
            print(f"    - {s['name']}: \"{s['faculty_preference']}\"")

    if unmatched:
        print(f"\n{'='*60}")
        print(f"  WARNING: {len(unmatched)} student(s) matched ZERO cohorts:")
        for s in unmatched:
            print(f"    - {s['name']} ({s['email']})")

    if unknown_refs:
        print(f"\n{'='*60}")
        print(f"  WARNING: {len(unknown_refs)} student(s) named unrecognized faculty:")
        for ref in unknown_refs:
            print(f"    - {ref['student']['name']} wrote: \"{ref['raw']}\"")

    print(f"\n{'='*60}")
    print(f"\nDraft emails below. Replace BASE_URL with your GitHub Pages URL.\n")

    for opt, slug in cohort_urls.items():
        if opt.startswith("faculty:"):
            fac_name = opt.split(":", 1)[1]
            first_name = fac_name.split()[0]
            students_list = "\n".join(
                f"  - {s['name']}" + (f' (wrote: "{s["faculty_preference"]}")' if s["faculty_preference"] else "")
                for s in faculty_specific[fac_name]["students"]
            )
            print(f"--- EMAIL: {fac_name} ---")
            print(f"Subject: BE-SURE {semester}: Student(s) Interested in Working With You")
            print(f"""
Dear {first_name},

The following BE-SURE student(s) specifically expressed interest in working with you this semester:

{students_list}

You can view their profiles and resumes here:
BASE_URL/view/{slug}/

If you'd like to set up an interview with any of them, let me know and I'll make the introduction.

Best,
Doc Nap
""")
        else:
            label = OPTION_LABELS[opt]
            faculty_in_opt = [fac["name"] for fac in FACULTY if opt in fac["options"]]
            count = len(option_cohorts[opt])
            named = [s for s in option_cohorts[opt] if s["faculty_preference"]]
            named_lines = ""
            if named:
                named_lines = "\nNote — the following students specifically mentioned a faculty member:\n"
                for s in named:
                    named_lines += f"  - {s['name']}: {s['faculty_preference']}\n"

            print(f"--- EMAIL: {label} faculty ---")
            print(f"To: {', '.join(faculty_in_opt)}")
            print(f"Subject: BE-SURE {semester}: Students Interested in {label}")
            print(f"""
Dear {label} faculty,

The following {count} student(s) have expressed high interest in {label.lower()} research through the BE-SURE program this semester.

You can view their profiles and resumes here:
BASE_URL/view/{slug}/
{named_lines}
If you are interested in working with any of these students, please let me know and I will connect you. The student would then set up a time to meet with you.

Best,
Doc Nap
""")

    print("Done. Next steps:")
    print("  1. Review the generated pages in view/")
    print("  2. git add view/ && git commit -m 'Generate cohort pages' && git push")
    print("  3. Copy the draft emails above, replace BASE_URL with your GitHub Pages URL, and send.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate BE-SURE cohort pages from form submissions")
    parser.add_argument("csv", help="Path to CSV export of form submissions")
    parser.add_argument("--semester", default=None, help="Semester label (default: auto-detect)")
    parser.add_argument("--resumes-dir", default=None, help="Directory containing resume files")
    args = parser.parse_args()

    if not args.semester:
        now = datetime.now(timezone.utc)
        if now.month >= 8:
            args.semester = f"Fall {now.year}"
        elif now.month >= 5:
            args.semester = f"Summer {now.year}"
        else:
            args.semester = f"Spring {now.year}"

    generate(args.csv, args.semester, args.resumes_dir)
