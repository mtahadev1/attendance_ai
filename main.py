from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, HTMLResponse, JSONResponse, FileResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from face_engine import FaceRecognitionEngine
import database
import sqlite3
import cv2
import uvicorn
import os
import pandas as pd
from datetime import datetime
from pydantic import BaseModel

# 1. تعريف التطبيق (هذا السطر هو حل مشكلة NameError)
app = FastAPI()

# تهيئة قاعدة البيانات
try:
    database.init_db()
except Exception as e:
    print(f"Database init error: {e}")

# ربط المجلدات الثابتة والقوالب
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# تهيئة محرك الذكاء الاصطناعي
engine = FaceRecognitionEngine(subject="General")
is_recording_attendance = False

# --- مسارات صفحات الـ HTML ---

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/login", response_class=HTMLResponse)
async def login(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@app.get("/courses", response_class=HTMLResponse)
async def courses(request: Request):
    return templates.TemplateResponse("courses.html", {"request": request})

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    return templates.TemplateResponse("dashboard.html", {"request": request})
@app.get("/about", response_class=HTMLResponse)
async def about(request: Request):
    return templates.TemplateResponse("about.html", {"request": request})
# --- مسارات التحكم والتحليلات ---

@app.get("/start_camera")
def start_camera(course_name: str = "General"):
    global is_recording_attendance
    engine.subject = course_name
    is_recording_attendance = False
    engine.start()
    return JSONResponse(content={"status": "Camera Opened", "course": engine.subject})

@app.get("/start_model")
def start_model():
    global is_recording_attendance
    is_recording_attendance = True
    return JSONResponse(content={"status": "Model Started"})

@app.get("/stop_model")
def stop_model():
    global is_recording_attendance
    is_recording_attendance = False
    engine.stop()
    return JSONResponse(content={"status": "Model Stopped"})

@app.get("/get_live_attendance")
def get_live_attendance():
    if not is_recording_attendance:
        return {"attendance": []}
    try:
        conn = sqlite3.connect('students.db')
        cursor = conn.cursor()
        today = datetime.now().strftime("%Y-%m-%d")
        cursor.execute('''
            SELECT student_id, student_name, check_in 
            FROM attendance 
            WHERE subject = ? AND date = ?
            ORDER BY check_in DESC
        ''', (engine.subject, today))
        rows = cursor.fetchall()
        conn.close()
        return {"attendance": [{"id": r[0], "name": r[1], "time": r[2]} for r in rows]}
    except Exception as e:
        return {"attendance": [], "error": str(e)}

@app.get("/export_report")
def export_report(course_name: str = "General"):
    try:
        conn = sqlite3.connect('students.db')
        query = "SELECT student_id, student_name, subject, date, check_in FROM attendance WHERE subject = ?"
        df = pd.read_sql_query(query, conn, params=(course_name,))
        conn.close()
        if df.empty:
            return JSONResponse(status_code=400, content={"error": "No data to export"})
        
        file_path = f"Attendance_{course_name}.xlsx"
        df.to_excel(file_path, index=False)
        return FileResponse(path=file_path, filename=file_path)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/get_analytics")
def get_analytics(course_name: str = "General"):
    try:
        conn = sqlite3.connect('students.db')
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM students")
        total_students = cursor.fetchone()[0]
        today = datetime.now().strftime("%Y-%m-%d")
        cursor.execute("SELECT COUNT(*) FROM attendance WHERE subject = ? AND date = ?", (course_name, today))
        attendance_today = cursor.fetchone()[0]
        
        cursor.execute('''
            SELECT date, COUNT(*) FROM attendance 
            WHERE subject = ? 
            GROUP BY date ORDER BY date DESC LIMIT 7
        ''', (course_name,))
        trend_data = cursor.fetchall()
        conn.close()

        return {
            "total_students": total_students,
            "attendance_today": attendance_today,
            "attendance_rate": round((attendance_today / total_students * 100), 1) if total_students > 0 else 0,
            "chart_data": {"labels": [r[0] for r in reversed(trend_data)], "values": [r[1] for r in reversed(trend_data)]}
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/video_feed")
def video_feed():
    def gen_frames():
        while True:
            if not engine.running: break
            frame = engine.get_frame()
            if frame is None: continue
            ret, buffer = cv2.imencode('.jpg', frame)
            yield (b'--frame\r\n' b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
    return StreamingResponse(gen_frames(), media_type="multipart/x-mixed-replace; boundary=frame")

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
    import requests # ستحتاج لتثبيت مكتبة requests

def send_whatsapp_notification(phone, student_name, subject):
    """إرسال رسالة واتساب للطالب فور تحضيره"""
    instance_id = "YOUR_INSTANCE_ID" # تحصل عليه من UltraMsg
    token = "YOUR_TOKEN" # تحصل عليه من UltraMsg
    
    url = f"https://api.ultramsg.com/{instance_id}/messages/chat"
    
    message = f"أهلاً {student_name}! ✅\nتم تسجيل حضورك بنجاح في مادة: *{subject}*\nالتاريخ: {datetime.now().strftime('%Y-%m-%d %H:%M')}\nنتمنى لك يوماً سعيداً! 🎓"
    
    payload = {
        "token": token,
        "to": phone,
        "body": message
    }
    
    headers = {'content-type': 'application/x-www-form-urlencoded'}
    
    try:
        response = requests.post(url, data=payload, headers=headers)
        return response.json()
    except Exception as e:
        print(f"Error sending WhatsApp: {e}")
        