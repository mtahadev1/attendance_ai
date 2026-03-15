document.addEventListener("DOMContentLoaded", () => {
    
    // ==========================================
    // 1. صفحة تسجيل الدخول (Login Validation)
    // ==========================================
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const emailInput = document.getElementById("email");
            const emailError = document.getElementById("emailError");
            
            // التأكد من إيميل الجامعة
            if (!emailInput.value.endsWith("@sha.edu.eg")) {
                emailInput.style.borderColor = "var(--danger)";
                emailError.style.display = "block";
            } else {
                emailInput.style.borderColor = "var(--border)";
                emailError.style.display = "none";
                window.location.href = "/courses"; // الانتقال للوحة التحكم
            }
        });
    }

    // ==========================================
    // 2. صفحة المواد (Course Configuration)
    // ==========================================
    const goToFaceRec = document.getElementById("goToFaceRec");
    if (goToFaceRec) {
        goToFaceRec.addEventListener("click", () => {
            // حفظ بيانات المادة عشان نستخدمها في صفحة الكاميرا
            const year = document.getElementById("academicYear").value;
            const dept = document.getElementById("department").value;
            const course = document.getElementById("courseName").value;

            sessionStorage.setItem("courseContext", JSON.stringify({ year, dept, course }));
            window.location.href = "/dashboard";
        });
    }

    // ==========================================
    // 3. صفحة الكاميرا (Live Attendance Dashboard)
    // ==========================================
  const closeCameraBtn = document.getElementById("closeCameraBtn");
    const displayCourseName = document.getElementById("displayCourseName");
    if (displayCourseName) {
        
        // أ. جلب اسم المادة من الـ Session Storage وعرضه
        const contextData = sessionStorage.getItem("courseContext");
        let courseNameForBackend = "General";
        
        if (contextData) {
            const { year, dept, course } = JSON.parse(contextData);
            displayCourseName.innerText = course;
            document.getElementById("displayCourseDetails").innerText = `${year} – ${dept}`;
            courseNameForBackend = course; // هنبعت الاسم ده للباك إند
        }

        // ب. تعريف العناصر
        const openCameraBtn = document.getElementById("openCameraBtn");
        const startAttendanceBtn = document.getElementById("startAttendanceBtn");
        const videoFeed = document.getElementById("videoFeed");
        const placeholder = document.getElementById("cameraPlaceholder");
        const studentsList = document.getElementById("detectedStudentsList");
        
        let pollingInterval = null;

        // ج. دالة جلب الأسماء من قاعدة البيانات
      // ج. دالة جلب الأسماء من قاعدة البيانات
        async function fetchDetectedStudents() {
            try {
                const response = await fetch('/get_live_attendance');
                const data = await response.json();
                
                // لو في طلاب حاضرين
                if (data.attendance && data.attendance.length > 0) {
                    studentsList.innerHTML = ""; // مسح القائمة الحالية
                    
                    data.attendance.forEach(student => {
                        const li = document.createElement("li");
                        // التعديل هنا: إضافة student.id ليظهر بجوار الاسم بتنسيق أنيق
                        li.innerHTML = `
                            <span>✅ <strong>${student.name}</strong> <span style="color: var(--primary); font-size: 0.9em; margin-left: 5px;">(${student.id})</span></span> 
                            <span style="color: var(--text-muted); font-size: 0.85rem; font-weight: bold;">
                                ${student.time}
                            </span>
                        `;
                        studentsList.appendChild(li);
                    });
                }
            } catch (error) {
                console.error("Error fetching attendance:", error);
            }
        }

        // د. زر فتح الكاميرا (تهيئة فقط بدون تسجيل)
        if (openCameraBtn) {
            openCameraBtn.addEventListener("click", async () => {
                openCameraBtn.innerText = "Opening...";
                if (closeCameraBtn) closeCameraBtn.disabled = false;
                openCameraBtn.disabled = true;

                try {
                    // إرسال اسم المادة للباك إند أثناء فتح الكاميرا
                    await fetch(`/start_camera?course_name=${encodeURIComponent(courseNameForBackend)}`);
                    
                    placeholder.style.display = "none";
                    videoFeed.style.display = "block";
                    videoFeed.src = "/video_feed?t=" + new Date().getTime(); // إضافة وقت لمنع الكاش
                    
                    openCameraBtn.innerText = "Camera Active";
                    if (startAttendanceBtn) startAttendanceBtn.disabled = false; // تفعيل الزر التاني
                } catch (error) {
                    console.error("Camera Error:", error);
                    openCameraBtn.innerText = "Error. Try Again.";
                    openCameraBtn.disabled = false;
                }
            });
        }

      // هـ. زر بدء التسجيل بالذكاء الاصطناعي
        if (startAttendanceBtn) {
            startAttendanceBtn.addEventListener("click", async () => {
                startAttendanceBtn.innerText = "AI Scanning...";
                startAttendanceBtn.classList.add("btn-success");
                startAttendanceBtn.classList.add("pulse-glow");
                startAttendanceBtn.disabled = true;

                // إعطاء أمر للباك إند ببدء الحفظ في الداتا بيز
                await fetch('/start_model');
                
                // جلب الأسماء فوراً، ثم تكرار الجلب كل ثانيتين (Polling)
                fetchDetectedStudents();
                pollingInterval = setInterval(fetchDetectedStudents, 2000);
            });
        }

        // ==========================================
        // 👇 حط الكود بتاع الإغلاق هنا بالظبط 👇
        // ==========================================
        
        // و. زر إغلاق الكاميرا وإنهاء الجلسة
        if (closeCameraBtn) {
            closeCameraBtn.addEventListener("click", async () => {
                closeCameraBtn.innerText = "Closing...";
                closeCameraBtn.disabled = true;

                try {
                    // إرسال أمر للباك إند لإيقاف الكاميرا والموديل
                    await fetch('/stop_model');
                    
                    // إيقاف التحديث التلقائي للأسماء
                    if (pollingInterval) {
                        clearInterval(pollingInterval);
                        pollingInterval = null;
                    }

                    // إعادة ضبط الواجهة (إخفاء الفيديو وإظهار الأيقونة)
                    videoFeed.src = "";
                    videoFeed.style.display = "none";
                    placeholder.style.display = "block";
                    
                    // إعادة ضبط الأزرار لحالتها الأصلية
                    openCameraBtn.innerText = "1️⃣ Open Camera";
                    openCameraBtn.disabled = false;
                    
                    if (startAttendanceBtn) {
                        startAttendanceBtn.innerText = "2️⃣ Start Attendance";
                        startAttendanceBtn.disabled = true;
                        startAttendanceBtn.classList.remove("btn-success", "pulse-glow");
                        startAttendanceBtn.classList.add("btn-primary");
                    }
                    
                    closeCameraBtn.innerText = "🛑 Close Camera";
                    closeCameraBtn.disabled = true;

                } catch (error) {
                    console.error("Error closing camera:", error);
                    closeCameraBtn.innerText = "Error. Try Again.";
                    closeCameraBtn.disabled = false;
                }
            });
        }
        
    } // دي قفلة الـ if (displayCourseName)
}); // دي قفلة الـ DOMContentLoaded بتاعت الملف كله

