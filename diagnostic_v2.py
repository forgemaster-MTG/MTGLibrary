
import sys
import re

def count_tokens(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    counts = {
        '{': content.count('{'),
        '}': content.count('}'),
        '(': content.count('('),
        ')': content.count(')'),
        'div_open': len(re.findall(r'<div', content)),
        'div_close': len(re.findall(r'</\s*div\s*>', content)),
        'button_open': len(re.findall(r'<button', content)),
        'button_close': len(re.findall(r'</\s*button\s*>', content))
    }
    
    for token, count in counts.items():
        print(f"{token}: {count}")

if __name__ == "__main__":
    count_tokens(sys.argv[1])
