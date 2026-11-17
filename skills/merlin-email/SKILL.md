---
name: merlin-email
description: "Parse email files (.eml RFC-822, .msg Outlook) — headers, body, embedded attachments via Python email stdlib + extract-msg."
version: 1.0.0
author: Merlin
license: MIT
platforms: [linux, macos, windows]
metadata:
  merlin:
    tags: [Email, EML, MSG, Outlook, Parsing]
    related_skills: []
---

# Email Files

Handles `.eml` (RFC-822) and `.msg` (Outlook) email files.

## EML (standard RFC-822)

Python's built-in `email` module handles `.eml` without extra dependencies:

```python
python3 -c "
from email import policy
from email.parser import BytesParser
with open('/path/to/file.eml', 'rb') as f:
    msg = BytesParser(policy=policy.default).parse(f)
print('From:', msg['from'])
print('To:', msg['to'])
print('Subject:', msg['subject'])
print('Date:', msg['date'])
print('---')
print(msg.get_body(preferencelist=('plain',)).get_content() if msg.get_body() else '')
print('---')
for part in msg.iter_attachments():
    print('Attachment:', part.get_filename(), '(', part.get_content_type(), ')')
"
```

## MSG (Outlook)

```bash
uv pip install extract-msg
```

```python
python3 -c "
import extract_msg
m = extract_msg.Message('/path/to/file.msg')
m.printer()
"
```

Or read fields individually:

```python
python3 -c "
import extract_msg
m = extract_msg.Message('/path/to/file.msg')
print('From:', m.sender)
print('To:', m.to)
print('Subject:', m.subject)
print('Date:', m.date)
print('---')
print(m.body)
print('---')
for att in m.attachments:
    print('Attachment:', att.longFilename or att.shortFilename)
"
```

## Embedded attachments

If an email has its own attachments and the user wants to inspect them,
extract them to a sibling directory and handle each via the appropriate skill
(treat each like a freshly attached file).

```python
# EML — save attachments
python3 -c "
from email import policy
from email.parser import BytesParser
import os, sys
src = sys.argv[1]; out = sys.argv[2]
os.makedirs(out, exist_ok=True)
msg = BytesParser(policy=policy.default).parse(open(src, 'rb'))
for part in msg.iter_attachments():
    name = part.get_filename() or 'unnamed'
    with open(os.path.join(out, name), 'wb') as f:
        f.write(part.get_payload(decode=True))
    print('Saved:', name)
" /path/to/file.eml /path/to/extracted/
```

```python
# MSG — save attachments
python3 -c "
import extract_msg, os, sys
src = sys.argv[1]; out = sys.argv[2]
os.makedirs(out, exist_ok=True)
m = extract_msg.Message(src)
for att in m.attachments:
    name = att.longFilename or att.shortFilename or 'unnamed'
    att.save(customPath=out, customFilename=name)
    print('Saved:', name)
" /path/to/file.msg /path/to/extracted/
```

## Tips

- Print headers first (From / To / Subject / Date) so the user has context
  before the body.
- For HTML-only emails, use `msg.get_body(preferencelist=('html',))` and
  consider stripping tags with `BeautifulSoup` for readability.
- Don't dump multi-MB attachments inline. List them and ask the user which
  to inspect.
