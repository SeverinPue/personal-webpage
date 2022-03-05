import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';

@Component({
  selector: 'app-startseite',
  templateUrl: './startseite.component.html',
  styleUrls: ['./startseite.component.scss']
})
export class StartseiteComponent implements OnInit {

  // its important myCanvas matches the variable name in the template
  @ViewChild('backgroundCanvas', {static: true})
  private canvasRef!: ElementRef<HTMLCanvasElement>;
  private context!: CanvasRenderingContext2D;
  private x_max = window.outerWidth;
  private y_max = window.outerHeight;
  private points: Point[] = [];


  private readonly NUMBER_OF_POINTS = 150;

  private readonly SPEED = 1.5;

  ngOnInit(): void {

    // Access Canvas
    const ctx = this.canvasRef.nativeElement.getContext('2d');
    if (!ctx) throw new Error("Can't access canvas context!");
    this.context = ctx;


    this.canvasRef.nativeElement.height = window.outerHeight
    this.canvasRef.nativeElement.width = window.outerWidth
    // Draw on the canvas
    this.context.fillStyle = "#FF0000";


    this.points = [];

    var counter = 0;

    while (counter < this.NUMBER_OF_POINTS) {
      var min_spawn_x = 1
      var max_spawn_x = window.outerWidth
      var x = (Math.random() * (max_spawn_x - min_spawn_x)) + min_spawn_x;

      var min_spawn_y = 1
      var max_spawn_y = window.outerHeight
      var y = (Math.random() * (max_spawn_y - min_spawn_y)) + min_spawn_y;

      var min_size = 2;
      var max_size = 5;
      var size = (Math.random() * (max_size - min_size)) + min_size;
      const point1 = new Point(x, y, size, Math.random() * this.SPEED - this.SPEED / 2, Math.random() * this.SPEED - this.SPEED / 2);
      this.points.push(point1);

      counter += 1
      x += 50

    }


    setInterval(() => {
      this.points.forEach(pkt => pkt.move());

      this.context.globalAlpha = 1;
      this.context.fillStyle = "#094456";
      this.context.fillRect(0, 0, this.x_max, this.y_max);
      this.context.globalAlpha = 0.25;

      this.points.forEach(pkt => pkt.draw(this.context))

      // TODO: For each point: draw a line to each other point
      this.points.forEach(aktuellerPunkt => aktuellerPunkt.drawLineToPoints(this.points, this.context));

    }, 15);


  }


}


export class Point {

  private readonly x_max: number;
  private readonly y_max: number;

  constructor(public x: number, public y: number, public size: number, public dx: number, public dy: number) {

    this.x_max = window.outerWidth;
    this.y_max = window.outerHeight;


  }

  draw(context: CanvasRenderingContext2D): void {

    context.fillStyle = '#eb9759'
    context.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);

  }

  move() {
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

  drawLineToPoints(points: Point[], context: CanvasRenderingContext2D) {


    // TODO: for each point (other point) draw a line from this point to the other point
    points.forEach(otherPoint => this.drawLineToPoint(otherPoint, context));

  }


  private drawLineToPoint(otherPoint: Point, context: CanvasRenderingContext2D) {

    // TODO: draw a lin between this point and other point

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
