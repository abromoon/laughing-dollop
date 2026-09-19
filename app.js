"use strict";

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("file-input");
const browseBtn = document.getElementById("browse-btn");

const editor = document.getElementById("editor");
const previewImg = document.getElementById("preview-img");
const cropOverlay = document.getElementById("crop-overlay");
const dimensionsEl = document.getElementById("dimensions");
const anchorSelect = document.getElementById("anchor-select");
const formatNote = document.getElementById("format-note");
const confirmBtn = document.getElementById("confirm-btn");
const resetBtn = document.getElementById("reset-btn");

// Форматы, которые Canvas API кодирует по-настоящему без потерь.
const LOSSLESS_TYPES = new Set(["image/png"]);
// Форматы, которые Canvas умеет сохранять напрямую (пусть и с перекодированием).
const CANVAS_EXPORTABLE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

let state = {
  file: null,
  objectUrl: null,
  image: null, // HTMLImageElement, уже загружен
  width: 0,
  height: 0,
};

function resetState() {
  if (state.objectUrl) {
    URL.revokeObjectURL(state.objectUrl);
  }
  state = { file: null, objectUrl: null, image: null, width: 0, height: 0 };
  fileInput.value = "";
  editor.hidden = true;
  dropzone.hidden = false;
}

function openFileDialog() {
  fileInput.click();
}

dropzone.addEventListener("click", openFileDialog);
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    openFileDialog();
  }
});
browseBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  openFileDialog();
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files && fileInput.files[0];
  if (file) loadFile(file);
});

["dragenter", "dragover"].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.add("dropzone--active");
  });
});

["dragleave", "dragend"].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove("dropzone--active");
  });
});

dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropzone.classList.remove("dropzone--active");
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (file) loadFile(file);
});

function loadFile(file) {
  if (!file.type.startsWith("image/")) {
    alert("Пожалуйста, выберите файл изображения.");
    return;
  }

  if (state.objectUrl) {
    URL.revokeObjectURL(state.objectUrl);
  }

  const objectUrl = URL.createObjectURL(file);
  const img = new Image();

  img.onload = () => {
    state.file = file;
    state.objectUrl = objectUrl;
    state.image = img;
    state.width = img.naturalWidth;
    state.height = img.naturalHeight;

    previewImg.src = objectUrl;
    dimensionsEl.textContent = `${state.width}×${state.height} px, исходный формат: ${file.type || "неизвестен"}`;

    updateFormatNote(file.type);
    updateOverlay();

    dropzone.hidden = true;
    editor.hidden = false;
  };

  img.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    alert("Не удалось прочитать файл как изображение.");
  };

  img.src = objectUrl;
}

function computeCropBox(anchor, w, h) {
  const side = Math.min(w, h);
  const x = anchor === "left" ? 0 : anchor === "right" ? w - side : (w - side) / 2;
  const y = anchor === "top" ? 0 : anchor === "bottom" ? h - side : (h - side) / 2;
  return { x: Math.round(x), y: Math.round(y), side };
}

function updateOverlay() {
  if (!state.image) return;
  const { x, y, side } = computeCropBox(anchorSelect.value, state.width, state.height);

  cropOverlay.style.left = `${(x / state.width) * 100}%`;
  cropOverlay.style.top = `${(y / state.height) * 100}%`;
  cropOverlay.style.width = `${(side / state.width) * 100}%`;
  cropOverlay.style.height = `${(side / state.height) * 100}%`;
}

anchorSelect.addEventListener("change", updateOverlay);

function updateFormatNote(mimeType) {
  if (LOSSLESS_TYPES.has(mimeType)) {
    formatNote.hidden = true;
    return;
  }

  if (mimeType === "image/jpeg") {
    formatNote.textContent =
      "JPEG в браузере невозможно обрезать совсем без перекодирования — при сохранении файл будет пережат заново с максимальным качеством (потери минимальны, но не гарантированно нулевые).";
  } else if (mimeType === "image/webp") {
    formatNote.textContent =
      "WebP при обрезке в браузере перекодируется заново с максимальным качеством (потери минимальны, но не гарантированно нулевые).";
  } else if (CANVAS_EXPORTABLE_TYPES.has(mimeType)) {
    formatNote.textContent = "Изображение будет пересохранено без потерь.";
    formatNote.hidden = true;
    return;
  } else {
    formatNote.textContent = `Формат «${mimeType || "неизвестен"}» браузер не умеет сохранять напрямую — результат будет сохранён как PNG (без потерь).`;
  }

  formatNote.hidden = false;
}

function pickExportType(mimeType) {
  if (CANVAS_EXPORTABLE_TYPES.has(mimeType)) return mimeType;
  return "image/png";
}

function extensionFor(mimeType) {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    default:
      return "png";
  }
}

function baseNameOf(fileName) {
  const idx = fileName.lastIndexOf(".");
  return idx > 0 ? fileName.slice(0, idx) : fileName;
}

confirmBtn.addEventListener("click", () => {
  if (!state.image) return;

  const anchor = anchorSelect.value;
  const { x, y, side } = computeCropBox(anchor, state.width, state.height);

  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(state.image, x, y, side, side, 0, 0, side, side);

  const exportType = pickExportType(state.file.type);
  const quality = exportType === "image/png" ? undefined : 1.0;

  canvas.toBlob(
    (blob) => {
      if (!blob) {
        alert("Не удалось создать файл изображения.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseNameOf(state.file.name)}_square_${anchor}.${extensionFor(exportType)}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    exportType,
    quality
  );
});

resetBtn.addEventListener("click", resetState);
