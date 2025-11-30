// src/pages/admin/ProjectDetailsSection.jsx
import React from "react";
import styles from "../../assets/pages/admin/ProjectForm.module.css";
import { getImageUrl } from "../../lib/api";

const DEV_FALLBACK_IMAGE = "/mnt/data/cd4227da-020a-4696-be50-0e519da8ac56.png";

export default function ProjectDetailsSection({
  form,
  setField,
  amenityText,
  setAmenityText,
  highlightText,
  setHighlightText,
  addAmenity,
  removeAmenity,
  addHighlight,
  removeHighlight,
  configurations,
  setConfigAt,
  addConfiguration,
  removeConfiguration,
  fileInputRef,
  uploading,
  onFileChange,
  gallery,
  thumbnail,
  setThumbnail,
  removeGalleryItem,
  openUploadsModal,
  videos,
  videoUrlText,
  setVideoUrlText,
  addVideo,
  removeVideo,
  openVideoPreview,
}) {
  return (
    <>
      {/* Configurations */}
      <div className={styles.panels}>
        <div className={styles.panelHeader}>
          <div>
            <h4>Configurations</h4>
            <small>
              Define unit types (e.g., 2 BHK / 3 BHK) with sizes and price
              ranges.
            </small>
          </div>
        </div>

        <div className={styles.configs}>
          {configurations.map((c, idx) => (
            <div className={styles.configRow} key={idx}>
              <input
                className={styles.cfgInput}
                value={c.type}
                onChange={(e) => setConfigAt(idx, { type: e.target.value })}
              />
              <input
                className={styles.cfgInput}
                placeholder="size min (sqft)"
                value={c.size_min}
                onChange={(e) =>
                  setConfigAt(idx, { size_min: e.target.value })
                }
              />
              <input
                className={styles.cfgInput}
                placeholder="size max (sqft)"
                value={c.size_max}
                onChange={(e) =>
                  setConfigAt(idx, { size_max: e.target.value })
                }
              />
              <input
                className={styles.cfgInput}
                placeholder="price min"
                value={c.price_min}
                onChange={(e) =>
                  setConfigAt(idx, { price_min: e.target.value })
                }
              />
              <input
                className={styles.cfgInput}
                placeholder="price max"
                value={c.price_max}
                onChange={(e) =>
                  setConfigAt(idx, { price_max: e.target.value })
                }
              />
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSmall}`}
                onClick={() => removeConfiguration(idx)}
              >
                Remove
              </button>
            </div>
          ))}
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              onClick={addConfiguration}
              className={styles.btn}
            >
              + Add configuration
            </button>
          </div>
        </div>
      </div>

      {/* Amenities & Highlights */}
      <div className={styles.grid2}>
        <div className={styles.panels}>
          <div className={styles.panelHeader}>
            <h4>Amenities</h4>
          </div>
          <div className={styles.chipRow}>
            <input
              className={styles.input}
              value={amenityText}
              onChange={(e) => setAmenityText(e.target.value)}
              placeholder="e.g. Gymnasium"
            />
            <button
              type="button"
              className={styles.btn}
              onClick={addAmenity}
            >
              Add Amenity
            </button>
          </div>
          <div className={styles.chips}>
            {form.amenities.map((a, i) => (
              <span className={styles.chip} key={i}>
                {a}{" "}
                <button type="button" onClick={() => removeAmenity(i)}>
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className={styles.panels}>
          <div className={styles.panelHeader}>
            <h4>Highlights</h4>
          </div>
          <div className={styles.chipRow}>
            <input
              className={styles.input}
              value={highlightText}
              onChange={(e) => setHighlightText(e.target.value)}
              placeholder="e.g. Near Metro"
            />
            <button
              type="button"
              className={styles.btn}
              onClick={addHighlight}
            >
              Add Highlight
            </button>
          </div>
          <div className={styles.chips}>
            {form.highlights.map((h, i) => (
              <span className={styles.chip} key={i}>
                {h}{" "}
                <button type="button" onClick={() => removeHighlight(i)}>
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Gallery */}
      <div className={styles.panels}>
        <div className={styles.panelHeader}>
          <h4>Gallery</h4>
          <small>Select one image as listing thumbnail.</small>
        </div>

        <div className={styles.uploaderRow}>
          <input
            ref={fileInputRef}
            className={styles.hiddenFile}
            type="file"
            accept="image/*"
            multiple
            onChange={onFileChange}
          />
          <button
            type="button"
            className={styles.btn}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? "Uploading..." : "Select & Upload"}
          </button>

          <button
            type="button"
            className={styles.btn}
            onClick={openUploadsModal}
          >
            Select from uploads
          </button>
        </div>

        <div className={styles.galleryPreview}>
          {gallery.map((g, i) => (
            <div key={i} className={styles.galleryItem}>
              <img
                src={getImageUrl(g) || DEV_FALLBACK_IMAGE}
                alt={`gallery-${i}`}
              />
              <div
                style={{
                  position: "absolute",
                  left: 8,
                  bottom: 8,
                  display: "flex",
                  gap: 8,
                }}
              >
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "rgba(255,255,255,0.9)",
                    padding: "4px 6px",
                    borderRadius: 6,
                  }}
                >
                  <input
                    type="radio"
                    name="thumbnail"
                    checked={thumbnail === g}
                    onChange={() => setThumbnail(g)}
                  />
                  <span style={{ fontSize: 12 }}>Thumbnail</span>
                </label>
              </div>
              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => removeGalleryItem(i)}
              >
                Remove
              </button>
            </div>
          ))}
          {gallery.length === 0 && (
            <div className={styles.placeholder}>No images yet.</div>
          )}
        </div>
      </div>

      {/* Videos */}
      <div className={styles.panels}>
        <div className={styles.panelHeader}>
          <h4>Property Videos (YouTube)</h4>
          <small>
            Add YouTube links for walkthroughs / promos. Thumbnails will be
            shown below.
          </small>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <input
            className={styles.input}
            value={videoUrlText}
            onChange={(e) => setVideoUrlText(e.target.value)}
            placeholder="Paste YouTube link or ID"
            style={{ flex: "1 1 auto" }}
          />
          <button type="button" className={styles.btn} onClick={addVideo}>
            Add Video
          </button>
        </div>

        <div className={styles.galleryPreview}>
          {videos && videos.length > 0 ? (
            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              {videos.map((v, i) => (
                <div
                  key={v.id || i}
                  className={`${styles.galleryItem} ${styles.videoItem}`}
                >
                  <div
                    style={{
                      position: "relative",
                      width: "100%",
                      height: 110,
                      overflow: "hidden",
                    }}
                  >
                    <img
                      className={styles.videoThumb}
                      src={v.thumbnail}
                      alt={`video-${i}`}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = `https://img.youtube.com/vi/${v.id}/hqdefault.jpg`;
                      }}
                    />
                    <button
                      className={styles.playOverlay}
                      type="button"
                      onClick={() => openVideoPreview(v)}
                      title="Play video"
                    >
                      ▶
                    </button>
                  </div>
                  <div className={styles.videoControls}>
                    <button
                      type="button"
                      className={styles.btn}
                      onClick={() => openVideoPreview(v)}
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      className={styles.btn}
                      onClick={() => removeVideo(i)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.placeholder}>No videos added.</div>
          )}
        </div>
      </div>
    </>
  );
}
