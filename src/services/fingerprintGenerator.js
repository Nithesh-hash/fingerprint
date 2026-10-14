// Mathematical Biometric Fingerprint Generator & Minutiae Extractor
// Generates realistic heightfield matrices (grayscale 0-255) for 3D elevation displacement

export const PATTERN_TYPES = {
  WHORL: 'Concentric Whorl',
  LEFT_LOOP: 'Left Radial Loop',
  RIGHT_LOOP: 'Right Ulnar Loop',
  PLAIN_ARCH: 'Plain Arch',
  TENTED_ARCH: 'Tented Arch',
  PROCEDURAL: 'Cyber Procedural'
};

// Generates heightfield 2D array and detected minutiae
export function generateFingerprintData(type = PATTERN_TYPES.WHORL, width = 128, height = 144, seed = Math.random()) {
  const data = new Uint8Array(width * height);
  const cx = width / 2;
  const cy = height * 0.48;
  const frequency = 0.28; // Ridge density
  
  // Seed offsets
  const sX = Math.sin(seed * 42.1) * 10;
  const sY = Math.cos(seed * 31.7) * 10;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const dx = (x - cx) / (width * 0.5);
      const dy = (y - cy) / (height * 0.5);
      const r = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);

      // Boundary elliptical mask with soft falloff
      const boundaryRadius = Math.sqrt((dx * 0.85) * (dx * 0.85) + (dy * 0.72) * (dy * 0.72));
      const mask = Math.max(0, Math.min(1, (1.0 - boundaryRadius) * 4));

      let ridgeVal = 0;

      switch (type) {
        case PATTERN_TYPES.WHORL: {
          // Double spiral / concentric whorl with delta disturbances
          const spiral = r * 38 + angle * 0.6 + Math.sin(r * 12 + angle * 2) * 0.35;
          const deltaLeft = Math.hypot(dx + 0.55, dy - 0.35);
          const deltaRight = Math.hypot(dx - 0.55, dy - 0.35);
          const deltaFactor = Math.sin(deltaLeft * 25) * Math.sin(deltaRight * 25) * 0.25;
          ridgeVal = Math.sin(spiral + deltaFactor + sX * 0.05);
          break;
        }

        case PATTERN_TYPES.LEFT_LOOP: {
          // Loop sweeping in from the left, curving over the core, and exiting left
          const loopDist = Math.hypot(dx + 0.18, dy * 0.9);
          const sweep = (dx * 2.2 + Math.pow(Math.abs(dy), 1.3) * 3.5) * 8;
          const curve = Math.sin(loopDist * 32 + sweep * 0.4);
          ridgeVal = curve;
          break;
        }

        case PATTERN_TYPES.RIGHT_LOOP: {
          // Loop sweeping in from the right, curving over the core, and exiting right
          const loopDist = Math.hypot(dx - 0.18, dy * 0.9);
          const sweep = (-dx * 2.2 + Math.pow(Math.abs(dy), 1.3) * 3.5) * 8;
          const curve = Math.sin(loopDist * 32 + sweep * 0.4);
          ridgeVal = curve;
          break;
        }

        case PATTERN_TYPES.TENTED_ARCH: {
          // Sharp tent-like peak ascending in the center
          const tent = Math.abs(dx) * 8 + Math.exp(-Math.abs(dx) * 4) * 6;
          const waves = dy * 28 + tent;
          ridgeVal = Math.sin(waves);
          break;
        }

        case PATTERN_TYPES.PLAIN_ARCH: {
          // Gentle wave arches from one side to the other
          const arch = Math.sin(dx * 2.5) * 2.2 + dy * 24;
          ridgeVal = Math.sin(arch);
          break;
        }

        case PATTERN_TYPES.PROCEDURAL:
        default: {
          // Multiscale harmonics + turbulence
          const n1 = Math.sin(x * frequency * 0.8 + Math.cos(y * frequency * 0.7) * 3.2);
          const n2 = Math.cos(y * frequency * 0.8 + Math.sin(x * frequency * 0.6) * 3.2);
          const n3 = Math.sin(r * 32 + angle * 3);
          ridgeVal = (n1 + n2 + n3) / 3;
          break;
        }
      }

      // Add micro-texture (sweat pores & subtle natural biometric noise)
      const poreNoise = (Math.sin(x * 1.8) * Math.cos(y * 1.8) > 0.85) ? -0.35 : 0;
      const combined = ridgeVal + poreNoise;

      // Normalize into high-contrast 0 - 255 grayscale
      let normalized = Math.floor(((combined + 1) / 2) * 255);
      // Apply biometric finger boundary mask
      normalized = Math.floor(normalized * mask);

      data[idx] = Math.max(0, Math.min(255, normalized));
    }
  }

  // Detect biometric minutiae (Ridge Endings & Bifurcations)
  const minutiae = detectMinutiae(data, width, height);

  return {
    data,
    width,
    height,
    type,
    minutiae,
    timestamp: Date.now()
  };
}

