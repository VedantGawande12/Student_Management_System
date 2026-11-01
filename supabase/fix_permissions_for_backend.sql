-- =============================================================================
-- FIX SUPABASE PERMISSIONS & ROW-LEVEL SECURITY FOR CIT BACKEND ENGINE
-- =============================================================================
-- Run this script once in your Supabase Project:
-- Dashboard -> SQL Editor -> New Query -> Paste & Run
--
-- PURPOSE:
-- The application's backend server manages authentication internally (RBAC with
-- Dean/Admin, Coordinator, Faculty, and Club roles).
-- When connecting with the publishable/anon API key, PostgreSQL RLS blocks writes
-- with HTTP 401 / code 42501 ("new row violates row-level security policy").
--
-- This script grants necessary schema privileges and disables RLS on the application
-- tables so that both publishable keys (anon) and secret keys (service_role) can
-- perform database operations (sync, inserts, updates, queries) seamlessly.
-- =============================================================================

-- 1. Grant schema usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Grant permissions on all tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

-- 3. Grant permissions on all sequences
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 4. Set default privileges for any future tables/sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- 5. Disable Row Level Security on application tables to allow backend persistence
ALTER TABLE IF EXISTS public.institutes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.datasets DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.room_unavailability DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.faculty DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.faculty_unavailability DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.courses DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.session_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exams DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exam_courses DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exam_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.booking_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.booking_windows DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cancellations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scheduled_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.schedule_bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.session_overrides DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scheduled_exams DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scheduled_exam_rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.disruptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs DISABLE ROW LEVEL SECURITY;

-- Verification notification
DO $$
BEGIN
  RAISE NOTICE 'CIT Database permissions successfully configured for backend operation.';
END $$;

