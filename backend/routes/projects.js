// server/routes/projects.js
const express = require("express");
const supabase = require("../supabase");
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const router = express.Router();

const slugify = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");

/**
 * Helper: safely parse JSON fields (fallback if DB returns text)
 */
function safeParse(v, fallback = []) {
  if (v === null || v === undefined) return fallback;
  if (Array.isArray(v) || typeof v === "object") return v;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

/**
 * GET /api/projects
 * Supports: ?q, ?city, ?property_type, ?location_area, ?configuration, ?page, ?limit
 * Returns projects with JSON fields parsed.
 */
router.get("/", async (req, res) => {
  try {
    const {
      q,
      city,
      property_type,
      location_area,
      configuration,
      page = 1,
      limit = 24,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page || 1));
    const lim = Math.max(1, parseInt(limit || 24));
    const start = (pageNum - 1) * lim;
    const end = start + lim - 1;

    let query = supabase.from("projects").select("*").order("created_at", { ascending: false });

    // Apply filters
    if (city) {
      query = query.ilike("city", city);
      // note: .ilike expects pattern; to perform equality, use .eq but original used equality case-insensitive.
      // here we'll treat city as exact (case-insensitive)
      query = supabase.from("projects").select("*").ilike("city", city);
    }
    // We'll rebuild query incrementally to apply multiple filters using PostgREST approach:
    // Instead build filters manually:
    let filtered = supabase.from("projects").select("*").order("created_at", { ascending: false });

    if (city) filtered = filtered.ilike("city", city);
    if (property_type) filtered = filtered.ilike("property_type", property_type);
    if (location_area) filtered = filtered.ilike("location_area", location_area);

    if (q) {
      // use ilike on title, address, rera (combine with or)
      const escaped = q.replace(/%/g, "\\%").replace(/_/g, "\\_");
      const pattern = `%${escaped}%`;
      // PostgREST or() expr example: or=(title.ilike.%...%,address.ilike.%...%)
      const orExpr = `title.ilike.${encodeURIComponent(pattern)},address.ilike.${encodeURIComponent(pattern)},rera.ilike.${encodeURIComponent(pattern)}`;
      filtered = filtered.or(orExpr);
    }

    if (configuration) {
      // configuration search via text contains on configurations JSON: use ilike on configurations
      const pattern = `%${configuration}%`;
      filtered = filtered.ilike("configurations", pattern);
    }

    // Apply range for pagination
    const { data: projects, error } = await filtered.range(start, end);

    if (error) {
      console.error("Fetch projects error (supabase):", error);
      return res.status(500).json({ error: error.message || "DB error" });
    }

    const list = (projects || []).map((r) => ({
      ...r,
      configurations: safeParse(r.configurations, []),
      highlights: safeParse(r.highlights, []),
      amenities: safeParse(r.amenities, []),
      gallery: safeParse(r.gallery, []),
      price_info: r.price_info ? safeParse(r.price_info, null) : null,
    }));

    return res.json({ items: list, page: pageNum });
  } catch (err) {
    console.error("GET /api/projects unexpected error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/projects
 * Body: full project object. Creates slug automatically if not provided.
 * Protected.
 */
router.post("/", verifyFirebaseToken, async (req, res) => {
  try {
    const body = req.body || {};
    const slugVal = body.slug ? slugify(body.slug) : slugify(body.title || "");

    const projectObj = {
      slug: slugVal,
      title: body.title || "",
      location_area: body.location_area || "",
      city: body.city || "",
      address: body.address || "",
      rera: body.rera || null,
      status: body.status || null,
      property_type: body.property_type || null,
      configurations: body.configurations || [],
      blocks: body.blocks || null,
      units: body.units || null,
      floors: body.floors || null,
      land_area: body.land_area || null,
      description: body.description || null,
      videos: body.videos || null,
      developer_name: body.developer_name || null,
      developer_logo: body.developer_logo || null,
      developer_description: body.developer_description || null,
      highlights: body.highlights || [],
      amenities: body.amenities || [],
      gallery: body.gallery || [],
      thumbnail: body.thumbnail || null,
      brochure_url: body.brochure_url || null,
      contact_phone: body.contact_phone || null,
      contact_email: body.contact_email || null,
      price_info: body.price_info || null,
    };

    const { data, error } = await supabase
      .from("projects")
      .insert([projectObj])
      .select("id, slug");

    if (error) {
      console.error("Insert project error (supabase):", error);
      return res.status(500).json({ error: error.message || "DB error" });
    }

    const inserted = Array.isArray(data) ? data[0] : data;
    return res.status(201).json({ id: inserted?.id ?? null, slug: inserted?.slug ?? slugVal });
  } catch (err) {
    console.error("POST /api/projects unexpected error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * PUT /api/projects/:id  (update)
 * Protected.
 */
router.put("/:id", verifyFirebaseToken, async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const slugVal = body.slug ? String(body.slug) : slugify(body.title || "");

    const updateObj = {
      slug: slugVal,
      title: body.title || "",
      location_area: body.location_area || "",
      city: body.city || "",
      address: body.address || "",
      rera: body.rera || null,
      status: body.status || null,
      property_type: body.property_type || null,
      configurations: body.configurations || [],
      blocks: body.blocks || null,
      units: body.units || null,
      floors: body.floors || null,
      land_area: body.land_area || null,
      description: body.description || null,
      videos: body.videos || null,
      developer_name: body.developer_name || null,
      developer_logo: body.developer_logo || null,
      developer_description: body.developer_description || null,
      highlights: body.highlights || [],
      amenities: body.amenities || [],
      gallery: body.gallery || [],
      thumbnail: body.thumbnail || null,
      brochure_url: body.brochure_url || null,
      contact_phone: body.contact_phone || null,
      contact_email: body.contact_email || null,
      price_info: body.price_info || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("projects")
      .update(updateObj)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      console.error("Update project error (supabase):", error);
      return res.status(500).json({ error: error.message || "DB error" });
    }

    if (!data) {
      return res.status(404).json({ error: "Not found" });
    }

    const parsed = {
      ...data,
      configurations: safeParse(data.configurations, []),
      highlights: safeParse(data.highlights, []),
      amenities: safeParse(data.amenities, []),
      gallery: safeParse(data.gallery, []),
      price_info: data.price_info ? safeParse(data.price_info, null) : null,
    };

    return res.json({ project: parsed });
  } catch (err) {
    console.error("PUT /api/projects/:id unexpected error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/projects/:id
 * Public endpoint returning single project with parsed JSON fields.
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();

    if (error) {
      console.error("Fetch project error (supabase):", error);
      return res.status(500).json({ error: error.message || "DB error" });
    }
    if (!data) return res.status(404).json({ error: "Not found" });

    const parsed = {
      ...data,
      configurations: data.configurations ? safeParse(data.configurations, []) : [],
      highlights: data.highlights ? safeParse(data.highlights, []) : [],
      amenities: data.amenities ? safeParse(data.amenities, []) : [],
      gallery: data.gallery ? safeParse(data.gallery, []) : [],
      price_info: data.price_info ? safeParse(data.price_info, null) : null,
    };

    return res.json({ project: parsed });
  } catch (err) {
    console.error("GET /api/projects/:id unexpected error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * DELETE /api/projects/:id
 * Protected.
 */
router.delete("/:id", verifyFirebaseToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from("projects").delete().eq("id", id).select("id");

    if (error) {
      console.error("Delete project error (supabase):", error);
      return res.status(500).json({ error: error.message || "DB error" });
    }

    if (!data || (Array.isArray(data) && data.length === 0)) {
      return res.status(404).json({ error: "Not found" });
    }

    return res.json({ message: "Deleted" });
  } catch (err) {
    console.error("DELETE /api/projects/:id unexpected error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
