-- Meal options are no longer tagged as vegetarian / child meal. Drop the
-- flags so the schema matches the code.
ALTER TABLE meal_option DROP COLUMN is_child_meal;
ALTER TABLE meal_option DROP COLUMN is_vegetarian;
