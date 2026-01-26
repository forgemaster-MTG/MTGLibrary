import re
import sys

def audit_jsx(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    depth = 0
    print(f"{'Line':<5} | {'Depth':<5} | {'Content'}")
    print("-" * 80)
    
    for i, line in enumerate(lines):
        # Ignore comments
        clean_line = re.sub(r'{\s*/\*.*?\*/\s*}', '', line)
        clean_line = re.sub(r'//.*', '', clean_line)
        
        opens = len(re.findall(r'<div(?!\w)', clean_line))
        closes = len(re.findall(r'</div', clean_line))
        # Self-closing divs like <div />
        self_closes = len(re.findall(r'<div[^>]*/>', clean_line))
        
        prev_depth = depth
        depth += (opens - closes - self_closes)
        
        if opens != 0 or closes != 0:
            print(f"{i+1:5} | {prev_depth:>2} -> {depth:<2} | {line.strip()[:60]}")

    print("-" * 80)
    print(f"Final Depth: {depth}")

if __name__ == "__main__":
    audit_jsx(sys.argv[1])
