const express = require("express");
const { pool } = require("./db");

const app = express();
app.use(express.json());

function getMenuId(value) {
  if (!/^\d+$/.test(value)) return null;

  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function isValidMenuItem(item) {
  return (
    item &&
    typeof item.name === "string" &&
    item.name.trim().length > 0 &&
    item.name.length <= 200 &&
    typeof item.price === "number" &&
    Number.isFinite(item.price) &&
    item.price >= 0 &&
    (item.available === undefined ||
      typeof item.available === "boolean" ||
      item.available === 0 ||
      item.available === 1)
  );
}

function sendDatabaseError(res) {
  return res
    .status(500)
    .json({ error: { code: "DB_ERROR", message: "ฐานข้อมูลผิดพลาด" } });
}

app.get("/menu", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, price, available FROM menu_items ORDER BY id"
    );
    return res.status(200).json({ data: rows });
  } catch (error) {
    return sendDatabaseError(res);
  }
});

app.get("/menu/:id", async (req, res) => {
  const id = getMenuId(req.params.id);
  if (id === null) {
    return res
      .status(400)
      .json({ error: { code: "INVALID_ID", message: "id ต้องเป็นจำนวนเต็มบวก" } });
  }

  try {
    const [rows] = await pool.query(
      "SELECT id, name, price, available FROM menu_items WHERE id = ?",
      [id]
    );
    if (rows.length === 0) {
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "ไม่พบเมนู" } });
    }
    return res.status(200).json({ data: rows[0] });
  } catch (error) {
    return sendDatabaseError(res);
  }
});

app.post("/menu", async (req, res) => {
  const item = req.body;
  if (!isValidMenuItem(item)) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "ข้อมูลเมนูไม่ถูกต้อง" },
    });
  }

  const available = item.available === undefined ? true : item.available;
  try {
    const [result] = await pool.query(
      "INSERT INTO menu_items (name, price, available) VALUES (?, ?, ?)",
      [item.name.trim(), item.price, available]
    );
    return res.status(201).json({
      data: {
        id: result.insertId,
        name: item.name.trim(),
        price: item.price,
        available,
      },
    });
  } catch (error) {
    return sendDatabaseError(res);
  }
});

app.put("/menu/:id", async (req, res) => {
  const id = getMenuId(req.params.id);
  if (id === null) {
    return res
      .status(400)
      .json({ error: { code: "INVALID_ID", message: "id ต้องเป็นจำนวนเต็มบวก" } });
  }

  const item = req.body;
  if (!isValidMenuItem(item)) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "ข้อมูลเมนูไม่ถูกต้อง" },
    });
  }

  const available = item.available === undefined ? true : item.available;
  try {
    await pool.query(
      "UPDATE menu_items SET name = ?, price = ?, available = ? WHERE id = ?",
      [item.name.trim(), item.price, available, id]
    );
    const [rows] = await pool.query(
      "SELECT id, name, price, available FROM menu_items WHERE id = ?",
      [id]
    );
    if (rows.length === 0) {
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "ไม่พบเมนู" } });
    }
    return res.status(200).json({ data: rows[0] });
  } catch (error) {
    return sendDatabaseError(res);
  }
});

app.delete("/menu/:id", async (req, res) => {
  const id = getMenuId(req.params.id);
  if (id === null) {
    return res
      .status(400)
      .json({ error: { code: "INVALID_ID", message: "id ต้องเป็นจำนวนเต็มบวก" } });
  }

  try {
    const [result] = await pool.query("DELETE FROM menu_items WHERE id = ?", [
      id,
    ]);
    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "ไม่พบเมนู" } });
    }
    return res.status(200).json({ data: { id } });
  } catch (error) {
    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({
        error: {
          code: "MENU_IN_USE",
          message: "ไม่สามารถลบเมนูที่อยู่ในรายการสั่งซื้อได้",
        },
      });
    }
    return sendDatabaseError(res);
  }
});

module.exports = app;
