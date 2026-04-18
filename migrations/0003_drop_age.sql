-- Age is no longer tracked anywhere in the app. Drop the column so the schema
-- matches the code.
ALTER TABLE guest DROP COLUMN age_group;
