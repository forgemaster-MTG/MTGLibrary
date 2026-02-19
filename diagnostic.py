
import sys

def count_tokens(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    counts = {
        '{': content.count('{'),
        '}': content.count('}'),
        '(': content.count('('),
        ')': content.count(')'),
        '<div': content.count('<div'),
        '</div>': content.count('</div>'),
        '<button': content.count('<button'),
        '</button>': content.count('</button>')
    }
    
    for token, count in counts.items():
        print(f"{token}: {count}")

if __name__ == "__main__":
    count_tokens(sys.argv[1])
