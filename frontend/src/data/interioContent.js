// src/data/interioContent.js
// Centralized content for the Interio landing page.
// Keep this file for static hero / services / projects / inspiration data.
// Use root-relative paths (public/) for front-end assets. If you want to
// test with a container-local file, one is included below as DEV local fallback.

const DEV_TEST_LOCAL = "/mnt/data/5d93b9ed-e824-4f8b-958b-aee1b9869dda.png";

export const HERO_SLIDES = [
  {
    id: "hero-1",
    img: "/bedroom1.jpg",
    title: "Design your dream home",
    subtitle: "End-to-end full-home furnishing with curated interiors",
    ctas: [
      { type: "modal", label: "Get Started", action: "openFullHomeModal" }
    ],
  },
  {
    id: "hero-2",
    img: "/kitchenhero.jpg",
    title: "Give your kitchen a fresh life",
    subtitle: "Smart layouts, durable finishes and smart storage",
    ctas: [
      { type: "navigate", label: "Explore Kitchens", to: "/kitchen" }
    ],
  },
  {
    id: "hero-3",
    img: "/commercial.jpg",
    title: "Commercial Interiors",
    subtitle: "Offices | Retail | Hospitality spaces designed to impress",
    ctas: [
      { type: "navigate", label: "Get Quote", to: "/custom" }
    ],
  },
];

export const SERVICES = [
  { id: "full-home", title: "Full Home Furnishing", subtitle: "Complete interiors for every room", img: "/bedroom1.jpg", path: "/home" },
  { id: "kitchen", title: "Kitchen Makeover", subtitle: "Smart kitchens that cook up joy", img: "/kitchen1.jpg", path: "/kitchen" },
  { id: "bathroom", title: "Bathroom Renovation", subtitle: "Luxury & smart wetspaces", img: "/bathroom1.jpg", path: "/bathroom" },
  { id: "wardrobe", title: "Wardrobe", subtitle: "Elegant storage solutions", img: "/wardrobe.jpg", path: "/wardrobe" },
];

export const TRUST_PERKS = [
  { id: 1, title: "Design Experts", desc: "In-house designers & architects", icon: "/businessman.png" },
  { id: 2, title: "End-to-end Delivery", desc: "From design to execution", icon: "/message.png" },
  { id: 3, title: "Quality Materials", desc: "Premium sourced materials", icon: "/quality.png" },
  { id: 4, title: "Transparent Pricing", desc: "No hidden costs", icon: "/price-tag.png" },
];

// Inspiration gallery (uses public assets by default). Includes a local test fallback.
export const INSPIRATIONS = [
  "/kitchen1.jpg",
  "/kitchen1.jpg",
  "/kitchen1.jpg",
  "/kitchen1.jpg", // local container test image (useful in dev/test)
];

// Projects shown on Interio landing — static curated list (same shape as the Projects card expects)
export const PROJECTS = [
  {
    id: "proj-1",
    title: "Cozy Minimal Apartment",
    city: "Kolkata",
    gallery: ["/commercial.jpg", "/projects/proj1-2.jpg"],
    cover_image: "/commercial.jpg",
    size: "1250 sqft",
    theme: "Minimal",
    slug: "cozy-minimal-apartment",
  },
  {
    id: "proj-2",
    title: "Contemporary Kitchen",
    city: "Mumbai",
    gallery: ["/projects/proj2-1.jpg"],
    cover_image: "/projects/proj2-1.jpg",
    size: "650 sqft",
    theme: "Contemporary",
    slug: "contemporary-kitchen",
  },
  {
    id: "proj-3",
    title: "Modern Bathroom Makeover",
    city: "Bengaluru",
    gallery: ["/projects/proj3-1.jpg"],
    cover_image: "/projects/proj3-1.jpg",
    size: "120 sqft",
    theme: "Modern",
    slug: "modern-bathroom",
  },
];

export default {
  HERO_SLIDES,
  SERVICES,
  TRUST_PERKS,
  INSPIRATIONS,
  PROJECTS,
};
