import { MinigameQuestion } from './conveniat-game.types';

export const MINIGAME_QUESTIONS: MinigameQuestion[] = [
  // =================== KNOTEN (PITECH) ===================
  {
    id: 'k1_achterknoten',
    category: 'knoten',
    categoryLabel: '🪢 Knoten-Kunde',
    title: 'Welcher Knoten ist das?',
    question: 'Dieser klassische Knoten bildet eine dicke "8" und verhindert zuverlässig, dass ein Seil durch eine Öse oder Blachenöse rutscht.',
    imageSvgType: 'achterknoten',
    options: ['Achterknoten', 'Samariterknoten', 'Fischerknoten', 'Mastwurf'],
    correctIndex: 0,
    explanation: 'Richtig! Der Achterknoten ist der ideale Stopp- und Endknoten. Er schont das Seil besser als ein einfacher Überhandknoten und lässt sich nach Belastung leicht wieder lösen.',
    ceviContext: 'Im Cevi sichern wir damit Seilenden an Zelten, Blachen und Flaschenzügen, damit das Seil nicht durchrutscht.',
    reward: { wood: 50, blachen: 35, money: 45, spirit: 30 }
  },
  {
    id: 'k2_weberknoten',
    category: 'knoten',
    categoryLabel: '🪢 Knoten-Kunde',
    title: 'Zwei Seile verbinden',
    question: 'Welcher Knoten wird im Cevi verwendet, um zwei Seile mit unterschiedlicher Dicke oder Beschaffenheit sicher miteinander zu verbinden?',
    imageSvgType: 'weberknoten',
    options: ['Weberknoten (Schotstek)', 'Achterknoten', 'Mastwurf', 'Zimmermannsstich'],
    correctIndex: 0,
    explanation: 'Genau! Der Weberknoten (auch Schotstek genannt) hält selbst dann hervorragend, wenn eines der Seile deutlich dicker oder rutschiger ist als das andere.',
    ceviContext: 'Unverzichtbar beim Abspannen von Sarasani und Großzelten, wenn dickere Hauptseile mit dünneren Reepschnüren verlängert werden.',
    reward: { wood: 55, blachen: 40, money: 50, spirit: 35 }
  },
  {
    id: 'k3_mastwurf',
    category: 'knoten',
    categoryLabel: '🪢 Knoten-Kunde',
    title: 'Festmachen an einer Pionierstange',
    question: 'Welcher Knoten zieht sich unter Zug von selbst an der Holzstange fest und dient als Start- und Endpunkt für fast alle Bünde?',
    imageSvgType: 'mastwurf',
    options: ['Mastwurf (Webeleinenstek)', 'Samariterknoten', 'Achterknoten', 'Hausfrauenknoten'],
    correctIndex: 0,
    explanation: 'Hervorragend! Der Mastwurf (Webeleinenstek) klemmt sich um die Rundung der Pionierstange. Er ist der Universalknoten zum Beginn und Abschluss von Bünden.',
    ceviContext: 'Der erste Schritt bei jedem Pionierturm, Sarasani-Mittelsäule und Lagertor!',
    reward: { wood: 60, blachen: 40, money: 55, spirit: 40 }
  },
  {
    id: 'k4_samariterknoten',
    category: 'knoten',
    categoryLabel: '🪢 Knoten-Kunde',
    title: 'Flach und symmetrisch',
    question: 'Welcher Knoten liegt vollkommen flach auf, drückt bei Verbänden nicht auf die Haut und verbindet zwei gleich dicke Seilenden?',
    imageSvgType: 'samariterknoten',
    options: ['Samariterknoten (Kreuzknoten)', 'Mastwurf', 'Fischerknoten', 'Palstek'],
    correctIndex: 0,
    explanation: 'Richtig! Der Samariterknoten (Kreuzknoten) drückt dank seiner flachen Form nicht am Körper. Wichtig: Beide freien Enden müssen auf derselben Seite liegen!',
    ceviContext: 'Wird in der Cevi-Erste-Hilfe für Dreieckstücher und Verbände genutzt – sowie zum Zusammenbinden von Schnüren.',
    reward: { wood: 50, blachen: 35, money: 40, spirit: 35 }
  },
  {
    id: 'k5_fischerknoten',
    category: 'knoten',
    categoryLabel: '🪢 Knoten-Kunde',
    title: 'Nasse & rutschige Schnüre',
    question: 'Aus zwei ineinandergreifenden Überhandknoten besteht welcher Knoten, der selbst bei nassen, glatten Kunstfaserschnüren bombensicher hält?',
    imageSvgType: 'fischerknoten',
    options: ['Fischerknoten (Spierenstich)', 'Achterknoten', 'Mastwurf', 'Weberknoten'],
    correctIndex: 0,
    explanation: 'Sehr gut! Der Fischerknoten verriegelt sich gegenseitig. Je stärker gezogen wird, desto fester ziehen sich die beiden Knoten ineinander.',
    ceviContext: 'Perfekt für Angel- und Badschnüre an Gommer Gebirgsbächen oder nasse Zeltabspannleinen im Regen.',
    reward: { wood: 65, blachen: 45, money: 60, spirit: 40 }
  },

  // =================== PIONIERTECHNIK (PITECH) ===================
  {
    id: 'p1_dreibockbund',
    category: 'pitech',
    categoryLabel: '🪵 Pioniertechnik',
    title: 'Das stabile Dreibein',
    question: 'Welcher Bund wird verwendet, um drei Pionierstangen oben so zu verbinden, dass sie aufgestellt eine standfeste Pyramide (Dreibein) bilden?',
    imageSvgType: 'dreibockbund',
    options: ['Dreibockbund', 'Parallelbund', 'Kreuzbund', 'Maurerbund'],
    correctIndex: 0,
    explanation: 'Richtig! Beim Dreibockbund werden die drei Stangen nebeneinander gelegt (die mittlere oft entgegengesetzt), achtförmig umwickelt und mit Knebelungen stramm gezogen.',
    ceviContext: 'Die Basis für Waschstellen, Lagerküchen-Kesselgalgen und Pioniertürme im Conveniat!',
    reward: { wood: 70, blachen: 40, money: 65, spirit: 45 }
  },
  {
    id: 'p2_kreuzbund',
    category: 'pitech',
    categoryLabel: '🪵 Pioniertechnik',
    title: '90°-Winkel ohne Nägel',
    question: 'Zwei Pionierstangen kreuzen sich rechtwinklig (z.B. für eine Leiter oder ein Zeltgeländer). Welcher Bund hält sie unerschütterlich zusammen?',
    imageSvgType: 'kreuzbund',
    options: ['Kreuzbund', 'Scherenbund', 'Parallelbund', 'Weberknoten'],
    correctIndex: 0,
    explanation: 'Exakt! Der Kreuzbund beginnt mit einem Mastwurf, führt Seilwicklungen über und unter die Stangen und wird durch kraftvolle Knebelwicklungen zwischen den Stangen bombenfest.',
    ceviContext: 'Ohne Schrauben oder Nägel – reines Cevi-Pionierhandwerk für Tische, Bänke und Lagertürme.',
    reward: { wood: 65, blachen: 35, money: 55, spirit: 40 }
  },
  {
    id: 'p3_sarasani_statik',
    category: 'pitech',
    categoryLabel: '🪵 Pioniertechnik',
    title: 'Der monumentale Sarasani',
    question: 'Wie wird ein Sarasani-Riesenzelt vor Starkwind im Wallis geschützt, damit die gewaltige Zeltblache nicht abhebt?',
    imageSvgType: 'sarasani',
    options: [
      'Gleichmässiges Abspannen der 4 Ecken mit Erdnägeln & Seilzügen',
      'Den Mittelpfosten locker lassen',
      'Die Blachen nur mit Steinen beschweren',
      'Das Zelt mit Wasser füllen'
    ],
    correctIndex: 0,
    explanation: 'Absolut richtig! Ein Sarasani steht durch symmetrische Zugspannung. Alle vier Ecken müssen mit tief geschlagenen Heringen und Spannern im 45°-Winkel verankert werden.',
    ceviContext: 'Das Wahrzeichen jedes Grosslagers – im Conveniat 2027 finden darunter hunderte Cevianer Platz zum Singen!',
    reward: { wood: 80, blachen: 60, money: 80, spirit: 60 }
  },
  {
    id: 'p4_seilpflege',
    category: 'pitech',
    categoryLabel: '🪵 Pioniertechnik',
    title: 'Seilpflege nach dem Lager',
    question: 'Wie trocknet und lagert man Pionierseile und Hanfseile nach feuchtem Gommer Bergregen richtig?',
    options: [
      'Luftig im Schatten aufhängen (Achterpuppe) und niemals feucht im Koffer lagern',
      'Direkt in der prallen Mittagssonne auf heissem Asphalt rösten',
      'Feucht in einer dichten Plastiktüte verstauen',
      'Mit Spülmittel in der Waschmaschine schleudern'
    ],
    correctIndex: 0,
    explanation: 'Ganz genau! Seile müssen schonend an der Luft trocknen, um Fäulnis und Schimmel im Kern zu verhindern. Gequetschte oder brüchige Seile werden aussortiert.',
    ceviContext: 'Gute Cevi-Seile halten bei richtiger Pflege über viele Sommerlager hinweg!',
    reward: { wood: 50, blachen: 50, money: 45, spirit: 35 }
  },

  // =================== CEVI- & LAGER-WISSEN ===================
  {
    id: 'c1_motto',
    category: 'cevi_wissen',
    categoryLabel: '⚜️ Cevi-Wissen',
    title: 'Conveniat 2027 Motto',
    question: 'Unter welchem offiziellen Motto steht das Bundeslager 2027 im Obergoms?',
    options: ['«MIR SIND CEVI!»', '«Abenteuer Natur»', '«Zusammen Stark»', '«Cevi bewegt»'],
    correctIndex: 0,
    explanation: 'Ja! «MIR SIND CEVI!» ist das offizielle Motto des Conveniat 2027. Es drückt die Verbundenheit und die gemeinsame Identität aller Schweizer Abteilungen aus.',
    ceviContext: 'Erstes nationales Grosslager nach 18 Jahren – ein historischer Meilenstein für Cevi Schweiz!',
    reward: { wood: 60, blachen: 40, money: 70, spirit: 60 }
  },
  {
    id: 'c2_karte',
    category: 'cevi_wissen',
    categoryLabel: '⚜️ Cevi-Wissen',
    title: 'Landeskarten-Massstab',
    question: 'Welchen Massstab hat die detaillierteste Swisstopo-Landeskarte, die im Cevi für Orientierungsläufe und Wanderungen genutzt wird?',
    options: ['1:25\'000 (1 cm = 250 m)', '1:100\'000 (1 cm = 1 km)', '1:5\'000 (1 cm = 50 m)', '1:500\'000'],
    correctIndex: 0,
    explanation: 'Richtig! Auf der 1:25\'000 Karte entspricht 1 cm auf der Karte genau 250 Metern in der Wirklichkeit. Höhenkurven und Felsnasen sind exakt erkennbar.',
    ceviContext: 'Gemeinsam mit Kompass und Höhenmesser finden Cevianer jeden Posten im Obergoms!',
    reward: { wood: 55, blachen: 40, money: 60, spirit: 45 }
  },
  {
    id: 'c3_militaerblache',
    category: 'cevi_wissen',
    categoryLabel: '⚜️ Cevi-Wissen',
    title: 'Die Schweizer Militärblache',
    question: 'Welche Standard-Masse hat die quadratische Schweizer Militärblache (Blache 64) mit Knöpfen und Ösen?',
    options: ['165 cm × 165 cm', '200 cm × 200 cm', '120 cm × 120 cm', '250 cm × 150 cm'],
    correctIndex: 0,
    explanation: 'Exakt! 165 × 165 cm. Mit 8 Blachen lässt sich ein klassisches Firstzelt bauen, mit Dutzenden Blachen ein riesiger Sarasani oder eine Jurte!',
    ceviContext: 'Das vielseitigste Werkzeug im Cevi-Zeltlager: Regenschutz, Zeltwand, Tragebahre und Sonnensegel.',
    reward: { wood: 50, blachen: 65, money: 55, spirit: 50 }
  },
  {
    id: 'c4_kueche',
    category: 'cevi_wissen',
    categoryLabel: '⚜️ Cevi-Wissen',
    title: 'Das Schweizer Lagergericht',
    question: 'Was ist der absolute Kulinarik-Klassiker am grossen Lagersamstag in der Cevi-Küche?',
    options: ['Hörnli mit Ghackets & feinem Apfelmus', 'Sushi mit Wasabi', 'Kaviar auf Toast', 'Fondue im Hochsommer'],
    correctIndex: 0,
    explanation: 'Klassiker schlechthin! Schweizer Teigwaren-Hörnli, kräftiges Rindfleisch-Hack und fruchtiges Apfelmus geben Energie nach langen Geländespielen.',
    ceviContext: 'Gekocht auf offenem Holzfeuer in riesigen Chromstahlkesseln der Lagerküche!',
    reward: { wood: 70, blachen: 45, money: 80, spirit: 60 }
  },
  {
    id: 'c5_gewitter',
    category: 'cevi_wissen',
    categoryLabel: '⚜️ Cevi-Wissen',
    title: 'Sicherheit bei Sommergewittern',
    question: 'Ein starkes Alpengewitter zieht im Obergoms auf. Was ist die wichtigste Sicherheitsregel im Zeltlager?',
    options: [
      'Grosse freistehende Bäume & Sarasani meiden, Zeltabspannungen sichern, Metallpfosten meiden',
      'Unter den höchsten Pionierturm stellen',
      'Einen Metallregenschirm hochhalten',
      'In den reissenden Gebirgsbach springen'
    ],
    correctIndex: 0,
    explanation: 'Perfekt! Blitzschlag und Sturmböen sind in den Bergen ernst zu nehmen. Geschützte Mulden oder feste Lagergebäude aufsuchen, Zeltwände schliessen.',
    ceviContext: 'Sicherheit geht im Cevi immer vor – jeder Leiter lernt das fundiert im Gruppenleiter-Kurs (GLK).',
    reward: { wood: 65, blachen: 55, money: 65, spirit: 55 }
  }
];
