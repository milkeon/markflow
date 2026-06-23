import re

with open("d:/AntiBaseD/MarkFlow/scratch/sheet_html.txt", "r", encoding="utf-8") as f:
    html = f.read()

# Let's search for korean characters in javascript objects or lists.
# Google Sheets often stores sheet names as strings in javascript arrays.
# e.g., ["sheet", "시트이름", ...]
# Let's extract all Korean words of length 2 or more, and check their context.
korean_words = set(re.findall(r'[\uac00-\ud7a3\w\s]{2,50}', html))

# Filter words that look like sheet names or titles
candidates = []
for word in korean_words:
    # check if word is surrounded by quotes, which is typical for JSON string
    if f'"{word}"' in html or f"'{word}'" in html:
        candidates.append(word)

print("Potential sheet titles or Korean strings in JSON:")
# Let's filter out non-korean or generic terms
korean_candidates = [c for c in candidates if re.search(r'[\uac00-\ud7a3]', c)]
for c in sorted(korean_candidates):
    # Print the word and a bit of context around it
    idx = html.find(f'"{c}"')
    if idx == -1:
        idx = html.find(f"'{c}'")
    context = html[max(0, idx-50):min(len(html), idx+len(c)+50)].replace('\n', ' ')
    print(f"- {c} | Context: ... {context} ...")
