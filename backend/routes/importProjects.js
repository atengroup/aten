// server/routes/importProjects.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const axios = require("axios");
const AdmZip = require("adm-zip");
const xlsx = require("xlsx");
const crypto = require("crypto");
const supabase = require("../supabase");
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");

const BUCKET = "uploads"; // change if your bucket name differs
const IMAGE_EXTS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".bmp",
  ".svg",
]);

// multer memory storage (we operate on buffers)
const upload = multer({ storage: multer.memoryStorage() });

/** Helper: generate short unique filename keeping extension */
function makeFilename(ext = "") {
  const basename = crypto.randomBytes(8).toString("hex");
  return `${basename}${ext}`;
}

/** Helper: upload buffer to Supabase storage and return path + publicUrl */
async function uploadBufferToStorage(buffer, destPath) {
  const { error } = await supabase.storage.from(BUCKET).upload(destPath, buffer, {
    cacheControl: "3600",
    upsert: false,
    contentType: undefined, // let Supabase infer
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(destPath);
  return { path: destPath, publicUrl: data?.publicUrl || null };
}

/** Helper: fetch remote url and upload to storage; returns saved path or null */
async function fetchAndSaveUrl(url) {
  try {
    const res = await axios.get(url, { responseType: "arraybuffer", timeout: 20000 });
    const ct = (res.headers["content-type"] || "").toLowerCase();
    let ext = ".jpg";
    if (ct.includes("png")) ext = ".png";
    else if (ct.includes("jpeg") || ct.includes("jpg")) ext = ".jpg";
    else if (ct.includes("gif")) ext = ".gif";
    else {
      // try to infer ext from URL
      const parsed = new URL(url, "http://example.com");
      const pext = parsed.pathname.split(".").pop();
      if (pext && pext.length <= 5) ext = `.${pext}`;
    }
    const filename = makeFilename(ext);
    const destPath = `projects/${filename}`;
    const uploaded = await uploadBufferToStorage(Buffer.from(res.data), destPath);
    // return storage path (prefixed) for gallery consistency
    return uploaded.publicUrl ? uploaded.publicUrl : `/storage/${BUCKET}/${destPath}`;
  } catch (err) {
    console.warn("fetchAndSaveUrl error", url, err && err.message);
    return null;
  }
}

/**
 * POST /api/import-projects
 * multipart/form-data:
 *  - file: .xlsx (required)
 *  - images_zip: .zip (optional)
 */
router.post(
  "/",
  verifyFirebaseToken,
  upload.fields([{ name: "file", maxCount: 1 }, { name: "images_zip", maxCount: 1 }]),
  async (req, res) => {
    try {
      if (!req.files || !req.files.file || req.files.file.length === 0) {
        return res.status(400).json({ error: "Excel file (.xlsx) is required (field name: file)" });
      }

      // Read excel from buffer
      const excelBuffer = req.files.file[0].buffer;
      const workbook = xlsx.read(excelBuffer, { type: "buffer", cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

      // If ZIP provided, extract entries and upload each image to Supabase storage, keep map name -> publicUrl
      const zipMap = {}; // originalName -> publicUrl
      if (req.files && req.files.images_zip && req.files.images_zip.length) {
        try {
          const zipBuf = req.files.images_zip[0].buffer;
          const zip = new AdmZip(zipBuf);
          const entries = zip.getEntries();
          for (const entry of entries) {
            if (entry.isDirectory) continue;
            const entryName = entry.entryName;
            const ext = entryName.includes(".") ? entryName.slice(entryName.lastIndexOf(".")).toLowerCase() : "";
            if (!IMAGE_EXTS.has(ext)) continue;
            const outName = makeFilename(ext);
            const destPath = `projects/${outName}`;
            try {
              const uploaded = await uploadBufferToStorage(entry.getData(), destPath);
              zipMap[path.basename(entryName)] = uploaded.publicUrl || uploaded.path;
            } catch (e) {
              console.warn("Failed to upload zip entry:", entryName, e && e.message);
            }
          }
        } catch (e) {
          console.warn("ZIP processing failed:", e && e.message);
        }
      }

      const inserted = [];
      const errors = [];

      // utility fn: split csv/newline into array
      const splitToArray = (v) => {
        if (!v) return [];
        if (Array.isArray(v)) return v;
        if (typeof v === "string") return v.split(/[,|\n]+/).map((s) => s.trim()).filter(Boolean);
        return [];
      };

      // iterate rows
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const rawRow = rows[rowIndex];
        const r = {};
        Object.keys(rawRow).forEach((k) => {
          r[k.toString().trim().toLowerCase()] = rawRow[k];
        });

        const title = String(r.title || r.name || "").trim();
        const city = String(r.city || "").trim();
        if (!title || !city) {
          errors.push({ row: rowIndex + 1, error: "Missing required title or city", data: r });
          continue;
        }

        // Gallery parsing (URLs or filenames)
        const galleryArr = [];
        if (r.gallery) {
          const raw = String(r.gallery || "");
          const parts = raw.split(/[,|\n]+/).map((s) => s.trim()).filter(Boolean);
          for (const p of parts) {
            try {
              if (/^https?:\/\//i.test(p)) {
                const savedUrl = await fetchAndSaveUrl(p);
                if (savedUrl) galleryArr.push(savedUrl);
              } else if (zipMap[p]) {
                galleryArr.push(zipMap[p]);
              } else if (p.startsWith("/uploads/") || p.startsWith("uploads/") || p.startsWith("/storage/")) {
                // if someone provided server path or public url, keep as-is (prefer public url)
                galleryArr.push(p);
              } else if (p.match(/\.[a-z]{2,5}$/i) && !p.includes(" ")) {
                // try as URL
                const tryUrl = p.startsWith("//") ? `https:${p}` : `http://${p}`;
                const saved = await fetchAndSaveUrl(tryUrl);
                if (saved) galleryArr.push(saved);
              } else {
                // ignore unknown token
              }
            } catch (err) {
              console.warn("Gallery item processing failed", p, err && err.message);
            }
          }
        }

        // videos: accept comma/newline separated
        const videosArrRaw = splitToArray(r.videos || r.video || "");
        const videosArr = videosArrRaw.map((t) => String(t).trim()).filter(Boolean);

        // configurations
        let configurationsParsed = [];
        if (r.configurations) {
          if (typeof r.configurations === "string") {
            try {
              configurationsParsed = JSON.parse(r.configurations);
            } catch {
              configurationsParsed = splitToArray(r.configurations);
            }
          } else if (Array.isArray(r.configurations)) {
            configurationsParsed = r.configurations;
          } else {
            configurationsParsed = [];
          }
        }

        // helper to split highlights/amenities
        const highlights = splitToArray(r.highlights || "");
        const amenities = splitToArray(r.amenities || "");

        const projectObj = {
          slug: r.slug || null,
          title,
          location_area: r.location_area || null,
          city,
          address: r.address || null,
          rera: r.rera || null,
          status: r.status || null,
          property_type: r.property_type || null,
          configurations: configurationsParsed || [],
          blocks: r.blocks || null,
          units: r.units || null,
          floors: r.floors || null,
          land_area: r.land_area || null,
          description: r.description || null,
          videos: videosArr || [],
          developer_name: r.developer_name || null,
          developer_logo: r.developer_logo || null,
          developer_description: r.developer_description || null,
          highlights,
          amenities,
          gallery: galleryArr,
          thumbnail: galleryArr.length ? galleryArr[0] : null,
          brochure_url: r.brochure_url || null,
          contact_phone: r.contact_phone || null,
          contact_email: r.contact_email || null,
          price_info: r.price_info || null,
        };

        // slugify function
        const slugify = (s) =>
          String(s || "")
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-_]/g, "");

        const slugVal = projectObj.slug ? slugify(projectObj.slug) : slugify(projectObj.title);
        projectObj.slug = slugVal;

        // Insert into Supabase
        try {
          // Insert; if slug collision happens, return error (you can also use upsert)
          const { data: inserted, error: insertErr } = await supabase
            .from("projects")
            .insert([projectObj])
            .select("id, slug, title")
            .maybeSingle();

          if (insertErr) {
            // handle unique key error on slug gracefully
            console.error("Supabase insert error row", rowIndex + 1, insertErr);
            errors.push({ row: rowIndex + 1, error: insertErr.message || insertErr, title });
            continue;
          }

          if (inserted) {
            inserted.push && inserted.push; // no-op to avoid linter confusion
          }

          // push summary
          inserted.push({ id: inserted?.id ?? null, slug: inserted?.slug ?? slugVal, title: inserted?.title ?? title });
        } catch (err) {
          console.error("Insert exception", err);
          errors.push({ row: rowIndex + 1, error: err.message || String(err), title });
        }
      } // end rows loop

      return res.json({ imported: inserted.length, items: inserted, errors });
    } catch (err) {
      console.error("Import error:", err);
      return res.status(500).json({ error: err.message || String(err) });
    }
  }
);

module.exports = router;
