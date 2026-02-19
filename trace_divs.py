
import sys
import re

def trace_divs(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    stack = []
    for i, line in enumerate(lines, 1):
        # Remove strings and comments to avoid false matches
        clean_line = re.sub(r'["\'].*?["\']', '', line)
        clean_line = re.sub(r'{\s*/\*.*?\*/\s*}', '', clean_line)
        
        opens = re.findall(r'<div', clean_line)
        closes = re.findall(r'</\s*div\s*>', clean_line)
        
        # Handle self-closing divs
        self_closing = re.findall(r'<div[^>]*/>', clean_line)
        
        for _ in range(len(opens) - len(self_closing)):
            stack.append(i)
        for _ in closes:
            if stack:
                stack.pop()
            else:
                print(f"Excess closing div at line {i}")
    
    if not stack:
        print("All divs balanced.")
    else:
        for line_num in stack:
            print(f"Unclosed div from line {line_num}")

if __name__ == "__main__":
    trace_divs(sys.argv[1])
