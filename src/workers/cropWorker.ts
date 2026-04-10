self.onmessage = (e) => {
  const { id, imageData, targetRatio, origW, origH, previewUrl } = e.data;
  const { width, height, data } = imageData;
  
  const energy = new Float32Array(width * height);
  const cx = width / 2;
  const cy = height / 2;

  for (let y = 0; y < height - 1; y++) {
    const yOffset = y * width;
    const nextYOffset = (y + 1) * width;
    const dy_c = (y - cy) / cy;
    const dy_c_sq = dy_c * dy_c;

    for (let x = 0; x < width - 1; x++) {
      const i = (yOffset + x) * 4;
      const iRight = i + 4;
      const iDown = (nextYOffset + x) * 4;

      // Simple gradient calculation
      const dx = Math.abs(data[i] - data[iRight]) + Math.abs(data[i+1] - data[iRight+1]) + Math.abs(data[i+2] - data[iRight+2]);
      const dy = Math.abs(data[i] - data[iDown]) + Math.abs(data[i+1] - data[iDown+1]) + Math.abs(data[i+2] - data[iDown+2]);
      
      const dx_c = (x - cx) / cx;
      const centerBias = Math.exp(-(dx_c * dx_c + dy_c_sq) * 2); 
      
      energy[yOffset + x] = (dx + dy) * centerBias;
    }
  }
  
  let cropX = 0, cropY = 0, cropW = width, cropH = height;
  const imgRatio = width / height;
  
  if (Math.abs(imgRatio - targetRatio) > 0.01) {
    if (imgRatio > targetRatio) {
      cropW = Math.max(1, Math.round(height * targetRatio));
      cropH = height;
      const colSums = new Float32Array(width);
      for (let x = 0; x < width; x++) {
        let sum = 0;
        for (let y = 0; y < height; y++) sum += energy[y * width + x];
        colSums[x] = sum;
      }
      let currentEnergy = 0;
      for (let x = 0; x < cropW; x++) currentEnergy += colSums[x];
      let maxEnergy = currentEnergy;
      let bestX = 0;
      for (let x = 1; x <= width - cropW; x++) {
        currentEnergy = currentEnergy - colSums[x - 1] + colSums[x + cropW - 1];
        if (currentEnergy > maxEnergy) { maxEnergy = currentEnergy; bestX = x; }
      }
      cropX = bestX;
    } else {
      cropW = width;
      cropH = Math.max(1, Math.round(width / targetRatio));
      const rowSums = new Float32Array(height);
      for (let y = 0; y < height; y++) {
        let sum = 0;
        for (let x = 0; x < width; x++) sum += energy[y * width + x];
        rowSums[y] = sum;
      }
      let currentEnergy = 0;
      for (let y = 0; y < cropH; y++) currentEnergy += rowSums[y];
      let maxEnergy = currentEnergy;
      let bestY = 0;
      for (let y = 1; y <= height - cropH; y++) {
        currentEnergy = currentEnergy - rowSums[y - 1] + rowSums[y + cropH - 1];
        if (currentEnergy > maxEnergy) { maxEnergy = currentEnergy; bestY = y; }
      }
      cropY = bestY;
    }
  }

  // Scale back to original dimensions
  const scaleX = origW / width;
  const scaleY = origH / height;

  const finalX = Math.round(cropX * scaleX);
  const finalY = Math.round(cropY * scaleY);
  const finalW = Math.round(cropW * scaleX);
  const finalH = Math.round(cropH * scaleY);

  self.postMessage({ id, cropX: finalX, cropY: finalY, cropW: finalW, cropH: finalH, previewUrl });
};
