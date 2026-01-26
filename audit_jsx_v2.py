import re
import sys

def audit_jsx(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove strings and comments to avoid false positives
    content = re.sub(r'("(?:\\.|[^"\\])*")|(\'(?:\\.|[^\'\\])*\')|(`(?:\\.|[^`\\])*`)', '', content)
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
    content = re.sub(r'//.*', '', content)

    lines = content.split('\n')
    depth = 0
    
    print(f"{'Line':<5} | {'Depth':<5} | {'Delta':<5} | {'Content'}")
    print("-" * 80)
    
    for i, line in enumerate(lines):
        # We only care about <div> tags for this specific issue
        # Open tags: <div ... > (but not <div ... />)
        # Close tags: </div>
        
        # Simple count for now, but excluding self-closing
        opens = len(re.findall(r'<div(?!\w)[^>]*[^/]>', line))
        closes = len(re.findall(r'</div\s*>', line))
        
        prev_depth = depth
        delta = opens - closes
        depth += delta
        
        if delta != 0:
            print(f"{i+1:5} | {prev_depth:>2} -> {depth:<2} | {delta:>+2}  | {line.strip()[:60]}")

    print("-" * 80)
    print(f"Final Depth: {depth}")

if __name__ == "__main__":
    audit_jsx(sys.argv[1])
