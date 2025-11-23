// src/pages/ProjectsList.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import "../assets/pages/Project.css";
import { getImageUrl } from '../lib/api';
import Dropdown from "../components/Dropdown";

// Backend base: use localhost backend in dev, else same-origin
const BACKEND_BASE =
  import.meta.env.VITE_BACKEND_BASE ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "");

function safeParse(jsonOrString, fallback = []) {
  if (jsonOrString === null || jsonOrString === undefined) return fallback;
  if (Array.isArray(jsonOrString)) return jsonOrString;
  try {
    return JSON.parse(jsonOrString);
  } catch {
    return fallback;
  }
}

export default function ProjectsList() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [locationArea, setLocationArea] = useState("");
  const [configuration, setConfiguration] = useState("");
  const [loading, setLoading] = useState(false);

  // derived filter options (populated after fetch)
  const [propertyTypeOptions, setPropertyTypeOptions] = useState([]);
  const [locationAreaOptions, setLocationAreaOptions] = useState([]);
  const [configurationOptions, setConfigurationOptions] = useState([]);
// Fetch ALL possible filter options once
const [allPropertyTypes, setAllPropertyTypes] = useState([]);
const [allLocationAreas, setAllLocationAreas] = useState([]);
const [allConfigurations, setAllConfigurations] = useState([]);
useEffect(() => {
  const fetchFilterOptions = async () => {
    try {
      const res = await fetch(`${BACKEND_BASE}/api/projects?limit=1000`);
      if (!res.ok) throw new Error("Failed to load options");
      const data = await res.json();
      const raw = data.items || [];

      const types = new Set();
      const areas = new Set();
      const confs = new Set();

      raw.forEach((p) => {
        if (p.property_type) types.add(p.property_type);
        if (p.location_area) areas.add(p.location_area);
        (safeParse(p.configurations, [])).forEach((c) => {
          const name = c?.type || c?.name;
          if (name) confs.add(name);
        });
      });

      const sortedTypes = Array.from(types).sort();
      const sortedAreas = Array.from(areas).sort();
      const sortedConfs = Array.from(confs).sort();

      setAllPropertyTypes(sortedTypes);
      setAllLocationAreas(sortedAreas);
      setAllConfigurations(sortedConfs);

      // Also set current dropdown options
      setPropertyTypeOptions(sortedTypes);
      setLocationAreaOptions(sortedAreas);
      setConfigurationOptions(sortedConfs);
    } catch (err) {
      console.error("Failed to load filter options:", err);
    }
  };

  fetchFilterOptions();
}, [BACKEND_BASE]); // Run once
  /**
   * fetchList(overrides = {})
   * overrides may contain: q, city, property_type, location_area, configuration, page, limit
   * configuration is applied client-side (configurations is JSON array per project)
   */
  const fetchList = async (overrides = {}) => {
    setLoading(true);
    try {
      // compute effective params (overrides take precedence)
      const qParam = overrides.q !== undefined ? overrides.q : q;
      const cityParam = overrides.city !== undefined ? overrides.city : city;
      const propTypeParam = overrides.property_type !== undefined ? overrides.property_type : propertyType;
      const locationParam = overrides.location_area !== undefined ? overrides.location_area : locationArea;
      const pageParam = overrides.page !== undefined ? overrides.page : 1;
      const limitParam = overrides.limit !== undefined ? overrides.limit : 24;
      const configurationParam = overrides.configuration !== undefined ? overrides.configuration : configuration;

      const params = new URLSearchParams();
      if (qParam) params.set("q", qParam);
      if (cityParam) params.set("city", cityParam);
      if (propTypeParam) params.set("property_type", propTypeParam);
      if (locationParam) params.set("location_area", locationParam);
      params.set("page", String(pageParam));
      params.set("limit", String(limitParam));

      const url = `${BACKEND_BASE}/api/projects?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Server ${res.status} ${txt}`);
      }
      const data = await res.json();
      const raw = data.items || [];

      // parse columns safely
      const parsed = raw.map((p) => ({
        ...p,
        gallery: safeParse(p.gallery, []),
        configurations: safeParse(p.configurations, []),
        price_info: (() => {
          try {
            return p.price_info ? JSON.parse(p.price_info) : null;
          } catch {
            return p.price_info || null;
          }
        })(),
      }));

      // apply client-side configuration filter (if requested)
      let filtered = parsed;
      if (configurationParam) {
        const confLower = String(configurationParam).toLowerCase();
        filtered = parsed.filter((p) =>
          (p.configurations || []).some((c) => {
            const t = (c && (c.type || c.name || "")).toString().toLowerCase();
            return t.includes(confLower) || t === confLower;
          })
        );
      }

      setItems(filtered);

      // derive options for selects from raw data (unique values). Keep existing order stable.
      
    } catch (err) {
      console.error("Failed to fetch projects:", err);
      toast.error("Failed to load projects. Check server");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  // initial load
  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // explicit search button behavior (optional)
  const onSearchClick = () => {
    fetchList({ q, city, property_type: propertyType, location_area: locationArea, configuration });
  };

  // handlers that set state AND request fetchList with overrides immediately
  const handlePropertyTypeChange = (v) => {
    setPropertyType(v);
    fetchList({ property_type: v, q, city, location_area: locationArea, configuration });
  };
  const handleLocationAreaChange = (v) => {
    setLocationArea(v);
    fetchList({ location_area: v, q, city, property_type: propertyType, configuration });
  };
  const handleConfigurationChange = (v) => {
    setConfiguration(v);
    fetchList({ configuration: v, q, city, property_type: propertyType, location_area: locationArea });
  };

  return (
    <div className="projects-page">
      <div className="projects-header">
        <h1>Browse Properties</h1>

        <div className="projects-filters" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <input
            aria-label="Search projects"
            placeholder="Search projects..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <input
            aria-label="City"
            placeholder="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />

          {/* Dropdown from your components */}
          <div className="select-wrap" style={{ minWidth: 160 }}>
            <Dropdown
              value={propertyType}
              onChange={(v) => handlePropertyTypeChange(v)}
              options={propertyTypeOptions}
              placeholder="All types"
               includeAll={true}           // <-- shows the "All" option here
              allLabel="All"
            />
          </div>

          <div className="select-wrap" style={{ minWidth: 160 }}>
            <Dropdown
              value={locationArea}
              onChange={(v) => handleLocationAreaChange(v)}
              options={locationAreaOptions}
              placeholder="All areas"
               includeAll={true}        // <-- shows the "All" option here
  allLabel="All"
            />
          </div>

          <div className="select-wrap" style={{ minWidth: 160 }}>
            <Dropdown
              value={configuration}
              onChange={(v) => handleConfigurationChange(v)}
              options={configurationOptions}
              placeholder="Any configuration"
               includeAll={true}           // <-- shows the "All" option here
  allLabel="All"
            />
          </div>

          <button className="btn btn-filter" onClick={onSearchClick}>Search</button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 24 }}>Loading projects…</div>
      ) : items.length === 0 ? (
        <div style={{ padding: 28, color: "#666" }} className="projects-empty">
          No projects found.
          <div style={{ marginTop: 12 }}>
            <button onClick={() => fetchList()} className="btn">Reload</button>
          </div>
        </div>
      ) : (
        <div className="projects-grid">
          {items.map((p) => (
            <article key={p.id} className="project-card">
              <Link to={`/projects/${p.slug}`} className="card-link">
                <div className="card-media">
                  <img src={ getImageUrl((p.thumbnail) || (p.gallery && p.gallery[0]) || "/placeholder.jpg") } alt={p.title} loading="lazy" />
                </div>
                <div className="card-body">
                  <h3>{p.title}</h3>
                  <div className="meta">{p.location_area} — {p.city}</div>
                  <div className="rera">{p.rera}</div>
                  <div className="card-cta">
                    <span className="type">{p.property_type}</span>
                  </div>
                </div>
              </Link>
              <div className="card-actions">
                <a href={`tel:${p.contact_phone}`} className="call">Call</a>
                <a href={`https://wa.me/${(p.contact_phone||"").replace(/\D/g,"")}`} target="_blank" rel="noreferrer" className="wa">WhatsApp</a>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
