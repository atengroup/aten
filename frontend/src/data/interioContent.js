// src/data/interioContent.js
// Centralized content for the Interio landing page.
// Keep this file for static hero / services / projects / inspiration data.
// Use root-relative paths (public/) for front-end assets. If you want to
// test with a container-local file, one is included below as DEV local fallback.

const DEV_TEST_LOCAL = "/mnt/data/5d93b9ed-e824-4f8b-958b-aee1b9869dda.png";

export const HERO_SLIDES = [
  {
    id: "hero-1",
    img: "/bedroom3.webp",
    title: "Design your dream home",
    subtitle: "End-to-end full-home furnishing with curated interiors",
    ctas: [
      { type: "modal", label: "Get Started", action: "openFullHomeModal" }
    ],
  },
  {
    id: "hero-2",
    img: "/kitchenhero.webp",
    title: "Give your kitchen a fresh life",
    subtitle: "Smart layouts, durable finishes and smart storage",
    ctas: [
      { type: "navigate", label: "Explore Kitchens", to: "/kitchen" }
    ],
  },
  {
    id: "hero-3",
    img: "/commercial1.webp",
    title: "Commercial Interiors",
    subtitle: "Offices | Retail | Hospitality spaces designed to impress",
    ctas: [
      { type: "navigate", label: "Get Quote", to: "/custom" }
    ],
  },
];

export const SERVICES = [
  { id: "full-home", title: "Full Home Furnishing", subtitle: "Complete interiors for every room", img: "/bedroom1.webp", path: "/home" },
  { id: "kitchen", title: "Kitchen Makeover", subtitle: "Smart kitchens that cook up joy", img: "/kitchen1.webp", path: "/kitchen" },
  { id: "bathroom", title: "Bathroom Renovation", subtitle: "Luxury & smart wetspaces", img: "/bathroomservice.webp", path: "/bathroom" },
  { id: "wardrobe", title: "Wardrobe", subtitle: "Elegant storage solutions", img: "/wardrobe.webp", path: "/wardrobe" },
];

export const TRUST_PERKS = [
  { id: 1, title: "Design Experts", desc: "In-house designers & architects", icon: "/businessman.png" },
  { id: 2, title: "End-to-end Delivery", desc: "From design to execution", icon: "/message.png" },
  { id: 3, title: "Quality Materials", desc: "Premium sourced materials", icon: "/quality.png" },
  { id: 4, title: "Transparent Pricing", desc: "No hidden costs", icon: "/price-tag.png" },
];

// src/data/interioContent.js

export const INSPIRATIONS = [
  {
    id: "living-room",
    title: "Living Room Designs",
    // thumbnail shown in the track
    cover: "/living-i1.webp",
    // all images that will show in the modal (can be Supabase or Google Drive links)
    images: [
      "/living-i1.webp",
      "/living-i2.webp",
      "/living-i3.webp",
    ],
  },
  {
    id: "kitchen",
    title: "Kitchen Inspirations",
    cover: "/kitchen-i1.webp",
    images: [
      "/kitchen-i1.webp",
      "/kitchen-i2.webp",

    ],
  },
   {
    id: "bedroom",
    title: "Bedroom Inspirations",
    cover: "/bedroom-i1.webp",
    images: [
      "/bedroom-i1.webp",
      "/bedroom-i2.webp",

    ],
  },
   {
    id: "bathroom",
    title: "Bathroom Inspirations",
    cover: "/bathroom-i1.webp",
    images: [
      "/bathroom-i1.webp",
      "/bathroom-i2.webp",
      "/bathroom-i3.webp",

    ],
  },  {
    id: "kids-room",
    title: "Kids Room Inspirations",
    cover: "/kr-i1.webp",
    images: [
      "/kr-i1.webp",
      "/kr-i2.webp",
      "/kr-i3.webp",

    ],
  },
  // you can still have simple strings; they will be treated as 1-image groups
  // "/kitchen1.webp",
];


// Projects shown on Interio landing — static curated list (same shape as the Projects card expects)
export const PROJECTS = [
  {
    id: "proj-1",
    title: "Modern Apartment",
    city: "Kolkata",
    gallery: ["/inp/proj-1-1.webp", "/inp/proj-1-2.webp","/inp/proj-1-3.webp","/inp/proj-1-4.webp"],
    cover_image: "/inp/proj-1-4.webp",
    size: "1250 sqft",
    theme: "Modern",
    slug: "cozy-minimal-apartment",
  },
 
];

export default {
  HERO_SLIDES,
  SERVICES,
  TRUST_PERKS,
  INSPIRATIONS,
  PROJECTS,
};
