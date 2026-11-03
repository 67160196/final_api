# 8. เทคนิคที่ใช้บ่อย

## 8.1 คำสั่งที่ใช้บ่อย

| คำสั่ง | ใช้ทำอะไร |
| --- | --- |
| `docker compose up -d` / `docker compose down` | เปิด / ปิด MySQL (หลังเปิดให้รอประมาณ 20 วินาที) |
| `npm run seed` | ล้างและใส่ข้อมูลตัวอย่างใหม่ (`DROP` + `CREATE` ตาราง) ใช้รีเซ็ตข้อมูลก่อนทดสอบกับ DB จริง |
| `npm run check` | เช็กว่าต่อ DB ได้และเห็นเมนู 22 รายการ |
| `npm test` | รัน Jest ทั้งหมด |
| `npx jest tests/xxx.test.js` | รันเทสต์ไฟล์เดียว |
| `npx jest -t 'ชื่อเทสต์'` | รันเฉพาะเทสต์ที่ชื่อตรง |
| `npx jest --coverage` | ดู coverage และบรรทัดที่ยังไม่ครอบคลุม |

## 8.2 สิ่งที่ควรรู้เกี่ยวกับ `mysql2`

- ผลจาก `pool.query()` มีรูปแบบ `[rows, fields]` จึงควร destructure:
  ```js
  const [rows] = await pool.query(sql, [params]);
  ```
- `SELECT` ได้ array ของแถว ส่วน `INSERT` ได้ `[ResultSetHeader]` ซึ่งใช้ `insertId` และ `affectedRows` ได้
- สำหรับ `UPDATE` / `DELETE` ให้ตรวจ `affectedRows` หากเป็น `0` อาจต้องตอบกลับเป็น `404`
- ใช้ `?` เป็น placeholder เสมอ ห้ามต่อ string เพื่อป้องกัน SQL Injection
- ค่า `DECIMAL` จะกลับมาเป็น string เช่น `'60.00'` ต้องแปลงด้วย `Number()` ก่อนคำนวณ ส่วน `BOOLEAN` จะกลับมาเป็น `1` / `0`
- เมื่อใช้ transaction ให้คืน connection เสมอ:
  ```js
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // ทำงานกับฐานข้อมูล
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
  ```
- Foreign key ใน `seed.sql`:
  - `order_items.order_id` ใช้ `ON DELETE CASCADE` เมื่อลบ order แล้ว items จะถูกลบตาม
  - `menu_item_id` ไม่มี cascade จึงลบเมนูที่ถูกสั่งไปแล้วไม่ได้

## 8.3 รูปแบบเทสต์ที่ใช้ซ้ำ

### Mock ชั้นฐานข้อมูล

`db.js` ของชุด setup export เป็น `{ pool }`

```js
jest.mock('../db', () => ({
  pool: { query: jest.fn(), getConnection: jest.fn() },
}));
```

### ตั้งค่า mock ในแต่ละเทสต์

```js
pool.query.mockResolvedValueOnce([[{ id: 1 }]]); // SELECT ได้ 1 แถว
pool.query.mockResolvedValueOnce([[]]); // SELECT ไม่พบ
pool.query.mockResolvedValueOnce([{ insertId: 7, affectedRows: 1 }]); // INSERT
pool.query.mockRejectedValueOnce(new Error('db down')); // จำลอง DB ล้ม
```

### สร้าง token สำหรับทดสอบ

```js
const ok = jwt.sign({ id: 1, role: 'customer' }, jwtSecret);
const wrongSecret = jwt.sign({ id: 1 }, 'wrong-secret');
const expired = jwt.sign(
  { id: 1, exp: Math.floor(Date.now() / 1000) - 10 },
  jwtSecret
);
```

### ตรวจผลลัพธ์

```js
expect(res.status).toBe(201);
expect(res.body).toEqual({ data: { id: 7 } });
expect(pool.query).toHaveBeenCalledWith(
  expect.stringContaining('INSERT'),
  ['สมชาย']
);
expect(pool.query).not.toHaveBeenCalled();
```

