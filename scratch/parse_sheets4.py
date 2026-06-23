import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open("d:/AntiBaseD/MarkFlow/scratch/initial_data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# Let's search inside data recursively for any string that matches potential sheet names.
# Common structures in google sheets flag data:
# data.get('docs-initial-data') or similar.
# Let's print the top level keys.
print("Top-level keys in initial_data.json:")
for k, v in data.items():
    v_str = str(v)
    print(f"- {k}: type={type(v)}, len={len(v_str) if v_str else 0}")

# Let's write a recursive function to find lists/dicts containing words like "MarkFlow", "스택", or any sheet name.
found_sheets = []
def search(obj, path=""):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in ['title', 'name', 'sheetName', 'label']:
                print(f"Found property {path}.{k} = {v}")
            search(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for idx, item in enumerate(obj):
            search(item, f"{path}[{idx}]")
    elif isinstance(obj, str):
        if "스택" in obj or "기술" in obj or "MarkFlow" in obj:
            if len(obj) < 100: # sheet titles are usually short
                print(f"Found string at {path}: {obj}")

search(data)
