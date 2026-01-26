import re
import sys

def audit_structural_divs(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Step 1: Remove comments but preserve line breaks
    def preserve_lines(match):
        return '\n' * match.group(0).count('\n') + ' ' * len(match.group(0).replace('\n', ''))

    content = re.sub(r'/\*.*?\*/', preserve_lines, content, flags=re.DOTALL)
    content = re.sub(r'//.*', lambda m: ' ' * len(m.group()), content)

    # Step 2: Mask strings to avoid false positives in content or attributes
    def mask_string(match):
        s = match.group(0)
        return s[0] + ' ' * (len(s) - 2) + s[-1]
    
    content = re.sub(r'("(?:\\.|[^"\\])*")|(\'(?:\\.|[^\'\\])*\')|(`(?:\\.|[^`\\])*`)', mask_string, content)

    # Step 3: Find all div-related tags
    # regex for <div or </div. The capture group includes the content up to the closing >
    div_pattern = re.compile(r'<(/?div(?!\w)[^>]*)>', re.IGNORECASE | re.DOTALL)
    
    matches = list(div_pattern.finditer(content))
    
    depth = 0
    print(f"{'Line':<5} | {'Type':<10} | {'Depth':<5} | {'Snippet'}")
    print("-" * 100)
    
    for match in matches:
        tag_inner = match.group(1) # e.g. "div className='...'" or "/div" or "div /"
        start_pos = match.start()
        line_no = content.count('\n', 0, start_pos) + 1
        
        is_close = tag_inner.startswith('/')
        is_self_closing = tag_inner.strip().endswith('/')
        
        snippet = tag_inner.replace('\n', ' ').strip()[:70]
        
        if is_self_closing:
            type_str = "SELF"
            # Depth doesn't change
        elif is_close:
            type_str = "CLOSE"
            depth -= 1
        else:
            type_str = "OPEN"
            depth += 1
            
        print(f"{line_no:<5} | {type_str:<10} | {depth:<5} | {snippet}")

    print("-" * 100)
    print(f"Final Depth: {depth}")

if __name__ == "__main__":
    audit_structural_divs(sys.argv[1])
