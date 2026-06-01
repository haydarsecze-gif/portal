-- ====================================================================
-- MIGRATION: ADD DRIVE_FOLDER_ID TO PROFILES & NOTIFICATIONS SETUP
-- ====================================================================
-- Description:
--   This script adds the drive_folder_id column to public.profiles and 
--   creates the public.notifications table with Row-Level Security policies.
-- Instructions:
--   Copy this entire script, open the Supabase Dashboard, navigate to
--   "SQL Editor", click "New query", paste this code, and click "Run".
-- ====================================================================

-- 0. Add drive_folder_id and email columns to profiles table if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS drive_folder_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 1. Create the notifications table in the public schema if it doesn't exist
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

-- 1.1 Support dynamic link column addition for existing database instances
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link TEXT;


-- 2. Enable Row-Level Security (RLS)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies defensively to prevent duplicate errors
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;

-- 4. Create precise, secure Row-Level Security Policies

-- Select Policy: Users can only see notifications addressed to them, or global ones (null user_id)
CREATE POLICY "Users can view their own notifications" ON public.notifications
    FOR SELECT
    USING (auth.uid() = user_id OR user_id IS NULL);

-- Insert Policy: Anyone can insert notifications to allow cross-role alerts (e.g. students notifying lecturers, 
-- lecturers notifying students, unregistered lecturer signups notifying administrators)
CREATE POLICY "Anyone can insert notifications" ON public.notifications
    FOR INSERT
    WITH CHECK (true);

-- Update Policy: Users can only update their own notification read status
CREATE POLICY "Users can update their own notifications" ON public.notifications
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Delete Policy: Users can only delete their own notification records
CREATE POLICY "Users can delete their own notifications" ON public.notifications
    FOR DELETE
    USING (auth.uid() = user_id);

-- 5. Configure Replication for Real-time Notifications
-- Force replica identity to full so that realtime events publish complete data payloads
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Ensure the public.notifications table is registered in the supabase_realtime publication
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        -- Check if the table is not already in the publication before adding it
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

-- 6. Reload the database schema cache to apply immediately
NOTIFY pgrst, 'reload schema';

-- 7. Add google_refresh_token column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;
NOTIFY pgrst, 'reload schema';

-- 8. Register profiles table in the supabase_realtime publication for real-time deletes
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        -- Check if the table is not already in the publication before adding it
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
              AND schemaname = 'public' 
              AND tablename = 'profiles'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
        END IF;
    END IF;
END $$;
NOTIFY pgrst, 'reload schema';

-- 9. Add student profile details (birthday, more_detail, semester) to profiles and students tables
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS more_detail TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS semester INTEGER;

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS more_detail TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS semester INTEGER;

NOTIFY pgrst, 'reload schema';

