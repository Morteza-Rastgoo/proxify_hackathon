import csv
import os
import io
from datetime import datetime
from typing import List, Tuple
from ..models.cost import Cost

def parse_float(value: str) -> float:
    if not value:
        return 0.0
    # Replace comma with dot, remove quotes, and remove spaces (thousands separator)
    try:
        clean_value = str(value).replace('"', '').replace(',', '.').replace(' ', '').replace('\xa0', '')
        return float(clean_value)
    except ValueError:
        return 0.0

def parse_date(value: str) -> datetime.date:
    if not value:
        return datetime.now().date()
    try:
        return datetime.strptime(str(value).strip(), "%Y-%m-%d").date()
    except ValueError:
        return datetime.now().date()

def get_row_value(row: dict, keys: List[str]) -> str:
    for key in keys:
        if key in row:
            return row[key]
    return ""

def parse_csv_content(content: str) -> Tuple[List[Cost], List[str]]:
    costs = []
    errors = []
    csv_file = io.StringIO(content)
    # Handle potential dialect issues
    try:
        dialect = csv.Sniffer().sniff(content[:1024])
        csv_file.seek(0)
        reader = csv.DictReader(csv_file, dialect=dialect)
    except csv.Error:
        csv_file.seek(0)
        reader = csv.DictReader(csv_file) # Fallback to default

    if reader.fieldnames:
        print(f"CSV Headers: {reader.fieldnames}")
        errors.append(f"Headers detected: {reader.fieldnames}")
    else:
        errors.append("No headers detected")

    row_count = 0
    for row in reader:
        row_count += 1
        try:
            # Handle potential encoding issues in headers
            vernr = get_row_value(row, ['Vernr', 'vernr', 'VERNR'])
            if not vernr:
                # Only log first few failures to avoid spam
                if row_count < 5:
                    errors.append(f"Row {row_count}: Vernr column not found. Keys: {list(row.keys())}")
                continue 

            posting_date_val = get_row_value(row, ['Bokföringsdatum', 'Bokfringsdatum', 'bokforingsdatum'])
            registration_date_val = get_row_value(row, ['Registreringsdatum', 'registreringsdatum'])
            account_number_val = get_row_value(row, ['Konto', 'konto'])
            account_name_val = get_row_value(row, ['Benämning', 'Benmning', 'benamning'])
            ks_val = get_row_value(row, ['Ks', 'ks'])
            project_number_val = get_row_value(row, ['Projnr', 'projnr'])
            verification_text_val = get_row_value(row, ['Verifikationstext', 'verifikationstext'])
            transaction_info_val = get_row_value(row, ['Transaktionsinfo', 'transaktionsinfo'])
            debet_val = get_row_value(row, ['Debet', 'debet'])
            kredit_val = get_row_value(row, ['Kredit', 'kredit'])

            cost = Cost(
                vernr=vernr,
                posting_date=parse_date(posting_date_val),
                registration_date=parse_date(registration_date_val),
                account_number=int(account_number_val) if account_number_val and account_number_val.isdigit() else 0,
                account_name=account_name_val or "",
                ks=ks_val,
                project_number=project_number_val,
                verification_text=verification_text_val,
                transaction_info=transaction_info_val,
                debit=parse_float(debet_val),
                credit=parse_float(kredit_val)
            )
            costs.append(cost)
        except Exception as e:
            if row_count < 5:
                errors.append(f"Row {row_count} parse error: {str(e)}")
            continue
            
    return costs, errors

def get_costs() -> List[Cost]:
    # CSV moved to tests/data
    file_path = "tests/data/Cillers Cost Log - Costs.csv"
    # Also check modules/api/tests/data just in case
    if not os.path.exists(file_path):
        if os.path.exists(os.path.join("modules", "api", file_path)):
            file_path = os.path.join("modules", "api", file_path)
        elif os.path.exists("/app/tests/data/Cillers Cost Log - Costs.csv"):
             file_path = "/app/tests/data/Cillers Cost Log - Costs.csv"
        else:
            return []

    with open(file_path, mode='r', encoding='utf-8') as csvfile:
        content = csvfile.read()
        costs, _ = parse_csv_content(content)
        return costs
