import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

export const supabase = createClient(
  "https://qxftevajwpgtfyhsarti.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4ZnRldmFqd3BndGZ5aHNhcnRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNzc5MzcsImV4cCI6MjA4Mzk1MzkzN30.shZ_Mkrpmz7sBD7ivsSnav5AefZJ_hlVWQkRv5qD5iU"
);
