jest.mock("../db", () => ({
  pool: { query: jest.fn() },
}));

const request = require("supertest");
const { pool } = require("../db");
const app = require("../app");

beforeEach(() => {
  jest.resetAllMocks();
});

describe("GET /menu", () => {
  test("คืนรายการเมนูทั้งหมด", async () => {
    pool.query.mockResolvedValueOnce([
      [{ id: 1, name: "ข้าวผัด", price: "60.00", available: 1 }],
    ]);

    const response = await request(app).get("/menu");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].name).toBe("ข้าวผัด");
  });
});

describe("GET /menu/:id", () => {
  test("คืนเมนูเมื่อพบ id", async () => {
    pool.query.mockResolvedValueOnce([
      [{ id: 1, name: "ข้าวผัด", price: "60.00", available: 1 }],
    ]);

    const response = await request(app).get("/menu/1");

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(1);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = ?"),
      [1]
    );
  });

  test("คืน 404 เมื่อไม่พบ id", async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const response = await request(app).get("/menu/999");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });
});

describe("POST /menu", () => {
  test("เพิ่มเมนูใหม่", async () => {
    pool.query.mockResolvedValueOnce([{ insertId: 5 }]);

    const response = await request(app)
      .post("/menu")
      .send({ name: "ข้าวผัด", price: 60 });

    expect(response.status).toBe(201);
    expect(response.body.data.id).toBe(5);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO menu_items"),
      ["ข้าวผัด", 60, true]
    );
  });

  test("คืน 400 เมื่อข้อมูลไม่ถูกต้อง", async () => {
    const response = await request(app)
      .post("/menu")
      .send({ name: "", price: -1 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe("PUT /menu/:id", () => {
  test("แก้ไขเมนูที่มีอยู่", async () => {
    pool.query
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([
        [{ id: 1, name: "ข้าวผัดกุ้ง", price: "70.00", available: 1 }],
      ]);

    const response = await request(app)
      .put("/menu/1")
      .send({ name: "ข้าวผัดกุ้ง", price: 70 });

    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe("ข้าวผัดกุ้ง");
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test("คืน 404 เมื่อไม่พบเมนูที่จะแก้ไข", async () => {
    pool.query
      .mockResolvedValueOnce([{ affectedRows: 0 }])
      .mockResolvedValueOnce([[]]);

    const response = await request(app)
      .put("/menu/999")
      .send({ name: "เมนูใหม่", price: 40 });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });
});

describe("DELETE /menu/:id", () => {
  test("ลบเมนูที่มีอยู่", async () => {
    pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const response = await request(app).delete("/menu/1");

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(1);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM menu_items"),
      [1]
    );
  });

  test("คืน 404 เมื่อไม่พบเมนูที่จะลบ", async () => {
    pool.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

    const response = await request(app).delete("/menu/999");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  test("คืน 409 เมื่อเมนูถูกใช้ในรายการสั่งซื้อ", async () => {
    pool.query.mockRejectedValueOnce({ code: "ER_ROW_IS_REFERENCED_2" });

    const response = await request(app).delete("/menu/1");

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("MENU_IN_USE");
  });
});
