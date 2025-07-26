import { Video as VideoBase, VideoProps } from "@designcombo/timeline";

class Video extends VideoBase {
  private placeholderImage: HTMLImageElement | null = null;
  private imageLoaded = false;
  static type = "Video";
  constructor(props: VideoProps) {
    super(props);
    // this.fill = "#2563eb";
    this.loadPlaceholderImage();
  }

  public _render(ctx: CanvasRenderingContext2D) {
    super._render(ctx);
    this.drawPlaceholder(ctx);
    this.drawTextIdentity(ctx);
    this.updateSelected(ctx);
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
