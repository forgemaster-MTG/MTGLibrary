-- 1. Identify duplicates
SELECT firestore_id, COUNT(*) 
FROM users 
GROUP BY firestore_id 
HAVING COUNT(*) > 1;

-- 2. Cleanup Strategy: Keep the one with the most data or the lowest ID
-- Delete duplicates of Kyrlwz6G6NWICCEPYbXtFfyLzWI3 keeping the lowest ID
DELETE FROM users 
WHERE firestore_id = 'Kyrlwz6G6NWICCEPYbXtFfyLzWI3' 
AND id NOT IN (
    SELECT MIN(id) 
    FROM users 
    WHERE firestore_id = 'Kyrlwz6G6NWICCEPYbXtFfyLzWI3'
);

-- Delete any other duplicates if they exist
DELETE FROM users 
WHERE id NOT IN (
    SELECT MIN(id) 
    FROM users 
    GROUP BY firestore_id
);

-- 3. Verify specific ID duplicate mentioned in logs (id=2)
-- If id=2 is duplicated, one must be changed or removed.
-- Usually this happens if a sequence got out of sync.
SELECT * FROM users WHERE id = 2;
