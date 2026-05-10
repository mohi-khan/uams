UAMS SaaS Requirement Document (MVP)
1. Overview
The University Academic Management System (UAMS) is a multi-tenant SaaS platform designed to manage academic activities including assignments, quizzes, grading, and student performance tracking.
2. Objectives
- Digitize academic workflows
- Improve communication between students and teachers
- Provide centralized academic data management
- Enable scalable SaaS model for multiple universities
3. User Roles
- Student
- Teacher
- Dean / HOD
- Admin / Registrar
- Super Admin
4. Functional Requirements
Student:
- View assignments
- Submit assignments
- Attempt quizzes
- View results
- Download transcripts

Teacher:
- Create assignments
- Review submissions
- Assign marks and feedback
- Create quizzes
- Upload materials

Admin:
- Manage courses and sections
- Enroll students
- Manage academic structure ( Test Type, Grading percentage etc.)

Dean:
- Monitor performance
- Approve results (optional)
5. Core Modules
- Authentication & User Management
- Academic Structure Management
- Assignment Management
- Quiz Management
- Result Management
- Reporting & Transcripts
6. Workflows
Assignment Flow:
Teacher creates assignment → Student submits → Teacher evaluates → Result published

Quiz Flow:
Teacher creates quiz → Student attempts → Auto grading → Result

Result Flow:
Marks aggregation → GPA calculation → Result publication
7. Non-Functional Requirements
- System must be scalable
- Secure authentication and authorization
- Responsive UI (mobile-friendly)
- High availability
- Fast performance
8. MVP Scope
Must Have:
- Authentication & roles
- Assignment system
- Basic quiz system
- Result viewing

Optional:
- Transcript download
- Notifications
9. Future Enhancements
- AI-based grading
- Advanced analytics
- Mobile application
- Multi-language support