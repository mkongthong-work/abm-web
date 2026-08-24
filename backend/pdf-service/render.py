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


def esc_multiline(v):
    """เหมือน esc() แต่แปลงการขึ้นบรรทัดใหม่ (\\n) เป็น <br> เพื่อให้ชื่อรายการที่พิมพ์หลายบรรทัดขึ้นบรรทัดจริงในเอกสาร"""
    return esc(v).replace("\n", "<br>")


# ============ แปลงจำนวนเงินเป็นตัวหนังสือไทย (ยอดสุทธิ...บาทถ้วน) ============
_THAI_DIGITS = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า']
_THAI_UNITS = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน']  # ตำแหน่งภายในกลุ่ม 6 หลัก (0 = หลักหน่วย)


def _read_six_digit_group(group_str, is_last_group, whole_gt_one):
    group_str = group_str.lstrip('0')
    if group_str == '':
        return ''
    n = len(group_str)
    result = []
    for idx, ch in enumerate(group_str):
        digit = int(ch)
        if digit == 0:
            continue
        pos = n - idx - 1  # 0=หน่วย, 1=สิบ, 2=ร้อย, ...
        if pos == 0:
            if digit == 1 and is_last_group and whole_gt_one:
                result.append('เอ็ด')
            else:
                result.append(_THAI_DIGITS[digit])
        elif pos == 1:
            if digit == 1:
                result.append('สิบ')
            elif digit == 2:
                result.append('ยี่สิบ')
            else:
                result.append(_THAI_DIGITS[digit] + 'สิบ')
        else:
            result.append(_THAI_DIGITS[digit] + _THAI_UNITS[pos])
    return ''.join(result)


def _number_to_thai_text(n: int) -> str:
    if n == 0:
        return _THAI_DIGITS[0]
    s = str(n)
    groups = []
    while s:
        groups.append(s[-6:])
        s = s[:-6]
    groups.reverse()
    num_groups = len(groups)
    whole_gt_one = n > 1
    parts = []
    for gi, g in enumerate(groups):
        is_last_group = gi == num_groups - 1
        text = _read_six_digit_group(g, is_last_group, whole_gt_one)
        if text == '':
            continue
        level = num_groups - 1 - gi
        if level > 0:
            text += 'ล้าน' * level
        parts.append(text)
    return ''.join(parts)


def thai_baht_text(amount) -> str:
    """แปลงจำนวนเงิน (float/int) เป็นตัวหนังสือไทยแบบ '...บาทถ้วน' / '...บาทXXสตางค์'"""
    try:
        amount = float(amount)
    except (TypeError, ValueError):
        amount = 0.0
    negative = amount < 0
    amount = abs(round(amount + 1e-9, 2))
    baht = int(amount)
    satang = int(round((amount - baht) * 100))
    if satang >= 100:
        baht += 1
        satang -= 100
    text = _number_to_thai_text(baht) + 'บาท'
    if satang == 0:
        text += 'ถ้วน'
    else:
        text += _number_to_thai_text(satang) + 'สตางค์'
    if negative:
        text = 'ลบ' + text
    return text


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


