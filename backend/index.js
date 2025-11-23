require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");

// Routes
const enquiryRoutes = require("./routes/enquiryRoutes");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const kbEnquiryRoutes = require("./routes/kbEnquiryRoutes");
const customEnquiryRoutes = require("./routes/customEnquiryRoutes");
const projectsRoutes = require("./routes/projects");
const uploads = require("./routes/uploads");      // <-- these now talk to S3
const importProjectsRouter = require("./routes/importProjects");
const uploadsRouter = require("./routes/getUploads");
const importImages = require("./routes/importImages");
const enquiries = require("./routes/enquiriesRoute");
const verifyFirebaseToken = require("./middleware/verifyFirebaseToken");
const requireAdmin = require("./middleware/requireAdmin");
const adminsRouter = require("./routes/addAdmin");
const testimonials = require("./routes/testimonialsRoutes");
const uploadTestimonialImage = require("./routes/uploadTestimonialImage");
const wardrobeEnquiryRoutes = require("./routes/wardrobeEnquiryRoutes");

const app = express();

/* -------------------- CORS --------------------- */

const rawClientUrl = process.env.CLIENT_URL;
const allowedOrigins = Array.isArray(rawClientUrl)
  ? rawClientUrl
  : String(rawClientUrl).split(",").map(s => s.trim()).filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    console.log("CORS origin header:", origin);
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy: Origin ${origin} not allowed`));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return cors(corsOptions)(req, res, next);
  }
  next();
});

/* -------------------- Body Parser --------------------- */
app.use(bodyParser.json());

/* -------------------- Logging --------------------- */
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

/* -------------------- API Routes --------------------- */

app.use("/api/admins", adminsRouter);
app.use("/api/admin", verifyFirebaseToken, requireAdmin, adminRoutes);
app.use("/api/kb_enquiries", kbEnquiryRoutes);
app.use("/api/custom_enquiries", customEnquiryRoutes);
app.use("/auth", authRoutes);
app.use("/api/enquiries", enquiryRoutes);
app.use("/api/auth", adminRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/wardrobe_enquiries", wardrobeEnquiryRoutes);
// These should be using S3 inside the route handlers:
app.use("/api/uploads", uploads);
app.use("/api/uploads", uploadsRouter);
app.use("/api/import-projects", importProjectsRouter);
app.use("/api/import-images", importImages);
app.use("/api/enquiries", enquiries);
app.use("/api/upload-testimonial-image", uploadTestimonialImage);
app.use("/api/testimonials", testimonials);

/* -------------------- Root --------------------- */

app.get("/", (req, res) => {
  res.send("A10 backend is running 🚀");
});

/* -------------------- Server --------------------- */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
