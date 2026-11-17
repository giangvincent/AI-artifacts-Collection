---
name: merlin-spreadsheet
description: "Inspect spreadsheet files (.xlsx, .xls, .ods, .csv) via pandas, openpyxl, and odfpy. Use for large CSVs too (small CSVs may use the `read` tool directly)."
version: 1.0.0
author: Merlin
license: MIT
platforms: [linux, macos, windows]
metadata:
  merlin:
    tags: [Spreadsheets, Excel, XLSX, CSV, Pandas]
    related_skills: []
---

# Spreadsheets

Handles `.xls`, `.xlsx`, `.ods`, or a large `.csv` (≥ 200 rows). For small
CSVs the `read` tool is fine.

## Library choice

| Need                                  | Tool                           |
| ------------------------------------- | ------------------------------ |
| List sheets / inspect structure       | `openpyxl` (XLSX only, read-only) |
| Read data into a dataframe            | `pandas.read_excel` / `read_csv` |
| ODS support                           | `pandas` + `odfpy`             |

```bash
uv pip install pandas openpyxl odfpy
```

## Quick inspection: what's in the workbook?

```python
python3 -c "
import openpyxl
wb = openpyxl.load_workbook('/path/to/file.xlsx', read_only=True, data_only=True)
for name in wb.sheetnames:
    ws = wb[name]
    print(f'{name}: {ws.max_row} rows x {ws.max_column} cols')
"
```

## Inspect a specific sheet with pandas

```python
python3 -c "
import pandas as pd
df = pd.read_excel('/path/to/file.xlsx', sheet_name='Sheet1')
print(df.shape)
print(df.dtypes)
print(df.head(20))
print(df.describe(include='all'))
"
```

For ODS:

```python
pd.read_excel('/path/to/file.ods', engine='odf', sheet_name=...)
```

## Large CSV

```python
python3 -c "
import pandas as pd
df = pd.read_csv('/path/to/file.csv')
print(df.shape)
print(df.dtypes)
print(df.head(20))
"
```

For very large CSVs (> 100 MB), stream in chunks instead of loading everything:

```python
for chunk in pd.read_csv('/path/to/file.csv', chunksize=50_000):
    # process chunk
    ...
```

## Tips

- Always print `df.shape` and `df.dtypes` first so the user knows the
  structure before you start computing on it.
- For workbooks with multiple sheets, list them and let the user choose which
  one to focus on. Don't dump every sheet — the output gets huge.
- Use `.head(20)` for previews; `.describe(include='all')` is the
  one-liner that gives the most useful summary for numeric + categorical
  columns.
- Save processed results to disk (CSV / parquet) next to the original so the
  user can download them.
