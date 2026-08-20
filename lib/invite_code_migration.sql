-- ====================================================================
-- MIGRATION: LECTURER PERSONAL INVITE CODES
-- ====================================================================
-- Description:
--   This script updates public.profiles to add personal invite codes for 
--   lecturers and links students to the lecturer whose code they used to register.
-- Instructions:
--   Copy this entire script, open the Supabase Dashboard, navigate to
--   "SQL Editor", click "New query", paste this code, and click "Run".
-- ====================================================================

-- 1. Add invite_code and registered_with_lecturer_id columns to profiles table if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS registered_with_lecturer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Create helper function to generate a random 7-character invite code (e.g. ABCD123)
CREATE OR REPLACE FUNCTION public.generate_random_invite_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    nums TEXT := '0123456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..4 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    FOR i IN 1..3 LOOP
        result := result || substr(nums, floor(random() * length(nums) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 3. Backfill existing teachers/lecturers with unique invite codes
DO $$
DECLARE
    teacher_record RECORD;
    new_code TEXT;
    code_exists BOOLEAN;
BEGIN
    FOR teacher_record IN SELECT id FROM public.profiles WHERE role = 'teacher' AND invite_code IS NULL LOOP
        LOOP
            new_code := public.generate_random_invite_code();
            SELECT EXISTS (SELECT 1 FROM public.profiles WHERE invite_code = new_code) INTO code_exists;
            IF NOT code_exists THEN
                UPDATE public.profiles SET invite_code = new_code WHERE id = teacher_record.id;
                EXIT;
            END IF;
        END LOOP;
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
