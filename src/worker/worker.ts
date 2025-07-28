import { MP4Demuxer } from "./demuxer_mp4";

// Types for status messages
export type StatusMessage = {
  [key: string]: string | object | boolean | undefined;
  _animationFramePending?: boolean;
};

export type StatusType = "render" | "decode" | "capture" | "config";

export type FrameDataWorker = {
  type: "frame";
  data: ImageBitmap;
  index: number;
  timestampMicroSeconds: number;
  durationMicroSeconds?: number;
  interval?: number; // Added for frame decimation support
};

type VideoConfig = {
  totalFrames: number;
  codec: string;
  codedWidth: number;
  codedHeight: number;
  duration: number; // in seconds
};

// Status management (pure functions)
const createStatusBatcher = (): {
  setStatus: (type: StatusType, message: string | object) => void;
} => {
  let pendingStatus: StatusMessage | null = null;

  const setStatus = (type: StatusType, message: string | object): void => {
    pendingStatus = pendingStatus || {};
    pendingStatus[type] = message;

    if (!pendingStatus._animationFramePending) {
      pendingStatus._animationFramePending = true;
      self.requestAnimationFrame(() => {
        self.postMessage(pendingStatus!);
        pendingStatus = null;
      });
    }
  };

  return { setStatus };
};

// const captureFrameToBlob = async (frame: VideoFrame): Promise<Blob> => {
//   const canvas = new OffscreenCanvas(frame.displayWidth, frame.displayHeight);
//   const ctx = canvas.getContext("2d");
//   if (!ctx) throw new Error("Could not get canvas context");
//   ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
//   return await canvas.convertToBlob({ type: "image/jpeg", quality: 0.8 });
// };

const processFrame = async (
  frame: VideoFrame,
  frameNumber: number,
  onProcess: (data: FrameDataWorker) => void,
  lastCaptureIntervalRef: { current: number } // Now using a ref object
): Promise<void> => {
  // console.log({ frame });
  const frameTimeSeconds = frame.timestamp / 1000000;
  const currentInterval = Math.floor(frameTimeSeconds * (1 / 1)); // 10 = 1/0.1 (for 0.1 second intervals)

  const dataUrl = "";
  if (currentInterval > lastCaptureIntervalRef.current) {
    lastCaptureIntervalRef.current = currentInterval; // Update the ref's value
    try {
      const bitmap = await createImageBitmap(frame);
      const result = {
        type: "frame",
        data: bitmap,
        index: frameNumber,
        timestampMicroSeconds: frame.timestamp,
        durationMicroSeconds: frame.duration || 1000000, // Default to 1 second if not specified
      };
      // console.log(result);
      onProcess(result as FrameDataWorker);
      // const currentFrameNumber = frameNumber;
      self.postMessage(result as FrameDataWorker);
    } catch (error) {
      // Error handling
    }
  }

  frame.close();
};

// Main processor
const createVideoProcessor = (): {
  start: (options: { dataUri: string; captureRate?: number }) => void;
} => {
  const { setStatus } = createStatusBatcher();
  // let totalFrames = 0;

  const startProcessing = async ({
    dataUri,
  }: {
    dataUri: string;
    captureRate?: number;
  }): Promise<void> => {
    const capturedFrames: FrameDataWorker[] = [];
    let frameNumber = 0;
    const lastCaptureIntervalRef = { current: -1 }; // Using a ref object to maintain state

    const decoder = new VideoDecoder({
      output: (frame: VideoFrame) => {
        processFrame(
          frame,
          frameNumber,
          (prop) => {
            capturedFrames.push(prop);
          },
          lastCaptureIntervalRef // Pass the ref object
        );

        frameNumber++;
      },
      error: (e: Error) => setStatus("decode", e.message),
    });

    await new Promise<void>((resolve, reject) => {
      new MP4Demuxer(dataUri, {
        onConfig: (config: VideoConfig) => {
          setStatus(
            "decode",
            `${config.codec} @ ${config.codedWidth}x${config.codedHeight}`
          );
          setStatus("config", config);
          console.log({ duration: config.duration });
          // Send duration info immediately
          self.postMessage({
            type: "duration",
            durationSeconds: config.duration,
          });
          decoder.configure(config);
        },
        onChunk: (chunk: EncodedVideoChunk) => {
          decoder.decode(chunk);
        },
        onDone: async () => {
          try {
            await decoder.flush();
            console.log("FINISHED");
            resolve();
          } catch (err) {
            reject(err);
          }
        },
        setStatus,
      });
    });
  };

  return { start: startProcessing };
};
// Initialize
const processor = createVideoProcessor();

self.addEventListener(
  "message",
  async ({ data }: MessageEvent<{ dataUri: string; captureRate?: number }>) => {
    try {
      await processor.start({ ...data });
    } catch (error: unknown) {
      self.postMessage({
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
  { once: true }
);
