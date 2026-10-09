import { Component, ElementRef, OnInit, OnDestroy, ViewChild, HostListener } from '@angular/core';

@Component({
  selector: 'app-startseite',
  templateUrl: './startseite.component.html',
  styleUrls: ['./startseite.component.scss']
})
export class StartseiteComponent implements OnInit, OnDestroy {

  @ViewChild('backgroundCanvas', { static: true })
  private canvasRef!: ElementRef<HTMLCanvasElement>;
  private context!: CanvasRenderingContext2D;
  private x_max: number = 1000;
  private y_max: number = 800;
  private points: Point[] = [];
  private animationFrameId: number | null = null;

  private readonly SPEED = 1.5;

  // Active popup state for reliable open/close
  public activePopup: string | null = null;

  constructor() {}

  ngOnInit(): void {
    const ctx = this.canvasRef.nativeElement.getContext('2d');
    if (!ctx) throw new Error("Can't access canvas context!");
    this.context = ctx;

    this.updateCanvasDimensions();
    this.initPoints();
    this.startAnimation();
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.canvasRef && this.canvasRef.nativeElement) {
      this.updateCanvasDimensions();
    }
  }

  private updateCanvasDimensions(): void {
    this.x_max = window.innerWidth;
    this.y_max = window.innerHeight;
    this.canvasRef.nativeElement.width = this.x_max;
    this.canvasRef.nativeElement.height = this.y_max;
  }

  private initPoints(): void {
    this.points = [];
    const count = this.x_max < 1000 ? 55 : 120;

    for (let counter = 0; counter < count; counter++) {
      const x = Math.random() * this.x_max;
      const y = Math.random() * this.y_max;
      const size = Math.random() * 3 + 2;
      const dx = (Math.random() - 0.5) * this.SPEED;
      const dy = (Math.random() - 0.5) * this.SPEED;
      this.points.push(new Point(this.x_max, this.y_max, x, y, size, dx, dy));
    }
  }

  private startAnimation(): void {
    const render = () => {
      // Background teal
      this.context.globalAlpha = 1;
      this.context.fillStyle = "#094456";
      this.context.fillRect(0, 0, this.x_max, this.y_max);

      // Move and draw points
      this.points.forEach(pkt => {
        pkt.updateBounds(this.x_max, this.y_max);
        pkt.move();
      });

      this.context.globalAlpha = 0.85;
      this.points.forEach(pkt => pkt.draw(this.context));

      this.context.globalAlpha = 0.35;
      this.points.forEach(aktuellerPunkt => aktuellerPunkt.drawLineToPoints(this.points, this.context));

      this.animationFrameId = requestAnimationFrame(render);
    };

    this.animationFrameId = requestAnimationFrame(render);
  }

  // When user clicks on a timeline section, open/toggle that popup
  openPopupWithID(elementID: string): void {
    if (this.activePopup === elementID) {
      this.activePopup = null;
    } else {
      this.activePopup = elementID;
    }
  }

  // Close popup explicitly (e.g. clicking X or backdrop)
  closePopup(): void {
    this.activePopup = null;
  }
}

export class Point {
  constructor(
    private x_max: number,
    private y_max: number,
    public x: number,
    public y: number,
    public size: number,
    public dx: number,
    public dy: number
  ) {}

  updateBounds(width: number, height: number): void {
    this.x_max = width;
    this.y_max = height;
  }

  draw(context: CanvasRenderingContext2D): void {
    context.fillStyle = '#eb9759';
    context.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
  }

  move(): void {
    this.x += this.dx;
    this.y += this.dy;

    if (this.x > this.x_max) {
      this.x = 0;
    }
    if (this.y > this.y_max) {
      this.y = 0;
    }
    if (this.x < 0) {
      this.x = this.x_max;
    }
    if (this.y < 0) {
      this.y = this.y_max;
    }
  }

  drawLineToPoints(points: Point[], context: CanvasRenderingContext2D): void {
    for (let i = 0; i < points.length; i++) {
      this.drawLineToPoint(points[i], context);
    }
  }

  private drawLineToPoint(otherPoint: Point, context: CanvasRenderingContext2D): void {
    const dx = this.x - otherPoint.x;
    const dy = this.y - otherPoint.y;
    const abstand = Math.sqrt(dx * dx + dy * dy);

    if (abstand < 150) {
      context.strokeStyle = '#eb9759';
      context.beginPath();
      context.moveTo(this.x, this.y);
      context.lineTo(otherPoint.x, otherPoint.y);
      context.stroke();
    }
  }
}
