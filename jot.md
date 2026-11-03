6. โจทย์ปฏิบัติฝึก (Express + MySQL + Jest) เวลาเป้าหมาย 60 นาที
โจทย์นี้ผมออกแบบเองให้คล้ายสไตล์ที่แนวข้อสอบบอกใบ้ไว้ (โปรเจกต์ระบบสั่งอาหาร, 3 ข้อ 6 / 4 / 5 คะแนน, เน้นเขียนเทสต์ อ่าน error ของ Jest แล้วแก้ และอธิบายสาเหตุ) ไม่ใช่ข้อสอบจริง และผมยังไม่ได้รันโค้ดชุดนี้กับ Jest จริงในเครื่องผม (เครื่องผมติดตั้ง express/jest ไม่ได้) ให้คุณรันเทียบเองในโปรเจกต์ final-exam-setup ถ้าผลต่างจากเฉลยให้เชื่อผลที่รันจริงและเช็กว่าตรงไหนต่าง
6.1 เตรียมโปรเจกต์
คัดลอกโฟลเดอร์ final-exam-setup มาเป็นโฟลเดอร์ใหม่ ทำตามเช็กลิสต์หัวข้อ 1 ให้ npm run check ผ่าน แล้วสร้างไฟล์ 3 ไฟล์ต่อไปนี้ในโฟลเดอร์รากของโปรเจกต์ (ตารางใช้ตาม seed.sql: menu_items, orders, order_items) การทดสอบทั้งหมดในโจทย์ใช้ mock ของ DB จึงรันได้โดยไม่ต้องมี MySQL ยกเว้นเทสต์ environment เดิม ให้รันเฉพาะไฟล์ของคุณด้วย npx jest tests/menu.test.js
orderUtils.js
// คำนวณยอดรวมของออเดอร์ จาก rows ที่ query มา: { price, quantity }
function calcTotal(items) {
  let total = 0;
  for (const item of items) {
    total += item.price;
  }
  return total;
}

module.exports = { calcTotal };
app.js
const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('./db');
const { jwtSecret } = require('./config');
const { calcTotal } = require('./orderUtils');

const app = express();
app.use(express.json());

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: { code: 'NO_TOKEN', message: 'ต้องแนบ token' } });
  }
  try {
    req.user = jwt.verify(header.split(' ')[1], jwtSecret);
    next();
  } catch (err) {
    return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'token ไม่ถูกต้องหรือหมดอายุ' } });
  }
}

app.get('/menu', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, price, available FROM menu_items WHERE available = TRUE ORDER BY id'
    );
    res.status(200).json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: { code: 'DB_ERROR', message: 'ฐานข้อมูลผิดพลาด' } });
  }
});

app.get('/menu/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: { code: 'INVALID_ID', message: 'id ต้องเป็นจำนวนเต็มบวก' } });
  }
  try {
    const [rows] = await pool.query(
      'SELECT id, name, price, available FROM menu_items WHERE id = ?',
      [id]
    );
    res.status(200).json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: { code: 'DB_ERROR', message: 'ฐานข้อมูลผิดพลาด' } });
  }
});

app.get('/orders/:id/total', authenticate, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const [rows] = await pool.query(
      'SELECT m.price, oi.quantity FROM order_items oi JOIN menu_items m ON m.id = oi.menu_item_id WHERE oi.order_id = ?',
      [id]
    );
    res.status(200).json({ data: { order_id: id, total: calcTotal(rows) } });
  } catch (err) {
    res.status(500).json({ error: { code: 'DB_ERROR', message: 'ฐานข้อมูลผิดพลาด' } });
  }
});

app.post('/orders', authenticate, async (req, res) => {
  const { customer_name, items } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [orderResult] = await conn.query(
      'INSERT INTO orders (customer_name) VALUES (?)',
      [customer_name]
    );
    for (const item of items) {
      await conn.query(
        'INSERT INTO order_items (order_id, menu_item_id, quantity) VALUES (?, ?, ?)',
        [orderResult.insertId, item.menu_item_id, item.quantity]
      );
    }
    await conn.commit();
    res.status(201).json({ data: { id: orderResult.insertId } });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: { code: 'DB_ERROR', message: 'สร้างออเดอร์ไม่สำเร็จ' } });
  } finally {
    conn.release();
  }
});

module.exports = app;
server.js
const app = require('./app');
const { port } = require('./config');

