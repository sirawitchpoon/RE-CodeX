// Multer config. Memory storage in step 4 — step 5 (giveaway routes) will
// move buffers to disk under ${UPLOADS_DIR}/giveaways/<id>.<ext>. The
// limits (8MB, png/jpeg/webp) match the giveaway plan in the handoff.

import multer from "multer";

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`unsupported mime type: ${file.mimetype}`));
    }
  },
});