def build_css(accent, minimal=False):
    # ธีม "มินิมอล": ไม่ใช้พื้นหลังสีเลยแม้แต่สีเดียว (ไม่มีแถบลายตาราง ไม่มีพื้นหัวตาราง ไม่มีกล่องหมายเหตุสีพื้น)
    # เหลือแค่เส้นขอบ/สีตัวอักษรดำล้วน ต่างจากธีมโมเดิร์นที่ไล่สีอ่อนจาก accent มาทำพื้นหลัง
    if minimal:
        row_stripe = "transparent"
        soft_bg = "transparent"
        th_bg = "transparent"
        th_color = accent
        th_border_bottom = f"border-bottom: 2px solid {accent};"
    else:
        row_stripe = tint(accent, 0.95)
        soft_bg = tint(accent, 0.93)
        th_bg = accent
        th_color = "#fff"
        th_border_bottom = ""
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
    color: #1a1a1a;
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
/* ลายน้ำ "ยกเลิก" สีแดง — position: fixed ให้ขึ้นซ้ำทุกหน้าถ้าเอกสารยาวหลายหน้า */
.watermark {{
    position: fixed;
    top: 45%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-28deg);
    font-size: 120px;
    font-weight: bold;
    color: rgba(200, 30, 30, 0.28);
    letter-spacing: 10px;
    white-space: nowrap;
    z-index: 999;
}}
table.items {{
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
}}
table.items th {{
    background: {th_bg};
    color: {th_color};
    font-weight: normal;
    font-size: 12px;
    padding: 8px 6px;
    text-align: left;
    {th_border_bottom}
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
    flex-direction: column;
    align-items: flex-end;
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
.baht-text {{
    width: 260px;
    text-align: right;
    font-size: 11.5px;
    font-style: italic;
    color: #444;
    margin-top: 3px;
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
"""


TEMPLATE = """
<html>
<head><meta charset="utf-8"><style>{css}</style></head>
<body>
  {watermark_block}
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
        <div class="line">เลขที่เอกสาร: {doc_number}</div>
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

    {totals_block}

    {note_block}
  </div>

  <div class="page-bottom">
    {signatures_block}
  </div>
</body>
</html>
"""

def render_document_pdf(doc, customer, company, items, subtotal, discount, vat, total, out_path):
    doc_type = doc["doc_type"]
    labels = DOC_LABELS[doc_type]
    # toggle เฉพาะเอกสารประเภทใบแจ้งหนี้: แสดงหัวเอกสารเป็น "ใบแจ้งหนี้ / ใบเสร็จรับเงิน" ได้ด้วย
    if doc_type == "invoice" and doc.get("combined_receipt"):
        labels = {"th": "ใบแจ้งหนี้ / ใบเสร็จรับเงิน", "en": "INVOICE / RECEIPT"}
    accent = (company or {}).get(f"{doc_type}_color") or DEFAULT_DOC_COLORS.get(doc_type, "#0d9488")
    # ธีม "มินิมอล": ไม่ใช้สีประจำเอกสารเลย และไม่มีพื้นหลังสีเลยแม้แต่สีเดียว (ขาวดำล้วน เหลือแค่เส้นขอบ/ตัวอักษร)
    is_minimal = doc.get("theme") == "minimal"
    if is_minimal:
        accent = "#1a1a1a"

    # ซ่อนคอลัมน์ "จำนวน" / "หน่วย" / "ราคา/หน่วย"+"จำนวนเงิน" ในตารางได้ตาม toggle ที่ตั้งไว้ตอนกรอกฟอร์ม (ค่าเริ่มต้น: แสดงทั้งหมด)
    show_qty = doc.get("show_quantity")
    show_qty = True if show_qty is None else bool(show_qty)
    show_unit_col = doc.get("show_unit")
    show_unit_col = True if show_unit_col is None else bool(show_unit_col)
    show_price_col = doc.get("show_price")
    show_price_col = True if show_price_col is None else bool(show_price_col)

    thead_cells = ['<th style="width:36px;">ลำดับ</th>', "<th>รายการ</th>"]
    if show_qty:
        thead_cells.append('<th class="num" style="width:60px;">จำนวน</th>')
    if show_unit_col:
        thead_cells.append('<th style="width:60px;">หน่วย</th>')
    if show_price_col:
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
            f"<td>{esc_multiline(it['name'])}{desc_html}</td>",
        ]
        if show_qty:
            cells.append(f'<td class="num">{it["quantity"]:,.2f}</td>')
        if show_unit_col:
            cells.append(f"<td>{esc(it['unit'])}</td>")
        if show_price_col:
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

    # ลายน้ำ "ยกเลิก" สีแดง แสดงเฉพาะเอกสารที่สถานะเป็น void — void_reason (ถ้ามี) ตั้งใจไม่พิมพ์ลง PDF เลย เก็บไว้ดูภายในระบบเท่านั้น
    watermark_block = '<div class="watermark">ยกเลิก</div>' if doc.get("status") == "void" else ""

    # กล่องสรุปยอด (รวมเป็นเงิน/ส่วนลด/VAT/ยอดสุทธิ/ตัวหนังสือไทย) — แสดงเสมอ ไม่ผูกกับ toggle "ราคา/หน่วย"
    # เพราะคอลัมน์ "จำนวนเงิน" ยังคงแสดงอยู่แม้ปิดคอลัมน์ราคา/หน่วยไว้
    totals_block = (
        '<div class="totals"><table>'
        f'<tr><td class="label">รวมเป็นเงิน</td><td class="value">{money(subtotal)} บาท</td></tr>'
        f"{discount_row}{vat_row}"
        f'<tr class="grand"><td class="label">ยอดรวมสุทธิ</td><td class="value">{money(total)} บาท</td></tr>'
        "</table>"
        f'<div class="baht-text">({thai_baht_text(total)})</div></div>'
    )

    html_str = TEMPLATE.format(
        css=build_css(accent, minimal=is_minimal),
        company_name=esc(company["name"]),
        company_address=esc(company["address"]),
        company_tax_id=esc(company["tax_id"]),
        company_phone=esc(company["phone"]),
        company_email=esc(company["email"]),
        doc_label_th=labels["th"],
        doc_label_en=labels["en"],
        doc_number=esc(doc["doc_number"]),
        customer_name=esc_multiline(customer["name"]),
        customer_address=esc_multiline(customer["address"]) or "-",
        customer_tax_id=esc(customer["tax_id"]) or "-",
        customer_phone=esc(customer["phone"]) or "-",
        customer_email=esc(customer["email"]) or "-",
        issue_date_th=thai_date(doc["issue_date"]),
        due_date_row=due_date_row,
        items_thead=items_thead,
        item_rows="".join(item_rows),
        totals_block=totals_block,
        note_block=note_block,
        signatures_block=signatures_block,
        watermark_block=watermark_block,
    )

    HTML(string=html_str, base_url=BASE_DIR).write_pdf(out_path)
