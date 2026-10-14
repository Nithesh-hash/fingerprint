// 3D Model & Biometric Data Exporter (STL for 3D Printing, OBJ, PNG Snapshot, JSON)

// Generates an ASCII/Binary STL file from heightfield data
export function exportToSTL(data, width, height, heightScale = 1.0, baseThickness = 1.5) {
  const meshW = width;
  const meshH = height;
  const spacing = 0.5; // mm per pixel

  let stl = 'solid IsoMatrix_3D_Topography\n';

  // Helper to format facet
  function addTriangle(p1, p2, p3) {
    // Compute normal
    const ax = p2.x - p1.x, ay = p2.y - p1.y, az = p2.z - p1.z;
    const bx = p3.x - p1.x, by = p3.y - p1.y, bz = p3.z - p1.z;
    let nx = ay * bz - az * by;
    let ny = az * bx - ax * bz;
    let nz = ax * by - ay * bx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;

    stl += `  facet normal ${nx.toFixed(4)} ${ny.toFixed(4)} ${nz.toFixed(4)}\n`;
    stl += '    outer loop\n';
    stl += `      vertex ${p1.x.toFixed(3)} ${p1.y.toFixed(3)} ${p1.z.toFixed(3)}\n`;
    stl += `      vertex ${p2.x.toFixed(3)} ${p2.y.toFixed(3)} ${p2.z.toFixed(3)}\n`;
    stl += `      vertex ${p3.x.toFixed(3)} ${p3.y.toFixed(3)} ${p3.z.toFixed(3)}\n`;
    stl += '    endloop\n';
    stl += '  endfacet\n';
  }

  // Get vertex (x, y, z)
  function getV(x, y) {
    const val = data[y * width + x] || 0;
    const elevation = (val / 255) * 4.0 * heightScale + baseThickness;
    return {
      x: (x - meshW / 2) * spacing,
      y: (y - meshH / 2) * spacing,
      z: elevation
    };
  }

  // Downsample grid slightly for STL export to keep file size snappy (~64x72 grid)
  const step = 2;
  for (let y = 0; y < meshH - step; y += step) {
    for (let x = 0; x < meshW - step; x += step) {
      const v00 = getV(x, y);
      const v10 = getV(x + step, y);
      const v01 = getV(x, y + step);
      const v11 = getV(x + step, y + step);

      // Top surface 2 triangles
      addTriangle(v00, v10, v01);
      addTriangle(v10, v11, v01);
    }
  }

  // Flat base bottom
  const b00 = { x: -meshW / 2 * spacing, y: -meshH / 2 * spacing, z: 0 };
  const b10 = { x: meshW / 2 * spacing, y: -meshH / 2 * spacing, z: 0 };
  const b01 = { x: -meshW / 2 * spacing, y: meshH / 2 * spacing, z: 0 };
  const b11 = { x: meshW / 2 * spacing, y: meshH / 2 * spacing, z: 0 };
  addTriangle(b00, b01, b10);
  addTriangle(b10, b01, b11);

  stl += 'endsolid IsoMatrix_3D_Topography\n';

  // Trigger download
  const blob = new Blob([stl], { type: 'model/stl' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `IsoMatrix_3D_Fingerprint_${Date.now()}.stl`;
  a.click();
  URL.revokeObjectURL(url);
}

// Export 3D OBJ Wavefront
export function exportToOBJ(data, width, height, heightScale = 1.0) {
  let obj = '# IsoMatrix 3D Topographic Fingerprint Model\n';
  const step = 2;
  const cols = Math.floor(width / step);
  const rows = Math.floor(height / step);

  // Vertices
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const srcX = x * step;
      const srcY = y * step;
      const val = data[srcY * width + srcX] || 0;
      const z = (val / 255) * 5.0 * heightScale;
      obj += `v ${(srcX - width / 2) * 0.5} ${(srcY - height / 2) * 0.5} ${z.toFixed(3)}\n`;
    }
  }

  // Faces (1-indexed)
  for (let y = 0; y < rows - 1; y++) {
    for (let x = 0; x < cols - 1; x++) {
      const i1 = y * cols + x + 1;
      const i2 = y * cols + (x + 1) + 1;
      const i3 = (y + 1) * cols + x + 1;
      const i4 = (y + 1) * cols + (x + 1) + 1;

      obj += `f ${i1} ${i2} ${i3}\n`;
      obj += `f ${i2} ${i4} ${i3}\n`;
    }
  }

  const blob = new Blob([obj], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `IsoMatrix_3D_${Date.now()}.obj`;
  a.click();
  URL.revokeObjectURL(url);
}

// Download Snapshot from WebGL Canvas
export function downloadCanvasSnapshot(canvas) {
  if (!canvas) return;
  const dataURL = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataURL;
  a.download = `IsoMatrix_Snapshot_${Date.now()}.png`;
  a.click();
}

// Export Biometric Metadata JSON
export function exportBiometricReport(meta) {
  const jsonStr = JSON.stringify(meta, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `IsoMatrix_Biometric_Report_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