- `jest.resetAllMocks()` ใน `beforeEach` ล้างทั้งค่าที่ mock ไว้และประวัติการเรียก ต่างจาก `clearAllMocks()` ที่ล้างเฉพาะประวัติ ทำให้เทสต์ไม่ปนกัน
- หากทดสอบกับ DB จริง (Integration) ให้ปิด pool หลังเทสต์ เพื่อไม่ให้ Jest ค้างหรือแจ้งเตือน open handle:
  ```js
  afterAll(async () => {
    await pool.end();
  });
  ```
  ควร seed ใหม่ก่อนรัน เพื่อให้ข้อมูลเริ่มต้นเหมือนเดิมทุกครั้ง

## 8.4 อ่าน error ของ Jest และคาดเดาสาเหตุ

| ข้อความที่พบ | สาเหตุที่มักเป็น |
| --- | --- |
| `Expected: 404 Received: 200` | handler ไม่ได้ตรวจกรณีไม่พบ หรือตอบ status ผิด |
| `Received: "060.0025.00"` (ผลเป็น string ยาว) | ค่า `DECIMAL` เป็น string แล้วใช้ `+` จึงกลายเป็นการต่อข้อความ |
| `TypeError: undefined is not iterable` | `await pool.query(...)` คืน `undefined` เพราะไม่ได้ตั้ง mock หรือ mock ถูก reset |
| `Exceeded timeout of 5000 ms` | ลืม `await` / `return Promise`, mock ไม่ resolve หรือ DB ยังไม่พร้อม |
| `Jest did not exit one second after...` | มี handle ค้าง เช่น ไม่ปิด pool หรือเรียก `app.listen` ตอน import |
| `ECONNREFUSED 127.0.0.1:3309` | MySQL ยังไม่ขึ้น หรือพอร์ตใน `.env` ไม่ตรงกับ `docker-compose.yml` |
| `Duplicate entry '...' for key` | ข้อมูลทดสอบสะสมจนชน `UNIQUE` ให้รัน `npm run seed` ใหม่ หรือลบข้อมูลก่อน / หลังเทสต์ |
| `Cannot read properties of undefined` ใน middleware | mock `req` / `res` ไม่มี property ที่โค้ดใช้ เช่น ต้อง mock chain `res.status().json()` |

## 8.5 Status code และรูปแบบ error ของวิชา

| Code | ใช้เมื่อ |
| --- | --- |
| `200` / `201` | สำเร็จ / สร้างสำเร็จ |
| `400` | ข้อมูลไม่ผ่าน validation (`VALIDATION_ERROR`) |
| `401` | ไม่มี token หรือ token ไม่ถูกต้อง (`NO_TOKEN`, `INVALID_TOKEN`) |
| `403` | มี token แต่สิทธิ์ (role) ไม่พอ |
| `404` | ไม่พบทรัพยากร |
| `409` | ข้อมูลซ้ำ |
| `429` | เกินโควตา rate limit |
| `500` | ข้อผิดพลาดฝั่งเราที่ไม่คาดคิด |
| `503` | บริการที่พึ่งพาล่ม (fallback) |

รูปแบบ error ที่วิชาใช้:

```js
{ error: { code: 'XXX', message: '...' } }
```

กรณี validation สามารถมี `details` เพิ่มได้

## 8.6 Snippet สำหรับ rate limit และ JWT

### Rate limit

```js
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'ลองใหม่ภายหลัง',
    },
  },
});

app.use('/auth/login', authLimiter);
```

หลัง reverse proxy ให้ตั้งค่า:

```js
app.set('trust proxy', 1);
```

### JWT

```js
const token = jwt.sign(
  { id: user.id, role: user.role },
  jwtSecret,
  { expiresIn: '1h' }
);

const payload = jwt.verify(token, jwtSecret); // token ผิดหรือหมดอายุจะ throw
```

หากทดสอบ rate limit ด้วย Supertest ให้ยิงเกินโควตาในลูป แล้วตรวจว่าครั้งที่ `max + 1` ได้ `429` ควรแยกแอปหรือรีเซ็ตตัวนับระหว่างเทสต์ มิฉะนั้นเทสต์ก่อนหน้าอาจใช้โควตาไปแล้ว
