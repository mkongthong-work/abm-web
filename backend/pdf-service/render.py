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

# สีเริ่มต้นของแต่ละประเภทเอกสาร ใช้เมื่อยังไม่ได้ตั้งค่าในหน้า "ตั้งค่าบริษัท"
DEFAULT_DOC_COLORS = {
    "quotation": "#0d9488",
    "invoice": "#2563eb",
    "receipt": "#7c3aed",
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


def _hex_to_rgb(hex_color):
    h = (hex_color or "").lstrip("#")
    if len(h) != 6:
        h = "0d9488"
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def tint(hex_color, amount):
    """ผสมสีเข้มกับสีขาวตามสัดส่วน amount (0-1) เพื่อให้ได้สีอ่อนไว้ทำพื้นหลัง/แถบลาย"""
    r, g, b = _hex_to_rgb(hex_color)
    r = round(r + (255 - r) * amount)
    g = round(g + (255 - g) * amount)
    b = round(b + (255 - b) * amount)
    return f"#{r:02x}{g:02x}{b:02x}"


def build_css(accent):
    row_stripe = tint(accent, 0.95)
    soft_bg = tint(accent, 0.93)
    return f"""
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
    margin: 0;
    /* A4 (297mm) หัก margin บน-ล่างของ @page (20mm x 2) = พื้นที่เนื้อหาสูง 257mm ต่อหน้า
       body มีลูกแค่ 2 กลุ่ม (.page-content, .page-bottom) แล้วใช้ justify-content: space-between
       เพื่อดันกลุ่มท้าย (ลงนาม + footer note) ไปชิดขอบล่างของกระดาษ
       หมายเหตุ: WeasyPrint ไม่รองรับ margin:auto บน flex item ให้ดันแทน ต้องใช้ justify-content แทน
       ถ้าเนื้อหายาวเกินหนึ่งหน้าอยู่แล้ว ระยะนี้จะไม่มีผล (ไม่มีพื้นที่เหลือให้ดัน) เอกสารจะไหลต่อตามปกติ */
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 257mm;
}}
.page-bottom {{ flex: none; }}
.header {{
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 3px solid {accent};
    padding-bottom: 12px;
    margin-bottom: 18px;
}}
.company-block .company-name {{
    font-size: 16px;
    font-weight: bold;
    color: {accent};
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
    color: {accent};
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
    color: {accent};
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
    background: {accent};
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
table.items tr:nth-child(even) td {{ background: {row_stripe}; }}
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
    border-top: 2px solid {accent};
    font-weight: bold;
    font-size: 15px;
    color: {accent};
    padding-top: 8px;
}}
.note-box {{
    margin-top: 20px;
    padding: 10px 12px;
    background: {soft_bg};
    border-left: 3px solid {accent};
    font-size: 12px;
    color: #333;
}}
.signatures {{
    display: flex;
    justify-content: space-between;
    margin-top: 40px;
}}
.signatures.single {{ justify-content: center; }}
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
  <div class="page-content">
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
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          {items_thead}
        </tr>
      </thead>
      <tbody>
        {item_rows}
      </tbody>
    </table>

    <div class="totals">
      <table>
        <tr><td class="label">รวมเป็นเงิน</td><td class="value">{subtotal} บาท</td></tr>
        {discount_row}
        {vat_row}
        <tr class="grand"><td class="label">ยอดรวมสุทธิ</td><td class="value">{total} บาท</td></tr>
      </table>
    </div>

    {note_block}
  </div>

  <div class="page-bottom">
    {signatures_block}
    <div class="footer-note">เอกสารนี้สร้างจากระบบ ABM (Accounting &amp; Billing Management) POC — ตัวอย่างเพื่อการทดสอบเท่านั้น</div>
  </div>
</body>
</html>
"""

def render_document_pdf(doc, customer, company, items, subtotal, discount, vat, total, out_path):
    doc_type = doc["doc_type"]
    labels = DOC_LABELS[doc_type]
    accent = (company or {}).get(f"{doc_type}_color") or DEFAULT_DOC_COLORS.get(doc_type, "#0d9488")

    # ซ่อนคอลัมน์ "จำนวน" / "หน่วย" ในตารางได้ตาม toggle ที่ตั้งไว้ตอนกรอกฟอร์ม (ค่าเริ่มต้น: แสดงทั้งคู่)
    show_qty = doc.get("show_quantity")
    show_qty = True if show_qty is None else bool(show_qty)
    show_unit_col = doc.get("show_unit")
    show_unit_col = True if show_unit_col is None else bool(show_unit_col)

    thead_cells = ['<th style="width:36px;">ลำดับ</th>', "<th>รายการ</th>"]
    if show_qty:
        thead_cells.append('<th class="num" style="width:60px;">จำนวน</th>')
    if show_unit_col:
        thead_cells.append('<th style="width:60px;">หน่วย</th>')
    thead_cells.append('<th class="num" style="width:90px;">ราคา/หน่วย</th>')
    thead_cells.append('<th class="num" style="width:100px;">จำนวนเงิน</th>')
    items_thead = "".join(thead_cells)

    item_rows = []
    for idx, it in enumerate(items, start=1):
        amount = it["quantity"] * it["unit_price"]
        desc_html = ""
        if it["description"]:
            desc_html = f'<br><span style="color:#888;font-size:11px;">{esc(it["description"])}</span>'
        cells = [
            f"<td>{idx}</td>",
            f"<td>{esc(it['name'])}{desc_html}</td>",
        ]
        if show_qty:
            cells.append(f'<td class="num">{it["quantity"]:,.2f}</td>')
        if show_unit_col:
            cells.append(f"<td>{esc(it['unit'])}</td>")
        cells.append(f'<td class="num">{money(it["unit_price"])}</td>')
        cells.append(f'<td class="num">{money(amount)}</td>')
        item_rows.append(f"<tr>{''.join(cells)}</tr>")

    due_date_row = ""
    if doc["due_date"]:
        due_date_row = f"กำหนดชำระ: {thai_date(doc['due_date'])}"

    note_block = ""
    if doc["note"]:
        note_block = f'<div class="note-box"><strong>หมายเหตุ:</strong> {esc(doc["note"])}</div>'

    # ช่องลงชื่อท้ายเอกสาร: แก้ข้อความหรือปิดฝั่งใดฝั่งหนึ่งได้จากหน้าฟอร์ม (ค่าว่าง = ไม่แสดงฝั่งนั้น)
    sign_left = (doc.get("sign_left_label") or "").strip()
    sign_right = (doc.get("sign_right_label") or "").strip()
    sign_boxes = []
    if sign_left:
        sign_boxes.append(
            f'<div class="sign-box"><div class="sign-line">{esc(sign_left)}</div>วันที่ ......../......../..........</div>'
        )
    if sign_right:
        sign_boxes.append(
            f'<div class="sign-box"><div class="sign-line">{esc(sign_right)}</div>วันที่ ......../......../..........</div>'
        )
    signatures_block = ""
    if sign_boxes:
        css_class = "signatures single" if len(sign_boxes) == 1 else "signatures"
        signatures_block = f'<div class="{css_class}">{"".join(sign_boxes)}</div>'

    # แสดงแถวส่วนลด/ภาษีมูลค่าเพิ่มเฉพาะตอนมีค่าจริง (ตรงกับ toggle เปิด/ปิดในหน้าฟอร์ม
    # ซึ่งตอนปิดจะส่ง discount/vat_rate มาเป็น 0 — ไม่ใช่แค่ซ่อนในหน้าตัวอย่างแต่ไม่ซ่อนใน PDF)
    discount_row = ""
    if discount:
        discount_row = f'<tr><td class="label">ส่วนลด</td><td class="value">-{money(discount)} บาท</td></tr>'

    vat_row = ""
    if doc["vat_rate"]:
        vat_row = (
            f'<tr><td class="label">ภาษีมูลค่าเพิ่ม ({doc["vat_rate"]:g}%)</td>'
            f'<td class="value">{money(vat)} บาท</td></tr>'
        )

    html_str = TEMPLATE.format(
        css=build_css(accent),
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
        items_thead=items_thead,
        item_rows="".join(item_rows),
        subtotal=money(subtotal),
        discount_row=discount_row,
        vat_row=vat_row,
        total=money(total),
        note_block=note_block,
        signatures_block=signatures_block,
    )

    HTML(string=html_str, base_url=BASE_DIR).write_pdf(out_path)
