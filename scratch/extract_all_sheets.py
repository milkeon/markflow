import zipfile
import xml.etree.ElementTree as ET
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')
xlsx_path = "d:/AntiBaseD/MarkFlow/scratch/markflow.xlsx"
out_dir = "d:/AntiBaseD/MarkFlow/scratch/extracted_sheets"
os.makedirs(out_dir, exist_ok=True)

try:
    with zipfile.ZipFile(xlsx_path, 'r') as zip_ref:
        # Load shared strings
        shared_strings = []
        if 'xl/sharedStrings.xml' in zip_ref.namelist():
            strings_xml = zip_ref.read('xl/sharedStrings.xml')
            strings_root = ET.fromstring(strings_xml)
            # Namespace for sharedStrings
            ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            for t in strings_root.findall('.//ns:t', ns):
                shared_strings.append(t.text if t.text else "")
        
        # Load sheets list
        workbook_xml = zip_ref.read('xl/workbook.xml')
        wb_root = ET.fromstring(workbook_xml)
        ns_wb = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        
        sheets_info = []
        for child in wb_root.iter():
            if child.tag.endswith('sheet'):
                name = child.attrib.get('name')
                sheet_id = child.attrib.get('sheetId')
                rel_id = child.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
                sheets_info.append((name, sheet_id, rel_id))
        
        # We need to map relId to the sheet xml file
        # Check xl/_rels/workbook.xml.rels
        rels_xml = zip_ref.read('xl/_rels/workbook.xml.rels')
        rels_root = ET.fromstring(rels_xml)
        ns_rel = {'ns': 'http://schemas.openxmlformats.org/package/2006/relationships'}
        
        rel_map = {}
        for rel in rels_root.findall('.//ns:Relationship', ns_rel):
            r_id = rel.attrib.get('Id')
            target = rel.attrib.get('Target')
            # target is like "worksheets/sheet1.xml"
            rel_map[r_id] = target

        for name, sheet_id, rel_id in sheets_info:
            target_xml_path = "xl/" + rel_map[rel_id]
            sheet_xml = zip_ref.read(target_xml_path)
            sheet_root = ET.fromstring(sheet_xml)
            
            # Parse sheet data
            ns_sheet = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            
            # Reconstruct grid
            grid = {}
            max_r = 0
            max_c = 0
            
            for row in sheet_root.findall('.//ns:row', ns_sheet):
                r_idx = int(row.attrib.get('r'))
                max_r = max(max_r, r_idx)
                for cell in row.findall('ns:c', ns_sheet):
                    # cell ref like "A1", "B2"
                    ref = cell.attrib.get('r')
                    # Parse column index from ref
                    col_str = "".join([c for c in ref if c.isalpha()])
                    c_idx = 0
                    for char in col_str:
                        c_idx = c_idx * 26 + (ord(char.upper()) - 64)
                    max_c = max(max_c, c_idx)
                    
                    val_el = cell.find('ns:v', ns_sheet)
                    val = ""
                    if val_el is not None:
                        val = val_el.text if val_el.text else ""
                    
                    t_type = cell.attrib.get('t')
                    if t_type == 's' and val != "":
                        # shared string index
                        s_idx = int(val)
                        if s_idx < len(shared_strings):
                            val = shared_strings[s_idx]
                            
                    grid[(r_idx, c_idx)] = val
            
            # Write sheet data to CSV
            out_file = os.path.join(out_dir, f"{name}.csv")
            with open(out_file, "w", encoding="utf-8") as out_f:
                for r in range(1, max_r + 1):
                    row_vals = []
                    for c in range(1, max_c + 1):
                        val = grid.get((r, c), "")
                        # Escape quotes
                        if "," in val or "\n" in val or '"' in val:
                            val = '"' + val.replace('"', '""') + '"'
                        row_vals.append(val)
                    out_f.write(",".join(row_vals) + "\n")
            
            print(f"Extracted sheet '{name}' to {out_file} ({max_r} rows, {max_c} columns)")

except Exception as e:
    import traceback
    print("Error:")
    traceback.print_exc()