// Scans local 3x3 pixel neighborhoods to extract feature points (Crossing Number method)
function detectMinutiae(data, width, height) {
  const minutiae = [];
  const threshold = 140; // Ridge threshold
  const step = 4; // Sample step for clean visual distribution

  for (let y = 14; y < height - 14; y += step) {
    for (let x = 14; x < width - 14; x += step) {
      const idx = y * width + x;
      const val = data[idx];
      if (val < threshold) continue;

      // 8-neighborhood binary pattern
      const p = [
        data[(y - 1) * width + x] >= threshold ? 1 : 0,
        data[(y - 1) * width + (x + 1)] >= threshold ? 1 : 0,
        data[y * width + (x + 1)] >= threshold ? 1 : 0,
        data[(y + 1) * width + (x + 1)] >= threshold ? 1 : 0,
        data[(y + 1) * width + x] >= threshold ? 1 : 0,
        data[(y + 1) * width + (x - 1)] >= threshold ? 1 : 0,
        data[y * width + (x - 1)] >= threshold ? 1 : 0,
        data[(y - 1) * width + (x - 1)] >= threshold ? 1 : 0,
      ];

      // Crossing number: half of sum of transitions between adjacent neighbors
      let transitions = 0;
      for (let i = 0; i < 8; i++) {
        transitions += Math.abs(p[i] - p[(i + 1) % 8]);
      }
      const cn = transitions / 2;

      // CN = 1 => Ridge Ending, CN = 3 => Bifurcation
      if (cn === 1 && Math.random() > 0.72) {
        minutiae.push({
          type: 'ending',
          x,
          y,
          elevation: val / 255,
          angle: Math.atan2(y - height / 2, x - width / 2)
        });
      } else if (cn === 3 && Math.random() > 0.75) {
        minutiae.push({
          type: 'bifurcation',
          x,
          y,
          elevation: val / 255,
          angle: Math.atan2(y - height / 2, x - width / 2)
        });
      }
    }
  }

  // Cap minutiae count to 25 prominent features for clarity
  return minutiae.slice(0, 25);
}

// High-pass Unsharp Mask filter to isolate real epidermal friction ridges from lighting/shadows
export function enhanceRidgeContrast(rawGrayscale, width, height, boost = 2.4) {
  const result = new Uint8Array(width * height);
  const blur = new Float32Array(width * height);
  const radius = 3;

  // Horizontal blur pass
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        if (nx >= 0 && nx < width) {
          sum += rawGrayscale[rowOffset + nx];
          count++;
        }
      }
      blur[rowOffset + x] = sum / count;
    }
  }

  // Vertical blur pass + high-pass unsharp mask
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny >= 0 && ny < height) {
          sum += blur[ny * width + x];
          count++;
        }
      }
      const localMean = sum / count;
      const original = rawGrayscale[y * width + x];

      // Ridge detail calculation (boost difference from local baseline)
      const diff = (original - localMean) * boost;
      let val = Math.round(128 + diff);
      if (val < 0) val = 0;
      if (val > 255) val = 255;
      result[y * width + x] = val;
    }
  }

  return result;
}

// Extract real-time fingerprint frame directly from active mobile video element
export function processCameraVideoFrame(videoElement, targetWidth = 128, targetHeight = 144, contrastBoost = 2.4) {
  if (!videoElement || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
    throw new Error('Video stream not ready');
  }

  const vW = videoElement.videoWidth;
  const vH = videoElement.videoHeight;

  // Crop square / central region of interest (ROI) where user centers their finger
  const cropSize = Math.min(vW, vH) * 0.65;
  const cropX = (vW - cropSize) / 2;
  const cropY = (vH - cropSize) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create canvas context');

  // Draw central finger ROI scaled to target resolution
  ctx.drawImage(
    videoElement,
    cropX, cropY, cropSize, cropSize,
    0, 0, targetWidth, targetHeight
  );

  const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const raw = imgData.data;
  const rawGrayscale = new Uint8Array(targetWidth * targetHeight);

  // Extract luminance using green/red balance optimal for dermal skin under camera light
  for (let i = 0; i < rawGrayscale.length; i++) {
    const r = raw[i * 4];
    const g = raw[i * 4 + 1];
    const b = raw[i * 4 + 2];
    // Under skin illumination, green and red channel differences highlight papillary ridges
    const luma = 0.25 * r + 0.65 * g + 0.10 * b;
    rawGrayscale[i] = Math.round(luma);
  }

  // Apply high-pass contrast enhancement to isolate dermal ridges
  const enhancedData = enhanceRidgeContrast(rawGrayscale, targetWidth, targetHeight, contrastBoost);
  const minutiae = detectMinutiae(enhancedData, targetWidth, targetHeight);

  return {
    data: enhancedData,
    width: targetWidth,
    height: targetHeight,
    type: 'Real Mobile Optical Camera Scan',
    minutiae,
    timestamp: Date.now()
  };
}

// Convert user uploaded image or camera snapshot into biometric grayscale data
export function processUploadedImage(file, targetWidth = 128, targetHeight = 144) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas 2d context'));
          return;
        }

        // Draw image fit within canvas
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        const hRatio = targetWidth / img.width;
        const vRatio = targetHeight / img.height;
        const ratio = Math.min(hRatio, vRatio);
        const centerShiftX = (targetWidth - img.width * ratio) / 2;
        const centerShiftY = (targetHeight - img.height * ratio) / 2;

        ctx.drawImage(img, 0, 0, img.width, img.height,
          centerShiftX, centerShiftY, img.width * ratio, img.height * ratio);

        const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
        const raw = imgData.data;
        const rawGrayscale = new Uint8Array(targetWidth * targetHeight);

        for (let i = 0; i < rawGrayscale.length; i++) {
          const r = raw[i * 4];
          const g = raw[i * 4 + 1];
          const b = raw[i * 4 + 2];
          const luma = 0.299 * r + 0.587 * g + 0.114 * b;
          rawGrayscale[i] = Math.round(luma);
        }

        // Enhance dermal ridge contrast
        const enhancedData = enhanceRidgeContrast(rawGrayscale, targetWidth, targetHeight, 2.0);
        const minutiae = detectMinutiae(enhancedData, targetWidth, targetHeight);

        resolve({
          data: enhancedData,
          width: targetWidth,
          height: targetHeight,
          type: 'Real Finger Photo Import',
          minutiae,
          timestamp: Date.now()
        });
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
