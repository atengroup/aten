// server/routes/wardrobeEnquiryRoutes.js
const express = require("express");
const supabase = require("../supabase"); // your configured supabase client
const router = express.Router();

/**
 * POST /api/wardrobe_enquiries
 * Body expected:
 *  - user_id (number) REQUIRED
 *  - type (string) REQUIRED
 *  - email, city, length, wardrobe_type, material, finish (all optional)
 */
router.post("/", async (req, res) => {
  try {
    const {
      user_id,
      type,
      email,
      city,
      length,
      wardrobe_type,
      material,
      finish,
    } = req.body || {};

    if (!user_id || !type) {
      return res.status(400).json({ error: "user_id and type are required" });
    }

    const insertObj = {
      user_id,
      type,
      email: email || null,
      city: city || null,
      length: length ?? null,
      wardrobe_type: wardrobe_type || null,
      material: material || null,
      finish: finish || null,
      // created_at will be set by DB default
    };

    const { data, error } = await supabase
      .from("wardrobe_enquiries")
      .insert([insertObj])
      .select()
      .maybeSingle();

    if (error) {
      console.error("Supabase insert wardrobe_enquiries error:", error);
      return res.status(500).json({ error: "Database error" });
    }

    const inserted = data || null;
    return res.status(201).json({ id: inserted?.id ?? null, message: "Wardrobe enquiry saved" });
  } catch (err) {
    console.error("POST /api/wardrobe_enquiries unexpected error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/wardrobe_enquiries
 * Query params (optional):
 *  - page (1-based), per_page
 *  - user_id, city, type (filter)
 *  - sort = created_at.asc or created_at.desc
 */
router.get("/", async (req, res) => {
  try {
    const {
      page = 1,
      per_page = 20,
      user_id,
      city,
      type,
      sort = "created_at.desc",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const perPageNum = Math.max(1, Math.min(100, parseInt(per_page, 10) || 20));
    const from = (pageNum - 1) * perPageNum;
    const to = from + perPageNum - 1;

    let query = supabase.from("wardrobe_enquiries").select("*", { count: "exact" });

    if (user_id) query = query.eq("user_id", user_id);
    if (city) query = query.ilike("city", `%${city}%`);
    if (type) query = query.eq("type", type);

    // sort handling (simple, only allow column.direction)
    const [col, dir] = sort.split(".");
    if (col && dir && (dir === "asc" || dir === "desc")) {
      query = query.order(col, { ascending: dir === "asc" });
    }

    const { data, error, count } = await query.range(from, to);

    if (error) {
      console.error("Supabase fetch wardrobe_enquiries error:", error);
      return res.status(500).json({ error: "Database error" });
    }

    return res.json({
      data: data || [],
      meta: {
        page: pageNum,
        per_page: perPageNum,
        total: count ?? null,
        returned: (data || []).length,
      },
    });
  } catch (err) {
    console.error("GET /api/wardrobe_enquiries unexpected error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/wardrobe_enquiries/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "Invalid id" });

    const { data, error } = await supabase
      .from("wardrobe_enquiries")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Supabase fetch wardrobe_enquiry by id error:", error);
      return res.status(500).json({ error: "Database error" });
    }

    if (!data) return res.status(404).json({ error: "Wardrobe enquiry not found" });

    return res.json({ data });
  } catch (err) {
    console.error("GET /api/wardrobe_enquiries/:id unexpected error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * PUT /api/wardrobe_enquiries/:id
 * Body: any updatable fields: email, city, length, wardrobe_type, material, finish, type
 */
router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "Invalid id" });

    const {
      type,
      email,
      city,
      length,
      wardrobe_type,
      material,
      finish,
    } = req.body || {};

    const updateObj = {};
    if (type !== undefined) updateObj.type = type;
    if (email !== undefined) updateObj.email = email || null;
    if (city !== undefined) updateObj.city = city || null;
    if (length !== undefined) updateObj.length = length ?? null;
    if (wardrobe_type !== undefined) updateObj.wardrobe_type = wardrobe_type || null;
    if (material !== undefined) updateObj.material = material || null;
    if (finish !== undefined) updateObj.finish = finish || null;

    if (Object.keys(updateObj).length === 0) {
      return res.status(400).json({ error: "No valid fields provided to update" });
    }

    const { data, error } = await supabase
      .from("wardrobe_enquiries")
      .update(updateObj)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      console.error("Supabase update wardrobe_enquiries error:", error);
      return res.status(500).json({ error: "Database error" });
    }

    return res.json({ message: "Updated", data });
  } catch (err) {
    console.error("PUT /api/wardrobe_enquiries/:id unexpected error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * DELETE /api/wardrobe_enquiries/:id
 */
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "Invalid id" });

    const { error } = await supabase.from("wardrobe_enquiries").delete().eq("id", id);

    if (error) {
      console.error("Supabase delete wardrobe_enquiries error:", error);
      return res.status(500).json({ error: "Database error" });
    }

    return res.json({ message: "Deleted" });
  } catch (err) {
    console.error("DELETE /api/wardrobe_enquiries/:id unexpected error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
