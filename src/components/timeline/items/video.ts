import { FrameData } from "@/store/mp4FramesStore";
import { FrameBuffer } from "@/utils/frameBuffer";
import { Video as VideoBase, VideoProps } from "@designcombo/timeline";
// import type { FrameData } from "@/store/mp4FramesStore";

class Video extends VideoBase {
  private placeholderImage: HTMLImageElement | null = null;
  private imageLoaded = false;
  static type = "Video";

  private currentFrames: FrameData[] | null = null;
  private chartPoints: { x: number; y: number }[] = [];

  constructor(props: VideoProps) {
    super(props);
    FrameBuffer.subscribe((frame, frames) => {
      this.currentFrames = frames;
      console.log({ frame, frames });
    });

    // Generate fixed chart points with proper line chart shape
    this.chartPoints = Array.from({ length: 20 }, (_, i) => {
      const x = (300 / 19) * i; // Evenly spaced x from 0-300
      // Create trending y values with some variation
      const baseY = 900 * (i / 19);
      const y = Math.min(
        900,
        Math.max(
          0,
          baseY + (Math.random() * 180 - 100) // +/- 90 variation
        )
      );
      return { x, y };
    });
  }

  public _render(ctx: CanvasRenderingContext2D) {
    console.log("render");
    super._render(ctx);
    // this.drawPlaceholder(ctx);
    this.drawChart(ctx);
    this.drawTextIdentity(ctx);
    this.updateSelected(ctx);
    this.drawFrameSquare(ctx);
  }

  private drawChart(ctx: CanvasRenderingContext2D) {
    ctx.save();
    const drawHeight = this.height * 1.5;
    ctx.translate(-this.width / 2, drawHeight * 1.5);

    // Map points (x:0-300 to 0:width, y:0-900 to 0:drawHeight)
    const mappedPoints = this.chartPoints.map((p) => ({
      x: (p.x / 300) * this.width,
      y: (p.y / 900) * drawHeight,
    }));

    // Draw line graph
    ctx.beginPath();
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 2;

    mappedPoints.forEach((p, i) => {
      if (i === 0) {
        ctx.moveTo(p.x, p.y);
      } else {
        ctx.lineTo(p.x, p.y);
      }
    });
    ctx.stroke();

    // Draw points
    ctx.fillStyle = "#ffffff";
    mappedPoints.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }

  private drawFrameSquare(ctx: CanvasRenderingContext2D) {
    if (this.currentFrames && this.currentFrames.length > 0) {
      ctx.save();

      const totalWidth = this.width;
      const frameWidth = totalWidth / this.currentFrames.length;
      // const targetHeight = this.height / 2;

      this.currentFrames.forEach((frameData, i) => {
        const frame = frameData.data;
        // const frameAspect = frame.height / frame.width;

        // Calculate dimensions maintaining aspect ratio
        const drawWidth = frameWidth;
        const drawHeight = this.height * 1.5;
        // const offsetY = (targetHeight - drawHeight) / 2;

        // Calculate x position (left-aligned for each frame)
        const xPos = -totalWidth / 2 + i * frameWidth;

        ctx.drawImage(frame, xPos, -drawHeight * 0.5, drawWidth, drawHeight);
      });

      ctx.restore();
    }
  }

  private loadPlaceholderImage() {
    this.placeholderImage = new Image();
    this.placeholderImage.crossOrigin = "Anonymous";
    this.placeholderImage.src =
      "https://thumbs.dreamstime.com/b/no-thumbnail-images-placeholder-forums-blogs-websites-148010338.jpg";
    this.placeholderImage.onload = () => {
      this.imageLoaded = true;
    };
  }

  public drawPlaceholder(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(-this.width / 4, -this.height / 2);

    if (this.imageLoaded && this.placeholderImage) {
      // Draw image with fixed width/height matching red box dimensions
      const drawWidth = this.width / 2; // Same as red box width
      const drawHeight = this.height / 4; // Fixed height at half of red box height

      // Calculate source crop to maintain aspect ratio while fitting
      const srcAspect =
        this.placeholderImage.height / this.placeholderImage.width;
      const targetAspect = drawHeight / drawWidth;

      let sx = 0,
        sy = 0,
        sw = this.placeholderImage.width,
        sh = this.placeholderImage.height;

      if (srcAspect > targetAspect) {
        // Source is taller - crop top/bottom
        sh = this.placeholderImage.width * targetAspect;
        sy = (this.placeholderImage.height - sh) / 2;
      } else {
        // Source is wider - crop left/right
        sw = this.placeholderImage.height / targetAspect;
        sx = (this.placeholderImage.width - sw) / 2;
      }

      ctx.drawImage(
        this.placeholderImage,
        sx,
        sy,
        sw,
        sh, // Source crop
        -drawWidth / 2,
        -drawHeight / 2, // Destination position
        drawWidth,
        drawHeight // Destination size
      );
    } else {
      // Fallback red rectangle
      ctx.fillStyle = "#ff0000";
      ctx.fillRect(
        -this.width / 4,
        -this.height / 4,
        this.width / 2,
        this.height / 2
      );
    }

    ctx.restore();
  }

  public drawTextIdentity(ctx: CanvasRenderingContext2D) {
    const iconPath = new Path2D(
      "M16.5625 0.925L12.5 3.275V0.625L11.875 0H0.625L0 0.625V9.375L0.625 10H11.875L12.5 9.375V6.875L16.5625 9.2125L17.5 8.625V1.475L16.5625 0.925ZM11.25 8.75H1.25V1.25H11.25V8.75ZM16.25 7.5L12.5 5.375V4.725L16.25 2.5V7.5Z"
    );
    ctx.save();
    ctx.translate(-this.width / 2, -this.height / 2);
    ctx.translate(0, 14);
    ctx.font = "600 12px 'DM Sans'";
    ctx.fillStyle = "#f4f4f5";
    ctx.textAlign = "left";
    ctx.clip();
    ctx.fillText("TEST_VIDEO", 36, 10);

    ctx.translate(8, 1);

    ctx.fillStyle = "#f4f4f5";
    ctx.fill(iconPath);
    ctx.restore();
  }
}

export default Video;
