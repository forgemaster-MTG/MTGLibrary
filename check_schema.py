import os
import json
import psycopg2
from urllib.parse import urlparse

def get_db_info():
    # Attempt to find database URL from .env files
    db_url = None
    for env_file in ['.env.development', '.env', '.env.production']:
        if os.path.exists(env_file):
            with open(env_file, 'r') as f:
                for line in f:
                    if line.startswith('DATABASE_URL='):
                        db_url = line.split('=', 1)[1].strip().strip('"').strip("'")
                        break
        if db_url:
            break
    
    if not db_url:
        print("DATABASE_URL not found in .env files")
        return

    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        """)
        columns = cur.fetchall()
        
        print(json.dumps({c[0]: c[1] for c in columns}, indent=2))
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error connecting to database: {e}")

if __name__ == "__main__":
    get_db_info()
