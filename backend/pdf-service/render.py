"""
render.py - แปลงข้อมูลเอกสารเป็นไฟล์ PDF (ใบเสนอราคา / ใบแจ้งหนี้ / ใบเสร็จรับเงิน)
ใช้ WeasyPrint แปลง HTML -> PDF โดยฝังฟอนต์ Sarabun (รองรับภาษาไทย)
"""
import os
from weasyprint import HTML

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.join(BASE_DIR, "fonts")

DOC_LABELS = {
    "quotation": {"th": "ใบเสนอราคา", "en": "QUOTATION"},
    "invoice": {"th": "ใบแจ้งหนี้", "en": "INVOICE"},
    "receipt": {"th": "ใบเสร็จรับเงิน / ใบกำกับภาษี", "en": "RECEIPT / TAX INVOICE"},
}

THAI_MONTHS = [
    "", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
]


def thai_date(date_str):
    if not date_str:
        return "-"
    try:
        y, m, d = date_str.split("-")
        buddhist_year = int(y) + 543
        return f"{int(d)} {THAI_MONTHS[int(m)]} {buddhist_year}"
    except Exception:
        return date_str


def money(v):
    return f"{v:,.2f}"


def esc(v):
    if v is None:
        return ""
    return str(v).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


CSS = f"""
@font-face {{
    font-family: 'Sarabun';
    src: url('file://{FONT_DIR}/Sarabun-Regular.ttf');
    font-weight: normal;
}}
@font-face {{
    font-family: 'Sarabun';
    src: url('file://{FONT_DIR}/Sarabun-Bold.ttf');
    font-weight: bold;
}}
@page {{
    size: A4;
    margin: 20mm 18mm;
    @bottom-center {{
        content: "หน้า " counter(page) " / " counter(pages);
        font-family: 'Sarabun';
        font-size: 9px;
        color: #888;
    }}
}}
* {{ box-sizing: border-box; }}
body {{
    font-family: 'Sarabun', sans-serif;
    font-size: 13px;
    color: #1a1a1a;
}}
.header {{
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 3px solid #0d9488;
    padding-bottom: 12px;
    margin-bottom: 18px;
}}
.company-block .company-name {{
    font-size: 16px;
    font-weight: bold;
    color: #0d9488;
}}
.company-block .meta {{
    font-size: 11px;
    color: #444;
    margin-top: 4px;
    line-height: 1.5;
}}
.doc-title {{
    text-align: right;
}}
.doc-title h1 {{
    font-size: 22px;
    color: #0d9488;
    margin: 0;
}}
.doc-title .doc-number {{
    font-size: 13px;
    color: #444;
    margin-top: 4px;
}}
.info-grid {{
    display: flex;
    justify-content: space-between;
    margin-bottom: 16px;
}}
.info-box {{
    width: 48%;
}}
.info-box h3 {{
    font-size: 11px;
    color: #0d9488;
    text-transform: uppercase;
    letter-spacing: .04em;
    margin: 0 0 6px 0;
    border-bottom: 1px solid #ddd;
    padding-bottom: 4px;
}}
.info-box .line {{ margin-bottom: 2px; line-height: 1.5; }}
.info-box .name {{ font-weight: bold; }}
table.items {{
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
}}
table.items th {{
    background: #0d9488;
    color: #fff;
    font-weight: normal;
    font-size: 12px;
    padding: 8px 6px;
    text-align: left;
}}
table.items td {{
    padding: 7px 6px;
    border-bottom: 1px solid #e5e5e5;
    font-size: 12.5px;
    vertical-align: top;
}}
table.items th.num, table.items td.num {{ text-align: right; }}
table.items tr:nth-child(even) td {{ background: #f7fdfc; }}
.totals {{
    width: 100%;
    margin-top: 10px;
    display: flex;
    justify-content: flex-end;
}}
.totals table {{
    width: 260px;
    border-collapse: collapse;
}}
.totals td {{
    padding: 5px 6px;
    font-size: 13px;
}}
.totals td.label {{ text-align: left; color: #444; }}
.totals td.value {{ text-align: right; }}
.totals tr.grand td {{
    border-top: 2px solid #0d9488;
    font-weight: bold;
    font-size: 15px;
    color: #0d9488;
    padding-top: 8px;
}}
.note-box {{
    margin-top: 20px;
    padding: 10px 12px;
    background: #f7fdfc;
    border-left: 3px solid #0d9488;
    font-size: 12px;
    color: #333;
}}
.signatures {{
    display: flex;
    justify-content: space-between;
    margin-top: 60px;
}}
.sign-box {{
    width: 40%;
    text-align: center;
    font-size: 12px;
    color: #444;
}}
.sign-line {{
    border-top: 1px solid #999;
    margin-bottom: 6px;
    padding-top: 40px;
}}
.footer-note {{
    margin-top: 30px;
    font-size: 10px;
    color: #999;
    text-align: center;
}}
"""

