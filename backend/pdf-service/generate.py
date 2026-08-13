"""
generate.py - CLI wrapper รอบ render.py
รับ JSON ผ่าน stdin: {doc, customer, company, items, subtotal, discount, vat, total, out_path}
ใช้จาก Node backend ผ่าน child_process
"""
import json
import sys
from render import render_document_pdf

def main():
    payload = json.load(sys.stdin)
    render_document_pdf(
        doc=payload["doc"],
        customer=payload["customer"],
        company=payload["company"],
        items=payload["items"],
        subtotal=payload["subtotal"],
        discount=payload["discount"],
        vat=payload["vat"],
        total=payload["total"],
        out_path=payload["out_path"],
    )
    print(json.dumps({"ok": True, "out_path": payload["out_path"]}))

if __name__ == "__main__":
    main()
