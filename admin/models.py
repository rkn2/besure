import sqlite3
import os
import secrets
from datetime import datetime, timezone

import config


def get_db():
    os.makedirs(os.path.dirname(config.DB_PATH), exist_ok=True)
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS faculty (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT,
            research_summary TEXT
        );

        CREATE TABLE IF NOT EXISTS faculty_options (
            faculty_id INTEGER NOT NULL,
            option_name TEXT NOT NULL CHECK(option_name IN ('structures', 'mechanical', 'lighting', 'construction')),
            PRIMARY KEY (faculty_id, option_name),
            FOREIGN KEY (faculty_id) REFERENCES faculty(id)
        );

        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            graduation_year TEXT,
            us_citizen_or_resident TEXT,
            major TEXT,
            interest_structures TEXT CHECK(interest_structures IN ('High interest', 'Moderate interest', 'Low interest', 'Not at all')),
            interest_mechanical TEXT CHECK(interest_mechanical IN ('High interest', 'Moderate interest', 'Low interest', 'Not at all')),
            interest_lighting TEXT CHECK(interest_lighting IN ('High interest', 'Moderate interest', 'Low interest', 'Not at all')),
            interest_construction TEXT CHECK(interest_construction IN ('High interest', 'Moderate interest', 'Low interest', 'Not at all')),
            additional_interests TEXT,
            faculty_preference TEXT,
            resume_filename TEXT,
            semester TEXT NOT NULL,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS cohort_pages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT NOT NULL UNIQUE,
            option_name TEXT,
            faculty_id INTEGER,
            semester TEXT NOT NULL,
            page_type TEXT NOT NULL CHECK(page_type IN ('option', 'faculty')),
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (faculty_id) REFERENCES faculty(id)
        );

        CREATE TABLE IF NOT EXISTS cohort_students (
            cohort_id INTEGER NOT NULL,
            student_id INTEGER NOT NULL,
            PRIMARY KEY (cohort_id, student_id),
            FOREIGN KEY (cohort_id) REFERENCES cohort_pages(id),
            FOREIGN KEY (student_id) REFERENCES students(id)
        );

        CREATE TABLE IF NOT EXISTS placements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            faculty_id INTEGER NOT NULL,
            phd_postdoc_adviser TEXT,
            status TEXT NOT NULL DEFAULT 'emailed' CHECK(status IN ('emailed', 'confirmed_faculty', 'confirmed_student')),
            fall_funding_source TEXT,
            fall_funding_io TEXT,
            spring_funding_source TEXT,
            spring_funding_io TEXT,
            summer_funding_source TEXT,
            summer_funding_io TEXT,
            notes TEXT,
            started_at TEXT,
            ended_at TEXT,
            presented INTEGER DEFAULT 0,
            nsf_grfp_applicant INTEGER DEFAULT 0,
            conference_grant TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (student_id) REFERENCES students(id),
            FOREIGN KEY (faculty_id) REFERENCES faculty(id)
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    """)
    conn.commit()
    conn.close()


FACULTY_SEED = [
    {"name": "John Messner", "options": ["construction"],
     "research": "Virtual Reality, Digital Twins, immersive construction technology"},
    {"name": "Rob Leicht", "options": ["construction"],
     "research": "Robotic construction, integrated project delivery, automation"},
    {"name": "Yuqing Hu", "options": ["mechanical", "construction"],
     "research": "Smart buildings, human-building interaction, intelligent controls"},
    {"name": "Greg Pavlak", "options": ["mechanical"],
     "research": "Building energy modeling, HVAC controls, energy optimization"},
    {"name": "Wangda Zuo", "options": ["mechanical"],
     "research": "Building and community-scale energy modeling, Modelica, sustainable cities"},
    {"name": "Donghyun Rim", "options": ["mechanical"],
     "research": "Indoor air quality, ventilation, human exposure to pollutants"},
    {"name": "Julian Wang", "options": ["lighting"],
     "research": "High-performance building envelopes, smart facades, BIPV, daylighting"},
    {"name": "Dorukalp Durmus", "options": ["lighting"],
     "research": "Lighting science, human factors, color science, health impacts of lighting"},
    {"name": "Nathan Brown", "options": ["structures"],
     "research": "Structural optimization, digital fabrication, generative design"},
    {"name": "Rebecca Napolitano", "options": ["structures"],
     "research": "Historic structures, digital preservation, laser scanning, conservation"},
    {"name": "Juan Pablo Gevaudan", "options": ["construction"],
     "research": "Sustainable concretes, alternative cement materials, construction materials"},
]


def seed_faculty():
    conn = get_db()
    existing = conn.execute("SELECT COUNT(*) as c FROM faculty").fetchone()["c"]
    if existing > 0:
        conn.close()
        return
    for f in FACULTY_SEED:
        cursor = conn.execute(
            "INSERT INTO faculty (name, research_summary) VALUES (?, ?)",
            (f["name"], f["research"]),
        )
        fid = cursor.lastrowid
        for opt in f["options"]:
            conn.execute(
                "INSERT INTO faculty_options (faculty_id, option_name) VALUES (?, ?)",
                (fid, opt),
            )
    conn.commit()
    conn.close()


def get_active_semester(conn):
    row = conn.execute(
        "SELECT value FROM settings WHERE key = 'active_semester'"
    ).fetchone()
    if row:
        return row["value"]
    now = datetime.now(timezone.utc)
    month = now.month
    year = now.year
    if month >= 8:
        return f"Fall {year}"
    elif month >= 5:
        return f"Summer {year}"
    else:
        return f"Spring {year}"


def set_active_semester(conn, semester):
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('active_semester', ?)",
        (semester,),
    )
    conn.commit()


def generate_slug():
    return secrets.token_urlsafe(24)
