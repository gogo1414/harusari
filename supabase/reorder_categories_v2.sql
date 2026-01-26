-- Drop function if exists
DROP FUNCTION IF EXISTS reorder_categories(json);
DROP FUNCTION IF EXISTS reorder_categories(jsonb);

-- Create function with JSONB (better performance/compatibility)
CREATE OR REPLACE FUNCTION reorder_categories(items jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item jsonb;
BEGIN
  -- Iterate through the JSON array
  FOR item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    -- Update the category only if it belongs to the authenticated user
    UPDATE categories
    SET 
      sort_order = (item->>'sort_order')::int,
      updated_at = now()
    WHERE 
      category_id = (item->>'category_id')::uuid 
      AND user_id = auth.uid(); 
  END LOOP;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION reorder_categories(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION reorder_categories(jsonb) TO service_role;
