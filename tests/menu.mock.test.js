// Mocking test แบบพื้นฐาน: ไม่ต่อ MySQL จริง ใช้ข้อมูลปลอมแทน

// 1) ปลอม db.js ให้ pool.query เป็นฟังก์ชันปลอม (ต้องอยู่ก่อน require app)
jest.mock("../db", () => ({
  pool: { query: jest.fn() },
}));

const request = require("supertest");
const { pool } = require("../db");
const app = require("../app");

// 2) ก่อนทุกเทสต์ ล้างค่าที่ mock ไว้จากเทสต์ก่อนหน้า
beforeEach(() => {
  jest.resetAllMocks();
});

describe("GET /menu", () => {
  test("คืนรายการเมนูทั้งหมด", async () => {
    // กำหนดว่าฐานข้อมูลปลอมจะตอบอะไร (mysql คืนค่าเป็น [rows])
    pool.query.mockResolvedValueOnce([
      [
        { id: 1, name: "ข้าวผัด", price: "60.00", available: 1 },
        { id: 2, name: "ต้มยำกุ้ง", price: "120.00", available: 1 },
      ],
    ]);

    const res = await request(app).get("/menu");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].name).toBe("ข้าวผัด");
  });

  test("คืน 500 เมื่อฐานข้อมูลผิดพลาด", async () => {
    // จำลองว่า query พัง
    pool.query.mockRejectedValueOnce(new Error("DB down"));

    const res = await request(app).get("/menu");

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("DB_ERROR");
  });
});

describe("GET /menu/:id", () => {
  test("คืนเมนูเมื่อพบ id", async () => {
    pool.query.mockResolvedValueOnce([
      [{ id: 1, name: "ข้าวผัด", price: "60.00", available: 1 }],
    ]);

    const res = await request(app).get("/menu/1");

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(1);
  });

  test("คืน 404 เมื่อไม่พบ id", async () => {
    pool.query.mockResolvedValueOnce([[]]); // ไม่มีแถวเลย

    const res = await request(app).get("/menu/999");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  test("คืน 400 เมื่อ id ไม่ใช่ตัวเลข และไม่ยิง query", async () => {
    const res = await request(app).get("/menu/abc");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_ID");
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe("POST /menu", () => {
  test("เพิ่มเมนูใหม่สำเร็จ", async () => {
    pool.query.mockResolvedValueOnce([{ insertId: 5 }]);

    const res = await request(app)
      .post("/menu")
      .send({ name: "ผัดไทย", price: 70 });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe(5);
    // เช็คว่าส่งค่าเข้า query ถูกต้อง (available ไม่ส่งมา → default true)
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO menu_items"),
      ["ผัดไทย", 70, true]
    );
  });

  test("คืน 400 เมื่อข้อมูลไม่ถูกต้อง", async () => {
    const res = await request(app)
      .post("/menu")
      .send({ name: "", price: -1 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe("DELETE /menu/:id", () => {
  test("ลบเมนูสำเร็จ", async () => {
    pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app).delete("/menu/1");

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(1);
  });

  test("คืน 404 เมื่อไม่พบเมนูที่จะลบ", async () => {
    pool.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

    const res = await request(app).delete("/menu/999");

    expect(res.status).toBe(404);
  });
});