// ز. زر تحميل تقرير الاكسل
        const downloadBtn = document.getElementById("downloadReportBtn");
        if (downloadBtn) {
            downloadBtn.addEventListener("click", () => {
                const contextData = sessionStorage.getItem("courseContext");
                let courseName = "General";
                if (contextData) {
                    courseName = JSON.parse(contextData).course;
                }
                // فتح رابط التحميل في صفحة جديدة لبدء التحميل
                window.location.href = `/export_report?course_name=${encodeURIComponent(courseName)}`;
            });
        }
        let myChart = null;

async function updateAnalytics() {
    const contextData = sessionStorage.getItem("courseContext");
    let courseName = contextData ? JSON.parse(contextData).course : "General";

    const res = await fetch(`/get_analytics?course_name=${encodeURIComponent(courseName)}`);
    const data = await res.json();

    if (data.error) return;

    // تحديث الأرقام في الكروت
    document.getElementById("totalStudentsCount").innerText = data.total_students;
    document.getElementById("attendanceRate").innerText = data.attendance_rate + "%";
    document.getElementById("todayPresence").innerText = data.attendance_today;

    // رسم أو تحديث التشارت
    const ctx = document.getElementById('attendanceChart').getContext('2d');
    
    if (myChart) myChart.destroy(); // مسح التشارت القديم قبل الرسم الجديد

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.chart_data.labels,
            datasets: [{
                label: 'Students Present',
                data: data.chart_data.values,
                borderColor: '#4f46e5',
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { display: false } },
                x: { grid: { display: false } }
            }
        }
    });
}

// تشغيل التحديث مع بداية الصفحة وكل ما يحصل حضور جديد
updateAnalytics();
setInterval(updateAnalytics, 10000); // تحديث الإحصائيات كل 10 ثوانٍ