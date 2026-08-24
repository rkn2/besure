import re

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


def extract_faculty_names(preference_text, faculty_rows):
    """Match free-text faculty preference against known faculty last names.

    Returns:
        matched: list of faculty row dicts that matched
        unmatched_names: list of name fragments that didn't match anyone
    """
    if not preference_text or not preference_text.strip():
        return [], []

    text = preference_text.lower().strip()
    matched = []
    faculty_tokens = []
    for f in faculty_rows:
        parts = f["name"].split()
        last = parts[-1].lower()
        faculty_tokens.append((last, f))
        if len(parts) > 2:
            faculty_tokens.append((" ".join(p.lower() for p in parts[:-1]), f))

    found_ids = set()
    for token, fac in faculty_tokens:
        if re.search(rf"\b{re.escape(token)}\b", text) and fac["id"] not in found_ids:
            matched.append(fac)
            found_ids.add(fac["id"])

    if not matched:
        cleaned = re.sub(r"[^a-z\s,/&]", "", text)
        cleaned = re.sub(
            r"\b(i have|i haven't|talked|talk|not yet|yes|no|"
            r"interested|work with|professor|dr|prof|would like|check out)\b",
            "", cleaned,
        )
        remaining = [
            w.strip() for w in re.split(r"[,/&]", cleaned) if w.strip()
        ]
        unmatched = [n for n in remaining if len(n) > 2]
        return [], unmatched

    return matched, []


def match_students(conn, semester):
    """Run matching for a semester. Returns structured results."""
    students = conn.execute(
        "SELECT * FROM students WHERE semester = ? ORDER BY applied_at",
        (semester,),
    ).fetchall()

    faculty_rows = conn.execute(
        "SELECT f.id, f.name, f.email, f.research_summary "
        "FROM faculty f ORDER BY f.name"
    ).fetchall()

    faculty_options = {}
    for row in conn.execute("SELECT faculty_id, option_name FROM faculty_options"):
        faculty_options.setdefault(row["faculty_id"], []).append(row["option_name"])

    option_cohorts = {opt: [] for opt in OPTION_COLUMNS}
    faculty_specific = {}
    unmatched_students = []
    unknown_faculty_refs = []

    for s in students:
        s_dict = dict(s)
        high_options = []
        for opt, col in OPTION_COLUMNS.items():
            if s[col] == "High interest":
                high_options.append(opt)
                option_cohorts[opt].append(s_dict)

        matched_fac, unmatched_names = extract_faculty_names(
            s["faculty_preference"], faculty_rows
        )
        for fac in matched_fac:
            faculty_specific.setdefault(fac["id"], {
                "faculty": dict(fac),
                "students": [],
            })
            faculty_specific[fac["id"]]["students"].append(s_dict)

        if unmatched_names:
            unknown_faculty_refs.append({
                "student": s_dict,
                "names": unmatched_names,
                "raw_text": s["faculty_preference"],
            })

        if not high_options and not matched_fac:
            unmatched_students.append(s_dict)

    return {
        "option_cohorts": option_cohorts,
        "faculty_specific": faculty_specific,
        "unmatched_students": unmatched_students,
        "unknown_faculty_refs": unknown_faculty_refs,
        "faculty_options": faculty_options,
        "faculty_rows": [dict(f) for f in faculty_rows],
    }
