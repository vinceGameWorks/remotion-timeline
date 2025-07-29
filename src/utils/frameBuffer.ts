type FrameData = {
  type: string;
  data: ImageBitmap;
  index: number;
  timestampMicroSeconds: number;
  durationMicroSeconds: number;
};

const frames: FrameData[] = [];
const listeners = new Set<(frame: FrameData, frames: FrameData[]) => void>();

export const FrameBuffer = {
  add(frame: FrameData) {
    frames.push(frame);
    listeners.forEach((cb) => cb(frame, frames));
  },
  subscribe(callback: (frame: FrameData, frames: FrameData[]) => void) {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },
  getLatest() {
    return frames[frames.length - 1];
  },
  clear() {
    frames.length = 0;
  },
};
