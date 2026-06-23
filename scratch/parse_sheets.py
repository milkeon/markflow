import urllib.request
import re

url = "https://docs.google.com/spreadsheets/d/1Wk9TZWfd9MgCCAwN02JltZdVcKYDQN3ZHkZGAgLQqqU/edit?usp=sharing"
req = urllib.request.Request(
    url, 
    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
)

try:
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8')
        
        # 1. Look for sheet names in script tags (often in _docs_flag_initialData or similar bootstrap variables)
        # Typically Google Sheets has a JSON structure in the HTML containing sheet data.
        # Let's search for patterns like "gid" or "sheetName"
        print("Searching for sheet configurations...")
        
        # Look for sheet tab structures
        # In public sheets, tabs can sometimes be found in the footer area:
        # {"1": "Sheet1", "2": "Sheet2"} etc.
        # Or look for "gid" mapping.
        # Let's write the HTML to a temporary file for analysis or search via regex.
        with open("d:/AntiBaseD/MarkFlow/scratch/sheet_html.txt", "w", encoding="utf-8") as f:
            f.write(html)
            
        print("HTML saved to d:/AntiBaseD/MarkFlow/scratch/sheet_html.txt")
        
        # Let's find matches for: "gid":
        gids = re.findall(r'"gid"\s*:\s*"?(\d+)"?', html)
        print("Found gids:", list(set(gids)))
        
        # Let's find tab names. Google Sheets bootstrap data often contains something like:
        # [,"Sheet Name",,,,]
        # Let's find patterns like: "sheetName":"..." or similar in JS
        sheet_names = re.findall(r'"sheetName"\s*:\s*"([^"]+)"', html)
        print("Found sheet names by 'sheetName':", sheet_names)
        
        # Another pattern: {"gid":0,"title":"시트이름"...} or similar
        titles = re.findall(r'"title"\s*:\s*"([^"]+)"', html)
        print("Found titles:", list(set(titles))[:20]) # Limit output

except Exception as e:
    print("Error:", e)
