
import os
import re

def migrate_indigo_to_primary(directory):
    # Regex to catch typical tailwind class patterns
    # Matches: text-indigo-400, bg-indigo-600, border-indigo-500, ring-indigo-500, shadow-indigo-500, etc.
    # Also handles hover:, active:, focus:, etc. prefixes
    pattern = re.compile(r'((?:[\w-]*:)?(?:bg|text|border|ring|shadow|from|to|via)-)indigo-')
    
    files_modified = []
    
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(('.jsx', '.js', '.css')):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    new_content = pattern.sub(r'\1primary-', content)
                    
                    if new_content != content:
                        with open(filepath, 'w', encoding='utf-8') as f:
                            f.write(new_content)
                        files_modified.append(filepath)
                        print(f"Migrated: {filepath}")
                except Exception as e:
                    print(f"Error processing {filepath}: {e}")
    
    print(f"\nTotal files modified: {len(files_modified)}")

if __name__ == "__main__":
    migrate_indigo_to_primary('c:/Users/gidgi/Documents/github/MTGLibrary/src')