TEMPLATE = """
<html>
<head><meta charset="utf-8"><style>{css}</style></head>
<body>
  <div class="header">
    <div class="company-block">
      <div class="company-name">{company_name}</div>
      <div class="meta">
        {company_address}<br>
        เลขผู้เสียภาษี: {company_tax_id} &nbsp;|&nbsp; โทร: {company_phone}<br>
        อีเมล: {company_email}
      </div>
    </div>
    <div class="doc-title">
      <h1>{doc_label_th}</h1>
      <div class="doc-number">{doc_label_en} No. {doc_number}</div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <h3>ลูกค้า / Customer</h3>
      <div class="line name">{customer_name}</div>
      <div class="line">{customer_address}</div>
      <div class="line">เลขผู้เสียภาษี: {customer_tax_id}</div>
      <div class="line">โทร: {customer_phone} &nbsp; อีเมล: {customer_email}</div>
    </div>
    <div class="info-box">
      <h3>รายละเอียดเอกสาร</h3>
      <div class="line">วันที่ออกเอกสาร: {issue_date_th}</div>
      <div class="line">{due_date_row}</div>
      <div class="line">สถานะ: {status_th}</div>
    </div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th style="width:36px;">ลำดับ</th>
        <th>รายการ</th>
        <th class="num" style="width:60px;">จำนวน</th>
        <th style="width:60px;">หน่วย</th>
        <th class="num" style="width:90px;">ราคา/หน่วย</th>
        <th class="num" style="width:100px;">จำนวนเงิน</th>
      </tr>
    </thead>
    <tbody>
      {item_rows}
    </tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td class="label">รวมเป็นเงิน</td><td class="value">{subtotal} บาท</td></tr>
      <tr><td class="label">ส่วนลด</td><td class="value">-{discount} บาท</td></tr>
      <tr><td class="label">ภาษีมูลค่าเพิ่ม ({vat_rate}%)</td><td class="value">{vat} บาท</td></tr>
      <tr class="grand"><td class="label">ยอดรวมสุทธิ</td><td class="value">{total} บาท</td></tr>
    </table>
  </div>

  {note_block}

  <div class="signatures">
    <div class="sign-box">
      <div class="sign-line">ผู้เสนอราคา / ผู้ออกเอกสาร</div>
      วันที่ ......../......../..........
    </div>
    <div class="sign-box">
      <div class="sign-line">ผู้อนุมัติ / ผู้รับเอกสาร</div>
      วันที่ ......../......../..........
    </div>
  </div>

  <div class="footer-note">เอกสารนี้สร้างจากระบบ ABM (Accounting &amp; Billing Management) POC — ตัวอย่างเพื่อการทดสอบเท่านั้น</div>
</body>
</html>
"""

STATUS_TH = {"draft": "ฉบับร่าง", "sent": "ส่งแล้ว", "paid": "ชำระแล้ว", "void": "ยกเลิก"}


def render_document_pdf(doc, customer, company, items, subtotal, discount, vat, total, out_path):
    labels = DOC_LABELS[doc["doc_type"]]

    item_rows = []
    for idx, it in enumerate(items, start=1):
        amount = it["quantity"] * it["unit_price"]
        item_rows.append(f"""
          <tr>
            <td>{idx}</td>
            <td>{esc(it['name'])}{'<br><span style="color:#888;font-size:11px;">' + esc(it['description']) + '</span>' if it['description'] else ''}</td>
            <td class="num">{it['quantity']:,.2f}</td>
            <td>{esc(it['unit'])}</td>
            <td class="num">{money(it['unit_price'])}</td>
            <td class="num">{money(amount)}</td>
          </tr>
        """)

    due_date_row = ""
    if doc["due_date"]:
        due_date_row = f"กำหนดชำระ: {thai_date(doc['due_date'])}"

    note_block = ""
    if doc["note"]:
        note_block = f'<div class="note-box"><strong>หมายเหตุ:</strong> {esc(doc["note"])}</div>'

    html_str = TEMPLATE.format(
        css=CSS,
        company_name=esc(company["name"]),
        company_address=esc(company["address"]),
        company_tax_id=esc(company["tax_id"]),
        company_phone=esc(company["phone"]),
        company_email=esc(company["email"]),
        doc_label_th=labels["th"],
        doc_label_en=labels["en"],
        doc_number=esc(doc["doc_number"]),
        customer_name=esc(customer["name"]),
        customer_address=esc(customer["address"]) or "-",
        customer_tax_id=esc(customer["tax_id"]) or "-",
        customer_phone=esc(customer["phone"]) or "-",
        customer_email=esc(customer["email"]) or "-",
        issue_date_th=thai_date(doc["issue_date"]),
        due_date_row=due_date_row,
        status_th=STATUS_TH.get(doc["status"], doc["status"]),
        item_rows="".join(item_rows),
        subtotal=money(subtotal),
        discount=money(discount),
        vat_rate=f"{doc['vat_rate']:g}",
        vat=money(vat),
        total=money(total),
        note_block=note_block,
    )

    HTML(string=html_str, base_url=BASE_DIR).write_pdf(out_path)
