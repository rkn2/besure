import os
import functools
from datetime import datetime, timezone

from flask import (
    Flask, render_template, request, redirect, url_for, flash,
    session, send_from_directory, abort,
)
from werkzeug.utils import secure_filename

import config
import models
from matching import match_students, OPTION_LABELS, OPTION_COLUMNS

app = Flask(__name__)
app.secret_key = config.SECRET_KEY
app.config["MAX_CONTENT_LENGTH"] = config.MAX_RESUME_SIZE_MB * 1024 * 1024


# --- Auth ---

def admin_required(f):
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        if not session.get("admin"):
            return redirect(url_for("admin_login"))
        return f(*args, **kwargs)
    return wrapper


@app.route("/admin/login", methods=["GET", "POST"])
def admin_login():
    if request.method == "POST":
        if request.form.get("password") == config.ADMIN_PASSWORD:
            session["admin"] = True
            return redirect(url_for("admin_dashboard"))
        flash("Incorrect password.", "error")
    return render_template("admin/login.html")


@app.route("/admin/logout")
def admin_logout():
    session.pop("admin", None)
    return redirect(url_for("apply_form"))


# --- Student Application ---

@app.route("/")
def index():
    return redirect(url_for("apply_form"))


@app.route("/apply", methods=["GET"])
def apply_form():
    return render_template("apply.html")


