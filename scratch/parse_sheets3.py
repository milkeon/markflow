import json
import re
import sys

# Set terminal stdout to UTF-8
sys.stdout.reconfigure(encoding='utf-8')

with open("d:/AntiBaseD/MarkFlow/scratch/sheet_html.txt", "r", encoding="utf-8") as f:
    html = f.read()

# Look for _docs_flag_initialData
match = re.search(r'_docs_flag_initialData\s*=\s*(\{.*?\});', html)
if match:
    try:
        data = json.loads(match.group(1))
        # Let's print the keys to see what's in there
        print("Found initial data keys:", list(data.keys()))
        
        # Typically, in Google Sheets, the sheets metadata might be inside some sub-structure.
        # Let's print sections that might contain sheet metadata
        # We can dump this to a json file to inspect it
        with open("d:/AntiBaseD/MarkFlow/scratch/initial_data.json", "w", encoding="utf-8") as out:
            json.dump(data, out, ensure_ascii=False, indent=2)
        print("Saved initial data to initial_data.json")
    except Exception as e:
        print("JSON parse error:", e)
else:
    print("_docs_flag_initialData not found.")

# Let's search for sheet list in another common JS variable: bootstrapData or wgbd
match_bootstrap = re.search(r'bootstrapData\s*=\s*(\{.*?\});', html)
if match_bootstrap:
    print("Found bootstrapData!")
    
# Let's search for JSON-like structures that list sheets.
# Usually, Google Sheets has lists of sheet metadata: e.g. "sheetId" or "sheetName"
# Let's search for any occurrence of 'sheetId' or 'sheetName' in the HTML text (case insensitive)
sheet_ids = re.findall(r'"sheetId"\s*:\s*(\d+)', html)
print("Found sheetIds:", sheet_ids)