app.listen(port, () => console.log(`เซิร์ฟเวอร์ทำงานที่พอร์ต ${port}`));
ข้อควรระวังเรื่อง db.js ของชุด setup: ไฟล์นี้ export เป็น object module.exports = { pool } ไม่ใช่ module.exports = pool เหมือนตัวอย่างในสไลด์สัปดาห์ 9 ดังนั้นตอน mock ต้องคืนรูป { pool: {...} } และ import ด้วย const { pool } = require('../db')
6.2 โจทย์ข้อที่ 1 (6 คะแนน): เขียนเทสต์ด้วย Jest + Supertest
สร้างไฟล์ tests/menu.test.js โดย mock โมดูล ../db (ห้ามต่อ MySQL จริง) แล้วเขียนเทสต์ตามนี้ แต่ละเทสต์ต้องมี expect ที่ตรวจผลอย่างชัดเจน (ไม่ใช่แค่เรียกให้ coverage ขึ้น)
1. GET /menu คืน 200 และ body.data มีจำนวนรายการเท่ากับที่ mock ให้ (1 คะแนน)
2. GET /menu/:id ทั้ง 3 กรณี: พบเมนู → 200 และชื่อเมนูตรง; ไม่พบเมนู → 404 และ error.code เป็น NOT_FOUND; id ไม่ใช่ตัวเลข (เช่น abc) → 400 และต้องยืนยันว่า ไม่มีการเรียก DB (3 คะแนน กรณีละ 1)
3. POST /orders ไม่แนบ token → 401 และ error.code เป็น NO_TOKEN (1 คะแนน)
4. POST /orders แนบ token ถูกต้อง สั่งอาหาร 2 รายการ → 201 และ data.id ตรงกับ insertId ที่ mock พร้อมยืนยันว่า commit ถูกเรียก 1 ครั้ง, rollback ไม่ถูกเรียก, release ถูกเรียก 1 ครั้ง (1 คะแนน)
คำใบ้: token สร้างด้วย jwt.sign({ id: 1, role: 'customer' }, jwtSecret) โดย jwtSecret มาจาก config.js ส่วน getConnection ต้อง mock ให้คืน object ที่มี beginTransaction, query, commit, rollback, release
6.3 โจทย์ข้อที่ 2 (4 คะแนน): อ่าน error ของ Jest แล้วแก้โค้ด
หลังทำข้อ 1 และเพิ่มไฟล์ tests/orderUtils.test.js ด้านล่าง ให้รัน npx jest แล้วจะพบเทสต์ที่ล้มเหลวสองกลุ่ม (ข้อความด้านล่างผมเขียนจำลองให้ใกล้เคียง Jest ไม่ใช่ผลรันจริง)
const { calcTotal } = require('../orderUtils');

test('คำนวณยอดรวมจากราคา x จำนวน', () => {
  const rows = [
    { price: '60.00', quantity: 2 },
    { price: '25.00', quantity: 2 },
  ];
  expect(calcTotal(rows)).toBe(170);
});
FAIL tests/menu.test.js
  ● GET /menu/:id › ไม่พบเมนู → 404
    expect(received).toBe(expected)
    Expected: 404
    Received: 200

FAIL tests/orderUtils.test.js
  ● คำนวณยอดรวมจากราคา x จำนวน
    expect(received).toBe(expected)
    Expected: 170
    Received: "060.0025.00"
สำหรับแต่ละความล้มเหลวให้เขียน (ก) สาเหตุด้วยประโยคของตัวเอง (ข) โค้ดที่แก้ (ค) เทสต์ผ่านเมื่อรันซ้ำ ข้อละ 2 คะแนน
6.4 โจทย์ข้อที่ 3 (5 คะแนน): เพิ่ม Validation ให้ POST /orders และเขียนเทสต์
ตอนนี้ถ้าส่ง body ผิดรูปแบบ (เช่นไม่มี items) ระบบจะตอบ 500 หลังจากจอง connection ไปแล้ว ให้เพิ่ม validation แบบเขียนเอง (ไม่ต้องติดตั้งไลบรารี) ดังนี้
• customer_name ต้องเป็น string ยาว 1–100 ตัวอักษร
• items ต้องเป็น array 1–20 รายการ
• แต่ละรายการ menu_item_id เป็นจำนวนเต็มบวก และ quantity เป็นจำนวนเต็ม 1–99
• ถ้าไม่ผ่านตอบ 400 รูปแบบ { error: { code: 'VALIDATION_ERROR', message, details: [{ field, message }] } } โดยต้อง ไม่เรียก pool.getConnection
• ลำดับ middleware: ตรวจ token ก่อน แล้วค่อย validate (ไม่มี token ต้องได้ 401 เสมอ)
คะแนน: ฟังก์ชันตรวจข้อมูลถูกต้อง 2 · ต่อ middleware ถูกลำดับและรูปแบบ response ถูก 1 · เขียนเทสต์ 3 กรณี (ไม่มี items, quantity เป็น 0, customer_name ไม่ใช่ string) กรณีละ 2/3 คะแนน รวม 2
เสร็จแล้วไปเทียบเฉลยในหัวข้อ 7 ถ้าติดตรงไหนระหว่างทำให้เปิดหัวข้อ 8 (สรุปเทคนิคส่วนปฏิบัติ) เหมือนที่ใช้ได้ตอนสอบจริงจากเอกสารสัปดาห์ 5–12