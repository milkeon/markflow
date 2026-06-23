import os
import csv
import sys

sys.stdout.reconfigure(encoding='utf-8')
in_dir = "d:/AntiBaseD/MarkFlow/scratch/extracted_sheets"
summary_file = "d:/AntiBaseD/MarkFlow/scratch/sheets_summary.md"

sheets = [
    "기술 스택",
    "데이터 모델",
    "실시간 추상화",
    "권한 검사",
    "리스크 & 대응",
    "개발 일정",
    "사용자 기능 정의서"
]

with open(summary_file, "w", encoding="utf-8") as out_f:
    out_f.write("# Google Sheets 기획서 요약\n\n")
    
    for sheet_name in sheets:
        csv_path = os.path.join(in_dir, f"{sheet_name}.csv")
        if not os.path.exists(csv_path):
            print(f"File not found: {csv_path}")
            continue
            
        out_f.write(f"## 시트: {sheet_name}\n\n")
        
        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            rows = list(reader)
            
            # Filter out completely empty rows
            valid_rows = []
            for r in rows:
                if any(cell.strip() != "" for cell in r):
                    # strip cells
                    valid_rows.append([cell.strip() for cell in r])
            
            if not valid_rows:
                out_f.write("*데이터가 없습니다.*\n\n")
                continue
                
            # Write as markdown table
            # Assume first valid row is header
            header = valid_rows[0]
            out_f.write("| " + " | ".join(header) + " |\n")
            out_f.write("| " + " | ".join(["---"] * len(header)) + " |\n")
            
            for row in valid_rows[1:]:
                # Normalize length to match header
                if len(row) < len(header):
                    row += [""] * (len(header) - len(row))
                elif len(row) > len(header):
                    row = row[:len(header)]
                
                # Replace newline with br tag to keep table tidy
                row_cleaned = [cell.replace('\n', '<br>') for cell in row]
                out_f.write("| " + " | ".join(row_cleaned) + " |\n")
                
        out_f.write("\n---\n\n")

print(f"Summary markdown created at {summary_file}")
