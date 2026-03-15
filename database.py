import sqlite3

def init_db():
    conn = sqlite3.connect('students.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT UNIQUE,
            full_name TEXT,
                   phone_number TEXT,
            face_embedding BLOB
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT,
            student_name TEXT,
            subject TEXT,
            date TEXT,
            check_in TEXT,
            check_out TEXT,
            UNIQUE(student_id, subject, date)
        )
    ''')
    conn.commit()
    conn.close()
    print("Database Created Successfully")

if __name__ == "__main__":
    init_db()