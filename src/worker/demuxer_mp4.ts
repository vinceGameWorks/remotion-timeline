import { createFile, DataStream } from "mp4box";

// Wraps an MP4Box File as a WritableStream underlying sink.
class MP4FileSink {
  #setStatus: (type: string, message: string | object) => void;
  #file: any; // MP4Box.File type not available
  #offset = 0;

  constructor(
    file: any,
    setStatus: (type: string, message: string | object) => void
  ) {
    this.#file = file;
    this.#setStatus = setStatus;
  }

  write(chunk: Uint8Array) {
    // MP4Box.js requires buffers to be ArrayBuffers, but we have a Uint8Array.
    const buffer = new ArrayBuffer(chunk.byteLength);
    new Uint8Array(buffer).set(chunk);

    // Inform MP4Box where in the file this chunk is from.
    (buffer as any).fileStart = this.#offset;
    this.#offset += buffer.byteLength;

    // Append chunk.
    this.#setStatus("fetch", (this.#offset / 1024 ** 2).toFixed(1) + " MiB");
    this.#file.appendBuffer(buffer);
  }

  close() {
    this.#setStatus("fetch", "Done");
    this.#file.flush();
  }
}

// Demuxes the first video track of an MP4 file using MP4Box, calling
// `onConfig()` and `onChunk()` with appropriate WebCodecs objects.
export class MP4Demuxer {
  #onConfig: (config: any) => void;
  #onChunk: (chunk: EncodedVideoChunk) => void;
  #setStatus: (type: string, message: string) => void;
  #file: any; // MP4Box.File type not available
  #totalFrames = 0;
  #videoDuration = 0; // in seconds

  constructor(
    uri: string,
    {
      onConfig,
      onChunk,
      setStatus,
      onDone,
    }: {
      onConfig: (config: any) => void;
      onChunk: (chunk: EncodedVideoChunk) => void;
      setStatus: (type: string, message: string) => void;
      onDone: () => void;
    }
  ) {
    this.#onConfig = onConfig;
    this.#onChunk = onChunk;
    this.#setStatus = setStatus;
    // this.#onDone = onDone;
    // Configure an MP4Box File for demuxing.
    this.#file = createFile();
    this.#file.onError = (error) => setStatus("demux", error);
    this.#file.onReady = this.#onReady.bind(this);
    this.#file.onSamples = this.#onSamples.bind(this);
    this.#file.onMoovStart = () => {
      this.#file.setExtractionOptions();
    };

    // Fetch the file and pipe the data through.
    const fileSink = new MP4FileSink(this.#file, setStatus);
    fetch(uri).then((response) => {
      response.body
        .pipeTo(new WritableStream(fileSink, { highWaterMark: 2 }))
        .then(() => {
          onDone();
        });
    });
  }

  // Get the appropriate `description` for a specific track. Assumes that the
  // track is H.264, H.265, VP8, VP9, or AV1.
  #description(track: any) {
    try {
      const trak = this.#file.getTrackById(track.id);
      if (!trak?.mdia?.minf?.stbl?.stsd?.entries) {
        throw new Error("Invalid track structure - missing required boxes");
      }

      for (const entry of trak.mdia.minf.stbl.stsd.entries) {
        const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
        if (box) {
          // Validate box structure
          if (
            box.type !== "avcC" &&
            box.type !== "hvcC" &&
            box.type !== "vpcC" &&
            box.type !== "av1C"
          ) {
            throw new Error(`Invalid box type: ${box.type}`);
          }

          const stream = new DataStream(
            undefined,
            0,
            (DataStream as any).BIG_ENDIAN
          );

          try {
            console.log("Codec Configuration Box:", box);
            console.log("Raw Box Structure:", JSON.stringify(box));

            // Special handling for AVC configuration
            if (box.type === "avcC") {
              // Create the AVC decoder config according to WebCodecs spec
              const config = new Uint8Array([
                // AVCDecoderConfigurationRecord
                box.configurationVersion,
                box.AVCProfileIndication,
                box.profile_compatibility,
                box.AVCLevelIndication,
                0xff, // reserved (6 bits) + lengthSizeMinusOne (2 bits)
                0xe1, // reserved (3 bits) + numOfSequenceParameterSets (5 bits)
                // SPS
                (box.SPS[0].length >>> 8) & 0xff,
                box.SPS[0].length & 0xff,
                ...box.SPS[0].data,
                // PPS
                box.nb_PPS_nalus,
                (box.PPS[0].length >>> 8) & 0xff,
                box.PPS[0].length & 0xff,
                ...box.PPS[0].data,
              ]);
              console.log("Constructed AVC config:", config);
              return config;
            }

            // Standard processing for other codecs
            box.write(stream);
            if (!stream.buffer || stream.buffer.byteLength < 8) {
              throw new Error("Invalid box data - buffer too small");
            }
            return new Uint8Array(stream.buffer, 8);
          } catch (e) {
            console.error("avcC parsing error:", e);
            throw new Error(`Failed to parse avcC: ${e.message}`);
          }
        }
      }
      throw new Error("avcC, hvcC, vpcC, or av1C box not found");
    } catch (error) {
      this.#setStatus("error", `Failed to parse description: ${error.message}`);
      throw error;
    }
  }

  #onReady(info: any) {
    this.#setStatus("demux", "Ready");
    const track = info.videoTracks[0];

    // Calculate total frames and duration
    this.#totalFrames = track.nb_samples;
    this.#videoDuration = track.duration / track.timescale; // in seconds

    // Generate and emit an appropriate VideoDecoderConfig.
    this.#onConfig({
      // Browser doesn't support parsing full vp8 codec (eg: `vp08.00.41.08`),
      // they only support `vp8`.
      codec: track.codec.startsWith("vp08") ? "vp8" : track.codec,
      codedHeight: track.video.height,
      codedWidth: track.video.width,
      description: this.#description(track),
      totalFrames: this.#totalFrames,
      duration: this.#videoDuration,
    });

    // Start demuxing.
    this.#file.setExtractionOptions(track.id);
    this.#file.start();
  }

  #extractManualConfig(box: any): Uint8Array | null {
    try {
      // Manual extraction for malformed boxes
      if (box.data && box.data.byteLength > 8) {
        console.log("Extracting config from raw box data");
        return new Uint8Array(box.data, 8);
      }
      return null;
    } catch (e) {
      console.error("Manual extraction failed:", e);
      return null;
    }
  }

  #onSamples(track_id: number, ref: unknown, samples: any[]) {
    // Generate and emit an EncodedVideoChunk for each demuxed sample.
    for (const sample of samples) {
      this.#onChunk(
        new EncodedVideoChunk({
          type: sample.is_sync ? "key" : "delta",
          timestamp: (1e6 * sample.cts) / sample.timescale,
          duration: (1e6 * sample.duration) / sample.timescale,
          data: sample.data,
        })
      );
    }
  }
}
