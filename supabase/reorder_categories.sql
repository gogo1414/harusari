-- Drop function if exists
DROP FUNCTION IF EXISTS reorder_categories(json);

-- Create function
CREATE OR REPLACE FUNCTION reorder_categories(items json)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the creator (usually admin), but we check auth.uid() inside
AS $$
DECLARE
  item json;
BEGIN
  -- Iterate through the JSON array
  FOR item IN SELECT * FROM json_array_elements(items)
  LOOP
    -- Update the category only if it belongs to the authenticated user
    UPDATE categories
    SET 
      sort_order = (item->>'sort_order')::int,
      updated_at = now()
    WHERE 
      category_id = (item->>'category_id')::uuid 
      AND user_id = auth.uid(); -- Critical security check
  END LOOP;
END;
$$;
