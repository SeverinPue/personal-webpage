import { Component, ElementRef, OnInit, OnDestroy, ViewChild, HostListener } from '@angular/core';

export interface TimelineItem {
  id: string;
  category: 'vergangenheit' | 'gegenwart' | 'zukunft';
  period: string;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  highlights: string[];
  link?: { text: string; url: string };
  isOpen?: boolean;
}

export interface SkillGroup {
  category: string;
  skills: { name: string; level: string; icon?: string }[];
}

@Component({
  selector: 'app-startseite',
  templateUrl: './startseite.component.html',
  styleUrls: ['./startseite.component.scss']
})
export class StartseiteComponent implements OnInit, OnDestroy {
  @ViewChild('backgroundCanvas', { static: true })
  private canvasRef!: ElementRef<HTMLCanvasElement>;
  private context!: CanvasRenderingContext2D;
  private animationFrameId: number | null = null;
  private points: ParticlePoint[] = [];

  // Active filter for timeline
  public activeTimelineFilter: 'all' | 'vergangenheit' | 'gegenwart' | 'zukunft' = 'all';

  // Timeline entries (updated to reflect current status)
  public timelineItems: TimelineItem[] = [
    {
      id: 'item-gegenwart',
      category: 'gegenwart',
      period: 'Seit Sommer 2023 – Heute',
      badge: 'Aktuell',
      title: 'Ausbildung zum Applikationsentwickler EFZ',
      subtitle: 'Informatiker Fachrichtung Applikationsentwicklung',
      description: 'Aktuell absolviere ich mit Begeisterung meine Lehre als Applikationsentwickler EFZ. In der Praxis und Berufsschule vertiefe ich mein Wissen in moderner Software-Architektur, agilen Methoden und erstklassiger Code-Qualität.',
      highlights: [
        'Entwicklung von Frontend- & Backend-Lösungen (Angular, TypeScript, Java, C#, SQL)',
        'Arbeit im Entwicklungsteam mit agilen Workflows & Git CI/CD',
        'Ehrenamtlicher Gruppenleiter bei der Cevi Zürich 11'
      ],
      link: { text: 'Cevi Zürich 11 besuchen', url: 'https://zh11.ch/' },
      isOpen: true
    },
    {
      id: 'item-vergangenheit',
      category: 'vergangenheit',
      period: 'Bis Sommer 2023',
      badge: 'Fundament',
      title: 'Schulabschluss Sek A & Erste Programmierschritte',
      subtitle: 'Schule Zürich Nord & gezielte Berufswahl',
      description: 'Schon früh entdeckte ich durch meinen Vater (Informatiker) und meinen Bruder (ETH Informatik-Student) die Leidenschaft für IT. Nach ersten Projekten mit Scratch, Lego Mindstorms, Java und HTML/CSS sowie lehrreichen Schnupperlehren stand mein Entschluss fest, die Lehre als Applikationsentwickler anzutreten.',
      highlights: [
        'Erfolgreicher Abschluss Sekundarschule A an der Schule Zürich Nord',
        'Schwerpunkte & Lieblingsfächer: Informatik und Mathematik',
        'Frühe Erfahrungen mit Algorithmen, Robotik & Web-Basics'
      ],
      link: { text: 'Schule Zürich Nord', url: 'https://szn.ch/' },
      isOpen: false
    },
    {
      id: 'item-zukunft',
      category: 'zukunft',
      period: 'Ausblick',
      badge: 'Ziele & Vision',
      title: 'Lehrabschluss EFZ & Anspruchsvolle Software-Architektur',
      subtitle: 'Full-Stack Engineering & Komplexe Systeme',
      description: 'Mein Ziel ist es, meine Lehre mit Bestnoten abzuschliessen und mich kontinuierlich in modernen Cloud-Architekturen, Full-Stack Frameworks und skalierbaren Softwarelösungen weiterzubilden.',
      highlights: [
        'Erfolgreicher EFZ-Abschluss als Applikationsentwickler',
        'Vertiefung in moderne Cloud- & Container-Technologien (Docker, Cloud Services)',
        'Verantwortung für architektonisch anspruchsvolle Software-Module'
      ],
      isOpen: false
    }
  ];

