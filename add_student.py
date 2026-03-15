import cv2
import pickle
import sqlite3
import numpy as np
from insightface.app import FaceAnalysis

# Initialize the Model
app = FaceAnalysis()
# Use ctx_id=-1 for CPU if you don't have an NVIDIA GPU
app.prepare(ctx_id=-1) 

def register_student():
    print("--- New Student Registration System ---")
    s_id = input("Enter Student ID (e.g., 2024001): ")
    full_name = input("Enter Full Name: ")

    # Open the camera for face capture
    cap = cv2.VideoCapture(0)
    print("Please look at the camera and smile... (Press [Space] to Capture)")

    while True:
        ret, frame = cap.read()
        if not ret: 
            print("Failed to grab frame from camera.")
            break
        
        # Display instructions on the window
        cv2.putText(frame, "Press SPACE to Capture", (10, 30), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        cv2.imshow('Registration - Press Space to Capture', frame)
        
        key = cv2.waitKey(1)
        if key % 256 == 32: # Space key pressed
            faces = app.get(frame)
            if len(faces) == 0:
                print("⚠️ No face detected! Please try again.")
                continue
            
            # Extract Face Embedding
            embedding = faces[0].embedding
            embedding_blob = pickle.dumps(embedding)

            # Save data to database
            try:
                conn = sqlite3.connect('students.db')
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO students (student_id, full_name, face_embedding)
                    VALUES (?, ?, ?)
                ''', (s_id, full_name, embedding_blob))
                conn.commit()
                conn.close()
                print(f"✅ Success: Student '{full_name}' has been registered!")
            except sqlite3.IntegrityError:
                print(f"❌ Error: Student ID '{s_id}' already exists in the database.")
            except Exception as e:
                print(f"❌ Error: {e}")
            
            break
        elif key % 256 == 27: # ESC key pressed
            print("Registration cancelled.")
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    register_student()