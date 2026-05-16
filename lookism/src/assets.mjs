export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });
}

export async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load JSON: ${url} (${response.status})`);
  }
  return response.json();
}

export async function loadRig(url) {
  const manifest = await loadJson(url);
  const images = {};
  await Promise.all(
    manifest.parts.map(async (part) => {
      images[part.name] = await loadImage(part.file);
    }),
  );
  return { manifest, images };
}

export function createCutout(image, crop) {
  const buffer = document.createElement("canvas");
  const context = buffer.getContext("2d", { willReadFrequently: true });
  buffer.width = crop.w;
  buffer.height = crop.h;
  context.drawImage(image, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
  eraseDarkInk(context, crop.eraseInk ?? []);
  maskEdgeConnectedWhite(context, crop.w, crop.h);
  return buffer;
}

function eraseDarkInk(context, regions) {
  if (!regions.length) return;
  const { width, height } = context.canvas;
  const frame = context.getImageData(0, 0, width, height);
  const data = frame.data;

  for (const region of regions) {
    const left = Math.max(0, Math.floor(region.x));
    const top = Math.max(0, Math.floor(region.y));
    const right = Math.min(width, Math.ceil(region.x + region.w));
    const bottom = Math.min(height, Math.ceil(region.y + region.h));

    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        const index = (y * width + x) * 4;
        if (isSoundEffectInk(data, index)) {
          data[index + 3] = 0;
        }
      }
    }
  }

  context.putImageData(frame, 0, 0);
}

export function isSoundEffectInk(data, index) {
  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  return data[index + 3] > 0 && red < 58 && green < 58 && blue < 58;
}

function maskEdgeConnectedWhite(context, width, height) {
  const frame = context.getImageData(0, 0, width, height);
  const data = frame.data;
  const visited = new Uint8Array(width * height);
  const queue = [];

  const enqueue = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const pixel = y * width + x;
    const index = pixel * 4;
    if (visited[pixel] || !isWhite(data, index)) return;
    visited[pixel] = 1;
    queue.push(pixel);
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }
  clearQueuedPixels({ queue, data, width, enqueue });
  context.putImageData(frame, 0, 0);
}

function clearQueuedPixels({ queue, data, width, enqueue }) {
  for (let head = 0; head < queue.length; head += 1) {
    const pixel = queue[head];
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    data[pixel * 4 + 3] = 0;
    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }
}

function isWhite(data, index) {
  return data[index] > 245 && data[index + 1] > 245 && data[index + 2] > 245;
}