@app.route("/apply", methods=["POST"])
def apply_submit():
    conn = models.get_db()
    semester = models.get_active_semester(conn)

    name = request.form.get("name", "").strip()
    email = request.form.get("email", "").strip()
    if not name or not email:
        flash("Name and email are required.", "error")
        conn.close()
        return redirect(url_for("apply_form"))

    resume_file = request.files.get("resume")
    resume_filename = None
    if resume_file and resume_file.filename:
        ext = os.path.splitext(resume_file.filename)[1].lower()
        if ext not in config.ALLOWED_RESUME_EXTENSIONS:
            flash("Resume must be a PDF, DOC, or DOCX file.", "error")
            conn.close()
            return redirect(url_for("apply_form"))
        safe_name = secure_filename(f"{name.replace(' ', '_')}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}{ext}")
        os.makedirs(config.RESUME_DIR, exist_ok=True)
        resume_file.save(os.path.join(config.RESUME_DIR, safe_name))
        resume_filename = safe_name

    conn.execute(
        """INSERT INTO students
           (name, email, graduation_year, us_citizen_or_resident, major,
            interest_structures, interest_mechanical, interest_lighting,
            interest_construction, additional_interests, faculty_preference,
            resume_filename, semester)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            name,
            email,
            request.form.get("graduation_year", "").strip(),
            request.form.get("citizenship", "").strip(),
            request.form.get("major", "").strip(),
            request.form.get("interest_structures"),
            request.form.get("interest_mechanical"),
            request.form.get("interest_lighting"),
            request.form.get("interest_construction"),
            request.form.get("additional_interests", "").strip(),
            request.form.get("faculty_preference", "").strip(),
            resume_filename,
            semester,
        ),
    )
    conn.commit()
    conn.close()
    return render_template("apply_thanks.html", name=name)


# --- Admin Dashboard ---

@app.route("/admin")
@admin_required
def admin_dashboard():
    conn = models.get_db()
    semester = models.get_active_semester(conn)
    app_count = conn.execute(
        "SELECT COUNT(*) as c FROM students WHERE semester = ?", (semester,)
    ).fetchone()["c"]
    placement_count = conn.execute(
        "SELECT COUNT(*) as c FROM placements p JOIN students s ON p.student_id = s.id WHERE s.semester = ?",
        (semester,),
    ).fetchone()["c"]
    recent = conn.execute(
        "SELECT * FROM students WHERE semester = ? ORDER BY applied_at DESC LIMIT 10",
        (semester,),
    ).fetchall()
    conn.close()
    return render_template(
        "admin/dashboard.html",
        semester=semester,
        app_count=app_count,
        placement_count=placement_count,
        recent=recent,
    )


@app.route("/admin/semester", methods=["POST"])
@admin_required
def set_semester():
    sem = request.form.get("semester", "").strip()
    if sem:
        conn = models.get_db()
        models.set_active_semester(conn, sem)
        conn.close()
        flash(f"Active semester set to {sem}.", "success")
    return redirect(url_for("admin_dashboard"))


@app.route("/admin/applications")
@admin_required
def admin_applications():
    conn = models.get_db()
    semester = request.args.get("semester") or models.get_active_semester(conn)
    semesters = conn.execute(
        "SELECT DISTINCT semester FROM students ORDER BY semester DESC"
    ).fetchall()
    students = conn.execute(
        "SELECT * FROM students WHERE semester = ? ORDER BY applied_at DESC",
        (semester,),
    ).fetchall()
    conn.close()
    return render_template(
        "admin/applications.html",
        students=students,
        semester=semester,
        semesters=semesters,
        option_labels=OPTION_LABELS,
    )


@app.route("/admin/applications/<int:student_id>")
@admin_required
def admin_student_detail(student_id):
    conn = models.get_db()
    student = conn.execute("SELECT * FROM students WHERE id = ?", (student_id,)).fetchone()
    if not student:
        conn.close()
        abort(404)
    placement = conn.execute(
        "SELECT p.*, f.name as faculty_name FROM placements p "
        "JOIN faculty f ON p.faculty_id = f.id WHERE p.student_id = ?",
        (student_id,),
    ).fetchone()
    conn.close()
    return render_template(
        "admin/student_detail.html",
        student=student,
        placement=placement,
        option_labels=OPTION_LABELS,
    )


# --- Matching ---

@app.route("/admin/match")
@admin_required
def admin_match():
    conn = models.get_db()
    semester = request.args.get("semester") or models.get_active_semester(conn)
    results = match_students(conn, semester)
    existing_cohorts = conn.execute(
        "SELECT * FROM cohort_pages WHERE semester = ? ORDER BY page_type, option_name",
        (semester,),
    ).fetchall()
    conn.close()
    return render_template(
        "admin/match.html",
        results=results,
        semester=semester,
        option_labels=OPTION_LABELS,
        existing_cohorts=existing_cohorts,
    )


@app.route("/admin/match/generate", methods=["POST"])
@admin_required
def generate_cohorts():
    conn = models.get_db()
    semester = request.form.get("semester")
    results = match_students(conn, semester)

    conn.execute(
        "DELETE FROM cohort_students WHERE cohort_id IN "
        "(SELECT id FROM cohort_pages WHERE semester = ?)",
        (semester,),
    )
    conn.execute("DELETE FROM cohort_pages WHERE semester = ?", (semester,))

    for opt, students in results["option_cohorts"].items():
        if not students:
            continue
        slug = models.generate_slug()
        cursor = conn.execute(
            "INSERT INTO cohort_pages (slug, option_name, semester, page_type) VALUES (?, ?, ?, 'option')",
            (slug, opt, semester),
        )
        cohort_id = cursor.lastrowid
        for s in students:
            conn.execute(
                "INSERT INTO cohort_students (cohort_id, student_id) VALUES (?, ?)",
                (cohort_id, s["id"]),
            )

    for fac_id, data in results["faculty_specific"].items():
        slug = models.generate_slug()
        cursor = conn.execute(
            "INSERT INTO cohort_pages (slug, faculty_id, semester, page_type) VALUES (?, ?, ?, 'faculty')",
            (slug, fac_id, semester),
        )
        cohort_id = cursor.lastrowid
        for s in data["students"]:
            conn.execute(
                "INSERT INTO cohort_students (cohort_id, student_id) VALUES (?, ?)",
                (cohort_id, s["id"]),
            )

    conn.commit()
    conn.close()
    flash("Cohort pages generated. View draft emails below.", "success")
    return redirect(url_for("admin_emails", semester=semester))


# --- Draft Emails ---

@app.route("/admin/emails")
@admin_required
def admin_emails():
    conn = models.get_db()
    semester = request.args.get("semester") or models.get_active_semester(conn)
    cohorts = conn.execute(
        "SELECT * FROM cohort_pages WHERE semester = ? ORDER BY page_type, option_name",
        (semester,),
    ).fetchall()

    emails = []
    for c in cohorts:
        students = conn.execute(
            "SELECT s.* FROM students s "
            "JOIN cohort_students cs ON s.id = cs.student_id "
            "WHERE cs.cohort_id = ?",
            (c["id"],),
        ).fetchall()
        if not students:
            continue

        if c["page_type"] == "option":
            faculty_in_option = conn.execute(
                "SELECT f.name, f.email FROM faculty f "
                "JOIN faculty_options fo ON f.id = fo.faculty_id "
                "WHERE fo.option_name = ? ORDER BY f.name",
                (c["option_name"],),
            ).fetchall()
            label = OPTION_LABELS.get(c["option_name"], c["option_name"])
            to_names = ", ".join(f["name"] for f in faculty_in_option)
            subject = f"AE Research Scholars {semester}: Students Interested in {label}"
            body = (
                f"Dear {label} faculty,\n\n"
                f"The following {len(students)} student(s) have expressed high interest "
                f"in {label.lower()} research through the AE Research Scholars program this semester.\n\n"
                f"You can view their profiles and resumes here:\n"
                f"{{{{ cohort_url }}}}\n\n"
            )
            named = [s for s in students if s["faculty_preference"]]
            if named:
                body += "Note — the following students specifically mentioned a faculty member:\n"
                for s in named:
                    body += f"  - {s['name']}: {s['faculty_preference']}\n"
                body += "\n"
            body += (
                "If you are interested in working with any of these students, please let me know "
                "and I will connect you. The student would then set up a time to meet with you.\n\n"
                "Best,\nDoc Nap"
            )
            emails.append({
                "type": "option",
                "label": label,
                "to": to_names,
                "subject": subject,
                "body": body,
                "slug": c["slug"],
                "student_count": len(students),
            })

        elif c["page_type"] == "faculty":
            fac = conn.execute(
                "SELECT * FROM faculty WHERE id = ?", (c["faculty_id"],)
            ).fetchone()
            if not fac:
                continue
            student_names = ", ".join(s["name"] for s in students)
            subject = f"AE Research Scholars {semester}: Student(s) Interested in Working With You"
            body = (
                f"Dear {fac['name'].split()[0]},\n\n"
                f"The following AE Research Scholars student(s) specifically expressed interest in working "
                f"with you this semester:\n\n"
            )
            for s in students:
                body += f"  - {s['name']}"
                if s["faculty_preference"]:
                    body += f" (wrote: \"{s['faculty_preference']}\")"
                body += "\n"
            body += (
                f"\nYou can view their profiles and resumes here:\n"
                f"{{{{ cohort_url }}}}\n\n"
                "If you'd like to set up an interview with any of them, let me know "
                "and I'll make the introduction.\n\n"
                "Best,\nDoc Nap"
            )
            emails.append({
                "type": "faculty",
                "label": fac["name"],
                "to": fac["name"],
                "subject": subject,
                "body": body,
                "slug": c["slug"],
                "student_count": len(students),
            })

    results = match_students(conn, semester)
    conn.close()
    return render_template(
        "admin/emails.html",
        emails=emails,
        semester=semester,
        unmatched=results["unmatched_students"],
        unknown_refs=results["unknown_faculty_refs"],
    )


# --- Faculty Management ---

@app.route("/admin/faculty")
@admin_required
def admin_faculty():
    conn = models.get_db()
    faculty = conn.execute("SELECT * FROM faculty ORDER BY name").fetchall()
    faculty_opts = {}
    for row in conn.execute("SELECT * FROM faculty_options"):
        faculty_opts.setdefault(row["faculty_id"], []).append(row["option_name"])
    conn.close()
    return render_template(
        "admin/faculty.html",
        faculty=faculty,
        faculty_opts=faculty_opts,
        option_labels=OPTION_LABELS,
    )


@app.route("/admin/faculty/add", methods=["POST"])
@admin_required
def add_faculty():
    conn = models.get_db()
    name = request.form.get("name", "").strip()
    email = request.form.get("email", "").strip()
    research = request.form.get("research", "").strip()
    options = request.form.getlist("options")
    if not name:
        flash("Faculty name is required.", "error")
        conn.close()
        return redirect(url_for("admin_faculty"))
    cursor = conn.execute(
        "INSERT INTO faculty (name, email, research_summary) VALUES (?, ?, ?)",
        (name, email or None, research or None),
    )
    fid = cursor.lastrowid
    for opt in options:
        if opt in OPTION_COLUMNS:
            conn.execute(
                "INSERT INTO faculty_options (faculty_id, option_name) VALUES (?, ?)",
                (fid, opt),
            )
    conn.commit()
    conn.close()
    flash(f"Added {name}.", "success")
    return redirect(url_for("admin_faculty"))


@app.route("/admin/faculty/<int:fac_id>/delete", methods=["POST"])
@admin_required
def delete_faculty(fac_id):
    conn = models.get_db()
    conn.execute("DELETE FROM faculty_options WHERE faculty_id = ?", (fac_id,))
    conn.execute("DELETE FROM faculty WHERE id = ?", (fac_id,))
    conn.commit()
    conn.close()
    flash("Faculty removed.", "success")
    return redirect(url_for("admin_faculty"))


# --- Placements ---

@app.route("/admin/placements")
@admin_required
def admin_placements():
    conn = models.get_db()
    semester = request.args.get("semester")
    all_semesters = conn.execute(
        "SELECT DISTINCT semester FROM students ORDER BY semester DESC"
    ).fetchall()
    if semester:
        placements = conn.execute(
            "SELECT p.*, s.name as student_name, s.email as student_email, "
            "s.semester as student_semester, f.name as faculty_name "
            "FROM placements p "
            "JOIN students s ON p.student_id = s.id "
            "JOIN faculty f ON p.faculty_id = f.id "
            "WHERE s.semester = ? "
            "ORDER BY p.status, s.name",
            (semester,),
        ).fetchall()
        unplaced = conn.execute(
            "SELECT s.* FROM students s "
            "WHERE s.semester = ? AND s.id NOT IN (SELECT student_id FROM placements) "
            "ORDER BY s.name",
            (semester,),
        ).fetchall()
    else:
        semester = "All"
        placements = conn.execute(
            "SELECT p.*, s.name as student_name, s.email as student_email, "
            "s.semester as student_semester, f.name as faculty_name "
            "FROM placements p "
            "JOIN students s ON p.student_id = s.id "
            "JOIN faculty f ON p.faculty_id = f.id "
            "ORDER BY p.status, s.name",
        ).fetchall()
        unplaced = conn.execute(
            "SELECT s.* FROM students s "
            "WHERE s.id NOT IN (SELECT student_id FROM placements) "
            "ORDER BY s.name",
        ).fetchall()
    faculty = conn.execute("SELECT * FROM faculty ORDER BY name").fetchall()
    conn.close()
    return render_template(
        "admin/placements.html",
        placements=placements,
        unplaced=unplaced,
        faculty=faculty,
        semester=semester,
        semesters=all_semesters,
    )


@app.route("/admin/placements/create", methods=["POST"])
@admin_required
def create_placement():
    conn = models.get_db()
    student_id = request.form.get("student_id", type=int)
    faculty_id = request.form.get("faculty_id", type=int)
    if not student_id or not faculty_id:
        flash("Student and faculty are required.", "error")
        conn.close()
        return redirect(url_for("admin_placements"))
    conn.execute(
        "INSERT INTO placements (student_id, faculty_id) VALUES (?, ?)",
        (student_id, faculty_id),
    )
    conn.commit()
    conn.close()
    flash("Placement created.", "success")
    return redirect(url_for("admin_placements"))


@app.route("/admin/placements/<int:placement_id>", methods=["POST"])
@admin_required
def update_placement(placement_id):
    conn = models.get_db()
    p = conn.execute("SELECT * FROM placements WHERE id = ?", (placement_id,)).fetchone()
    if not p:
        conn.close()
        abort(404)
    conn.execute(
        """UPDATE placements SET
           status = ?, phd_postdoc_adviser = ?,
           fall_funding_source = ?, fall_funding_io = ?,
           spring_funding_source = ?, spring_funding_io = ?,
           summer_funding_source = ?, summer_funding_io = ?,
           notes = ?, presented = ?, nsf_grfp_applicant = ?,
           conference_grant = ?
           WHERE id = ?""",
        (
            request.form.get("status", p["status"]),
            request.form.get("phd_postdoc_adviser", "").strip() or None,
            request.form.get("fall_funding_source", "").strip() or None,
            request.form.get("fall_funding_io", "").strip() or None,
            request.form.get("spring_funding_source", "").strip() or None,
            request.form.get("spring_funding_io", "").strip() or None,
            request.form.get("summer_funding_source", "").strip() or None,
            request.form.get("summer_funding_io", "").strip() or None,
            request.form.get("notes", "").strip() or None,
            1 if request.form.get("presented") else 0,
            1 if request.form.get("nsf_grfp_applicant") else 0,
            request.form.get("conference_grant", "").strip() or None,
            placement_id,
        ),
    )
    conn.commit()

    action = request.form.get("action")
    if action == "generate_welcome":
        student = conn.execute(
            "SELECT * FROM students WHERE id = ?", (p["student_id"],)
        ).fetchone()
        faculty = conn.execute(
            "SELECT * FROM faculty WHERE id = ?", (p["faculty_id"],)
        ).fetchone()
        conn.close()
        return render_template(
            "admin/welcome_email.html",
            student=student,
            faculty=faculty,
            placement_id=placement_id,
        )
    if action == "generate_payroll":
        student = conn.execute(
            "SELECT * FROM students WHERE id = ?", (p["student_id"],)
        ).fetchone()
        faculty = conn.execute(
            "SELECT * FROM faculty WHERE id = ?", (p["faculty_id"],)
        ).fetchone()
        updated_p = conn.execute(
            "SELECT * FROM placements WHERE id = ?", (placement_id,)
        ).fetchone()
        conn.close()
        return render_template(
            "admin/payroll_email.html",
            student=student,
            faculty=faculty,
            placement=updated_p,
        )

    conn.close()
    flash("Placement updated.", "success")
    return redirect(url_for("admin_placements", semester=request.form.get("return_semester")))


# --- Faculty-Facing Cohort View ---

@app.route("/view/<slug>")
def view_cohort(slug):
    conn = models.get_db()
    cohort = conn.execute(
        "SELECT * FROM cohort_pages WHERE slug = ?", (slug,)
    ).fetchone()
    if not cohort:
        conn.close()
        abort(404)
    students = conn.execute(
        "SELECT s.id, s.name, s.email, s.graduation_year, s.major, "
        "s.interest_structures, s.interest_mechanical, s.interest_lighting, "
        "s.interest_construction, s.additional_interests, s.faculty_preference, "
        "s.resume_filename "
        "FROM students s "
        "JOIN cohort_students cs ON s.id = cs.student_id "
        "WHERE cs.cohort_id = ? ORDER BY s.name",
        (cohort["id"],),
    ).fetchall()

    title = ""
    if cohort["page_type"] == "option":
        title = f"AE Research Scholars — {OPTION_LABELS.get(cohort['option_name'], '')} Students"
    elif cohort["page_type"] == "faculty":
        fac = conn.execute(
            "SELECT name FROM faculty WHERE id = ?", (cohort["faculty_id"],)
        ).fetchone()
        title = f"AE Research Scholars — Students for {fac['name']}" if fac else "AE Research Scholars Students"

    conn.close()
    return render_template(
        "cohort_view.html",
        cohort=cohort,
        students=students,
        title=title,
        semester=cohort["semester"],
        option_labels=OPTION_LABELS,
    )


@app.route("/view/<slug>/resume/<int:student_id>")
def view_resume(slug, student_id):
    conn = models.get_db()
    cohort = conn.execute("SELECT id FROM cohort_pages WHERE slug = ?", (slug,)).fetchone()
    if not cohort:
        conn.close()
        abort(404)
    link = conn.execute(
        "SELECT 1 FROM cohort_students WHERE cohort_id = ? AND student_id = ?",
        (cohort["id"], student_id),
    ).fetchone()
    if not link:
        conn.close()
        abort(404)
    student = conn.execute(
        "SELECT resume_filename FROM students WHERE id = ?", (student_id,)
    ).fetchone()
    if not student or not student["resume_filename"]:
        conn.close()
        abort(404)
    conn.close()
    return send_from_directory(config.RESUME_DIR, student["resume_filename"])


# --- Init ---

with app.app_context():
    models.init_db()
    models.seed_faculty()


if __name__ == "__main__":
    app.run(debug=True, port=5050)
