{
  const global = window;
  const Animotion = global.Animotion;
  const data = Animotion.lookismPresetData;

  async function loadImagesAndRig() {
    const ready = await loadImage(data.ASSETS.ready.src);
    const impact = await loadImage(data.ASSETS.impact.src);
    return {
      ready,
      impact,
      rig: await loadRig(),
      sprites: {
        ready: createCutout(ready, data.ASSETS.ready.crop),
        impact: createCutout(impact, data.ASSETS.impact.crop),
      },
    };
  }

  async function loadRig() {
    const images = {};
    await Promise.all(data.MANIFEST.parts.map(async (part) => {
      images[part.name] = await loadImage(part.file);
    }));
    return { manifest: data.MANIFEST, images, links: data.RIG_LINKS };
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`이미지 로드 실패: ${src}`));
      image.src = new URL(src, document.baseURI).href;
    });
  }

  function createCutout(image, crop) {
    const buffer = document.createElement("canvas");
    const context = buffer.getContext("2d", { willReadFrequently: true });
    buffer.width = crop.w;
    buffer.height = crop.h;
    context.drawImage(image, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
    maskEdgeConnectedWhite(context, crop.w, crop.h);
    return buffer;
  }

  function maskEdgeConnectedWhite(context, width, height) {
    const frame = context.getImageData(0, 0, width, height);
    const dataBuffer = frame.data;
    const visited = new Uint8Array(width * height);
    const queue = edgeWhitePixels(dataBuffer, visited, width, height);
    clearQueuedPixels({ queue, dataBuffer, visited, width, height });
    context.putImageData(frame, 0, 0);
  }

  function edgeWhitePixels(dataBuffer, visited, width, height) {
    const queue = [];
    for (let x = 0; x < width; x += 1) {
      enqueueWhitePixel({ queue, dataBuffer, visited, width, height, x, y: 0 });
      enqueueWhitePixel({ queue, dataBuffer, visited, width, height, x, y: height - 1 });
    }
    for (let y = 0; y < height; y += 1) {
      enqueueWhitePixel({ queue, dataBuffer, visited, width, height, x: 0, y });
      enqueueWhitePixel({ queue, dataBuffer, visited, width, height, x: width - 1, y });
    }
    return queue;
  }

  function clearQueuedPixels(args) {
    for (let head = 0; head < args.queue.length; head += 1) {
      const pixel = args.queue[head];
      const x = pixel % args.width;
      const y = Math.floor(pixel / args.width);
      args.dataBuffer[pixel * 4 + 3] = 0;
      enqueueNeighbors(args, x, y);
    }
  }

  function enqueueNeighbors(args, x, y) {
    enqueueWhitePixel({ ...args, x: x + 1, y });
    enqueueWhitePixel({ ...args, x: x - 1, y });
    enqueueWhitePixel({ ...args, x, y: y + 1 });
    enqueueWhitePixel({ ...args, x, y: y - 1 });
  }

  function enqueueWhitePixel(args) {
    const { queue, dataBuffer, visited, width, height, x, y } = args;
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const pixel = y * width + x;
    if (visited[pixel] || !isWhite(dataBuffer, pixel * 4)) return;
    visited[pixel] = 1;
    queue.push(pixel);
  }

  function isWhite(dataBuffer, index) {
    return dataBuffer[index] > 245 && dataBuffer[index + 1] > 245 && dataBuffer[index + 2] > 245;
  }

  Animotion.lookismPresetAssets = { loadImagesAndRig };
}
