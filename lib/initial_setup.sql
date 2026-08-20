-- ====================================================================
-- SUPABASE INITIAL SETUP: CREATE ALL DATABASE TABLES & SCHEMA
-- ====================================================================
-- Instructions:
--   1. Create a brand new project in your Supabase Dashboard.
--   2. Copy this entire script.
--   3. Go to "SQL Editor" -> "New Query", paste this code, and click "Run".
--   4. Update your .env.local and Vercel environment variables with the
--      new project's URL, Anon Key, and Service Role Key.
-- ====================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create public.classes first (referenced by profiles)
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    teacher_id UUID, -- will add reference constraint after profiles is created
    subject_name TEXT,
    lecture_name TEXT,
    class_date DATE,
    start_time TIME,
    end_time TIME,
    room TEXT,
    semester INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create public.profiles table (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    status TEXT,
    approved BOOLEAN,
    is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    subject_id UUID,
    drive_folder_id TEXT,
    email TEXT,
    google_refresh_token TEXT,
    birthday DATE,
    more_detail TEXT,
    semester INTEGER
);

-- Add teacher_id constraint to public.classes referencing public.profiles
ALTER TABLE public.classes 
    ADD CONSTRAINT fk_classes_teacher 
    FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. Create public.students table
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    name TEXT,
    email TEXT,
    birthday DATE,
    more_detail TEXT,
    semester INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create public.subjects table
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    room TEXT,
    semester INTEGER,
    start_date DATE,
    class_start_time TIME,
    class_end_time TIME,
    lecturer_names TEXT[] DEFAULT '{}'
);

-- 5. Create public.student_classes table
CREATE TABLE IF NOT EXISTS public.student_classes (
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    PRIMARY KEY (student_id, subject_id)
);

-- 6. Create public.attendance table
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    week INTEGER,
    status TEXT NOT NULL, -- 'present', 'absent', 'late'
    check_in_time TIMESTAMPTZ,
    hidden_from_student BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Create public.materials table
CREATE TABLE IF NOT EXISTS public.materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT,
    file_name TEXT,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Create public.assignments table
CREATE TABLE IF NOT EXISTS public.assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    deadline TIMESTAMPTZ NOT NULL,
    allow_late BOOLEAN DEFAULT false,
    file_url TEXT,
    file_id TEXT,
    folder_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Create public.submissions table
CREATE TABLE IF NOT EXISTS public.submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    assignment_name TEXT,
    drive_file_id TEXT,
    drive_link TEXT,
    file_name TEXT,
    submitted_at TIMESTAMPTZ DEFAULT now(),
    file_urls TEXT[]
);

-- 10. Create public.notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    link TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Create public.push_subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    subscription JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 1. Profiles policies
CREATE POLICY "Public profile select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Profile self update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Profile system insert" ON public.profiles FOR INSERT WITH CHECK (true);

-- 2. Classes policies
CREATE POLICY "Allow select on classes for authenticated users" ON public.classes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow insert on classes for admins and teachers" ON public.classes FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'teacher'))
);
CREATE POLICY "Allow update on classes for admins and teachers" ON public.classes FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'teacher'))
) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'teacher'))
);
CREATE POLICY "Allow delete on classes for admins" ON public.classes FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- 3. Subjects policies
CREATE POLICY "Allow select on subjects for authenticated users" ON public.subjects FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow insert on subjects for admins and teachers" ON public.subjects FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'teacher'))
);
CREATE POLICY "Allow update on subjects for admins and teachers" ON public.subjects FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'teacher'))
) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'teacher'))
);
CREATE POLICY "Allow delete on subjects for admins" ON public.subjects FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- 4. Students policies
CREATE POLICY "Allow select on students for authenticated users" ON public.students FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow insert on students" ON public.students FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update/delete on students for self or admin" ON public.students FOR ALL USING (auth.uid() = id OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- 5. Student classes policies
CREATE POLICY "Allow select on student_classes for authenticated users" ON public.student_classes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow insert/delete on student_classes for admins and teachers" ON public.student_classes FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'teacher'))
);

-- 6. Attendance policies
CREATE POLICY "Students can view their own attendance" ON public.attendance FOR SELECT USING (auth.uid() = student_id AND NOT hidden_from_student);
CREATE POLICY "Teachers/admins can manage attendance" ON public.attendance FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'teacher'))
);

-- 7. Materials policies
CREATE POLICY "Allow select on materials for authenticated users" ON public.materials FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow insert/update/delete on materials for admins and teachers" ON public.materials FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'teacher'))
);

-- 8. Assignments policies
CREATE POLICY "Allow select on assignments for authenticated users" ON public.assignments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow insert/update/delete on assignments for admins and teachers" ON public.assignments FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'teacher'))
);

-- 9. Submissions policies
CREATE POLICY "Students can manage their own submissions" ON public.submissions FOR ALL USING (auth.uid() = student_id);
CREATE POLICY "Teachers/admins can view and manage submissions" ON public.submissions FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'teacher'))
);

-- 10. Notifications policies
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Anyone can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own notifications" ON public.notifications FOR DELETE USING (auth.uid() = user_id);

-- 11. Push subscriptions policies (Bypassed via Service Role, but enabled RLS defensively)
-- No public policies needed as subscription API routes run via service_role context.

-- ====================================================================
-- SCHEMATIC PERMISSIONS & REPLICATION
-- ====================================================================

-- Grant public schema privileges to standard Supabase roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role, authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role, authenticated, anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, service_role, authenticated, anon;

-- Configure Replication for Real-time Notifications
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
              AND schemaname = 'public' 
              AND tablename = 'notifications'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
        END IF;
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