  // Tech stack & skills
  public skillGroups: SkillGroup[] = [
    {
      category: 'Frontend & Web',
      skills: [
        { name: 'Angular', level: 'Vertraut' },
        { name: 'TypeScript', level: 'Erfahren' },
        { name: 'JavaScript (ES6+)', level: 'Erfahren' },
        { name: 'HTML5 & SCSS / CSS3', level: 'Erfahren' },
        { name: 'Responsive UI / UX', level: 'Vertraut' }
      ]
    },
    {
      category: 'Backend & Sprachen',
      skills: [
        { name: 'Java', level: 'Vertraut' },
        { name: 'C# / .NET', level: 'Grundlagen & Praxis' },
        { name: 'SQL & relationale Datenbanken', level: 'Vertraut' },
        { name: 'Python', level: 'Grundlagen' }
      ]
    },
    {
      category: 'Tools & Methoden',
      skills: [
        { name: 'Git & GitHub Workflows', level: 'Erfahren' },
        { name: 'GitHub Actions / CI/CD', level: 'Vertraut' },
        { name: 'VS Code & JetBrains IDEs', level: 'Erfahren' },
        { name: 'Linux & Terminal', level: 'Vertraut' },
        { name: 'Agiles Arbeiten (Scrum / Kanban)', level: 'Vertraut' }
      ]
    }
  ];

  ngOnInit(): void {
    this.initCanvas();
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.canvasRef && this.canvasRef.nativeElement) {
      this.initCanvasDimensions();
    }
  }

  private initCanvas(): void {
    const ctx = this.canvasRef.nativeElement.getContext('2d');
    if (!ctx) return;
    this.context = ctx;

    this.initCanvasDimensions();
    this.initPoints();
    this.animate();
  }

  private initCanvasDimensions(): void {
    const canvas = this.canvasRef.nativeElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  private initPoints(): void {
    this.points = [];
    const width = window.innerWidth;
    const height = window.innerHeight;
    const count = width < 768 ? 45 : 95;

    for (let i = 0; i < count; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const size = Math.random() * 2.5 + 1.5;
      const dx = (Math.random() - 0.5) * 0.9;
      const dy = (Math.random() - 0.5) * 0.9;
      this.points.push(new ParticlePoint(x, y, size, dx, dy));
    }
  }

  private animate = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Soft clear with slight fade
    this.context.fillStyle = '#080d1a';
    this.context.fillRect(0, 0, width, height);

    // Update and draw points
    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i];
      p.move(width, height);
      p.draw(this.context);

      // Connect lines to nearby points
      for (let j = i + 1; j < this.points.length; j++) {
        const other = this.points[j];
        const dx = p.x - other.x;
        const dy = p.y - other.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 130) {
          const alpha = (1 - dist / 130) * 0.25;
          this.context.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
          this.context.lineWidth = 1;
          this.context.beginPath();
          this.context.moveTo(p.x, p.y);
          this.context.lineTo(other.x, other.y);
          this.context.stroke();
        }
      }
    }

    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  public toggleTimelineItem(id: string): void {
    const item = this.timelineItems.find(t => t.id === id);
    if (item) {
      item.isOpen = !item.isOpen;
    }
  }

  public setFilter(filter: 'all' | 'vergangenheit' | 'gegenwart' | 'zukunft'): void {
    this.activeTimelineFilter = filter;
  }

  public get filteredTimelineItems(): TimelineItem[] {
    if (this.activeTimelineFilter === 'all') {
      return this.timelineItems;
    }
    return this.timelineItems.filter(item => item.category === this.activeTimelineFilter);
  }
}

export class ParticlePoint {
  constructor(
    public x: number,
    public y: number,
    public size: number,
    public dx: number,
    public dy: number
  ) {}

  move(width: number, height: number): void {
    this.x += this.dx;
    this.y += this.dy;

    if (this.x > width) this.x = 0;
    else if (this.x < 0) this.x = width;

    if (this.y > height) this.y = 0;
    else if (this.y < 0) this.y = height;
  }

  draw(context: CanvasRenderingContext2D): void {
    context.fillStyle = '#38bdf8';
    context.beginPath();
    context.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    context.fill();
  }
}
