import urllib.request
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')

url = "https://docs.google.com/spreadsheets/d/1Wk9TZWfd9MgCCAwN02JltZdVcKYDQN3ZHkZGAgLQqqU/export?format=xlsx"
xlsx_path = "d:/AntiBaseD/MarkFlow/scratch/markflow.xlsx"

req = urllib.request.Request(
    url, 
    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
)

try:
    print("Downloading xlsx...")
    with urllib.request.urlopen(req) as response:
        with open(xlsx_path, "wb") as f:
            f.write(response.read())
    print("Download completed.")
    
    # Let's inspect the sheets inside the xlsx file.
    # To do this without openpyxl (in case it is not installed), we can treat xlsx as a zip file.
    # xlsx is a zip file. xl/workbook.xml lists the sheets.
    import zipfile
    import xml.etree.ElementTree as ET
    
    with zipfile.ZipFile(xlsx_path, 'r') as zip_ref:
        # read xl/workbook.xml
        workbook_xml = zip_ref.read('xl/workbook.xml')
        root = ET.fromstring(workbook_xml)
        
        # Look for sheet tags
        # Namespace is usually http://schemas.openxmlformats.org/spreadsheetml/2006/main
        sheets = []
        for child in root.iter():
            if child.tag.endswith('sheet'):
                sheet_name = child.attrib.get('name')
                sheet_id = child.attrib.get('sheetId')
                # r:id might map to the relation
                rel_id = child.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
                sheets.append((sheet_name, sheet_id, rel_id))
        
        print("\nSheets found in the Excel workbook:")
        for idx, (name, s_id, r_id) in enumerate(sheets):
            print(f"{idx+1}. Name: {name}, Sheet ID: {s_id}, Rel ID: {r_id}")
            
except Exception as e:
    print("Error:", e)
