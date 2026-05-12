-- Allow registrations without a package (events that have no packages configured)
ALTER TABLE registrations ALTER COLUMN package_id DROP NOT NULL;
