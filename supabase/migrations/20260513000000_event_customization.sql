-- Add form customisation columns to events
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS form_title        text,
  ADD COLUMN IF NOT EXISTS form_subtitle     text,
  ADD COLUMN IF NOT EXISTS registration_open boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS custom_fields     jsonb   NOT NULL DEFAULT '[]'::jsonb;

-- Add custom answer storage to registrations
ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS custom_answers    jsonb   NOT NULL DEFAULT '{}'::jsonb;
