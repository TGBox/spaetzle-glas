import type { AdventDay } from "../types/advent";

/**
 * Valid anniversary passcodes to unlock the jar on the first visit.
 * Accepts common German date formats for December 1, 2021, plus "5" as fallback hint.
 */
export const ANNIVERSARY_CODES: readonly string[] = [
  "01.12.2021",
  "01122021",
  "01.12.",
  "0112",
  "1.12.2021",
  "1.12.",
  "5",
];

/**
 * All 24 advent calendar entries for December 1 through December 24.
 *
 * How to customize before December 1:
 * 1. Edit the texts, titles, subtitles, and year badges below.
 * 2. To display a real photo on a "polaroid" card, copy your image into `public/photos/`
 *    (for example `public/photos/tag-02.jpg`) and set `photoUrl: "./photos/tag-02.jpg"`.
 *    If `photoUrl` is omitted, a warm custom-illustrated Polaroid scene is rendered instead.
 */
export const ADVENT_DAYS: readonly AdventDay[] = [
  {
    day: 1,
    title: "5 Jahre Wir — Alles beginnt wieder am 1. Dezember",
    subtitle: "Jubiläums-Auftakt",
    type: "letter",
    yearBadge: "5 Jahre • 01.12.2021",
    message:
      "Mein liebstes Spätzle,\n\nheute vor genau fünf Jahren hat unsere gemeinsame Geschichte begonnen. Aus vielen kleinen Momenten, langen Nächten, spontanen Lachanfällen und ganz viel Alltag sind unsere schönsten Jahre geworden.\n\nDieses Glas gehört im Dezember ganz dir: Schüttle es, wenn du ein bisschen Funkeln brauchst, und öffne jeden Tag einen neuen Stern aus unseren 5 Jahren.",
  },
  {
    day: 2,
    title: "Unser allererstes richtiges Foto",
    subtitle: "Erinnerung im Polaroid",
    type: "polaroid",
    yearBadge: "Jahr 1 • 2021/22",
    // photoUrl: "./photos/tag-02.jpg",
    photoCaption: "Wo wir noch gar nicht wussten, wie schön alles wird",
    message:
      "Weißt du noch, wie nervös und gleichzeitig selbstverständlich sich alles angefühlt hat? Ich schaue dieses Bild (und den Moment dahinter) bis heute mit genau demselben Grinsen an wie damals.",
  },
  {
    day: 3,
    title: "Einmal Lieblingsessen kochen nach Wunsch",
    subtitle: "Persönlicher Gutschein",
    type: "voucher",
    yearBadge: "Für kalte Winterabende",
    voucherCode: "SPÄTZLE-CHEF-03",
    message:
      "Du suchst dir das Gericht aus, machst es dir auf dem Sofa gemütlich mit Musik und Decke — ich übernehme Einkauf, Kochen, Anrichten und den kompletten Abwasch.",
  },
  {
    day: 4,
    title: "Dein Lachen rettet jeden Montag",
    subtitle: "Kleiner Lichtfunke",
    type: "compliment",
    yearBadge: "Alltagsmagie",
    complimentHighlight:
      "Wenn du richtig lachst, wird jeder noch so graue Raum in einer Sekunde warm.",
    message:
      "Das fällt dir wahrscheinlich gar nicht auf, aber genau dieses unbeschwerte Lachen ist bis heute mein absolutes Lieblingsgeräusch.",
  },
  {
    day: 5,
    title: "Der erste gemeinsame Winterspaziergang",
    subtitle: "Kalte Hände, warmer Kopf",
    type: "polaroid",
    yearBadge: "Jahr 1 • 2021/22",
    // photoUrl: "./photos/tag-05.jpg",
    photoCaption: "Rote Nasen, viel zu dünne Handschuhe und trotzdem endlos gelaufen",
    message:
      "Mit dir kann man stundenlang durch die Kälte laufen und erst zu Hause merken, wie spät es eigentlich geworden ist.",
  },
  {
    day: 6,
    title: "Nikolaus-Überraschung für zwischendurch",
    subtitle: "Insider & Erinnerung",
    type: "letter",
    yearBadge: "Nikolaus • Jahr 2",
    message:
      "Kleiner Reminder am 6. Dezember: Egal wie voll der Tag heute ist — du bist der Grund, warum sich sogar der stressigste Dezember nach Zuhause anfühlt.\n\nSchau heute Abend in deine Jackentasche oder neben deinen Teller, vielleicht hat der Nikolaus eine Kleinigkeit dagelassen.",
  },
  {
    day: 7,
    title: "Handyfreie Kuschel- & Serienzeit",
    subtitle: "Persönlicher Gutschein",
    type: "voucher",
    yearBadge: "Nur wir zwei",
    voucherCode: "COZY-ABEND-07",
    message:
      "Ein ganzer Abend ohne Verpflichtungen, ohne To-do-Listen und mit deinen Snacks nach Wahl. Du hast das volle Veto-Recht bei der Film- oder Serienauswahl.",
  },
  {
    day: 8,
    title: "Wie aufmerksam du zuhörst",
    subtitle: "Kleiner Lichtfunke",
    type: "compliment",
    yearBadge: "Was ich an dir liebe",
    complimentHighlight:
      "Du merkst dir die winzigen Nebensätze, die andere längst vergessen hätten.",
    message:
      "Bei dir hat man nie das Gefühl, nebenher zu laufen. Du siehst Menschen wirklich — und mich ganz besonders.",
  },
  {
    day: 9,
    title: "Unterwegs in unserer eigenen Welt",
    subtitle: "Reise-Moment",
    type: "polaroid",
    yearBadge: "Jahr 2 • 2022/23",
    // photoUrl: "./photos/tag-09.jpg",
    photoCaption: "Kein Plan, falscher Weg und trotzdem genau richtig",
    message:
      "Selbst wenn die Route nicht stimmt oder das Wetter umschlägt: Mit dir wird aus jedem kleinen Umweg sofort die bessere Geschichte.",
  },
  {
    day: 10,
    title: "Die Sache mit den kleinen Insidern",
    subtitle: "Aus dem Archiv",
    type: "letter",
    yearBadge: "Jahr 3 • 2023/24",
    message:
      "In fünf Jahren hat sich bei uns ein ganz eigenes Wörterbuch angesammelt — Blicke quer durch den Raum, halbe Sätze, bei denen wir sofort losprusten, und Rituale, die niemand sonst versteht.\n\nGenau diese Sprache zwischen uns möchte ich für nichts auf der Welt eintauschen.",
  },
  {
    day: 11,
    title: "Schulter- & Rückenmassage (ohne Zeitlimit)",
    subtitle: "Persönlicher Gutschein",
    type: "voucher",
    yearBadge: "Entspannung pur",
    voucherCode: "RELAX-GOLD-11",
    message:
      "Einlösbar sofort nach einem langen Arbeitstag, vor dem Einschlafen oder einfach zwischendurch am Wochenende. Kein kurzes Fünf-Minuten-Alibi — versprochen.",
  },
  {
    day: 12,
    title: "Halbzeit im Lichterglas",
    subtitle: "Kleiner Lichtfunke",
    type: "compliment",
    yearBadge: "12 von 24",
    complimentHighlight:
      "Du machst selbst gewöhnliche Dienstage zu Tagen, auf die ich mich morgens freue.",
    message:
      "Die Hälfte der Sterne leuchtet schon! Und das Beste daran: Nach all der Zeit wird es mit dir einfach immer schöner statt gewöhnlich.",
  },
  {
    day: 13,
    title: "Sonntagsfrühstück im Bett-Modus",
    subtitle: "Lieblingsritual",
    type: "polaroid",
    yearBadge: "Jahr 3 • 2023/24",
    // photoUrl: "./photos/tag-13.jpg",
    photoCaption: "Kaffee, warmes Licht und kein Wecker weit und breit",
    message:
      "Diese ruhigen Morgenstunden, wenn draußen noch alles schläft und drinnen nur die Tassen klappern, sind mein persönlicher Lieblingsort.",
  },
  {
    day: 14,
    title: "Frühstücks-Lieferservice ans Bett",
    subtitle: "Persönlicher Gutschein",
    type: "voucher",
    yearBadge: "Wochenend-Bonus",
    voucherCode: "BRUNCH-DELUXE-14",
    message:
      "Frische Brötchen oder Pancakes, genau dein Kaffee und Obst dazu — du bleibst einfach unter der Decke liegen, bis alles fertig serviert ist.",
  },
  {
    day: 15,
    title: "Warum ich dich im Team unschlagbar finde",
    subtitle: "Gedanke aus Jahr 4",
    type: "letter",
    yearBadge: "Jahr 4 • 2024/25",
    message:
      "In den letzten Jahren haben wir nicht nur schöne Tage gefeiert, sondern auch stressige Phasen gemeinsam weggesteckt.\n\nIch bewundere jedes Mal aufs Neue, wie ruhig, klug und warmherzig du an Dinge herangehst — und wie wir zusammen einfach funktionieren.",
  },
  {
    day: 16,
    title: "Deine kreative Energie",
    subtitle: "Kleiner Lichtfunke",
    type: "compliment",
    yearBadge: "Bewunderung",
    complimentHighlight:
      "Du gibst allem, was du anfasst, eine ganz eigene, liebevolle Handschrift.",
    message:
      "Ob ein Geschenk, eine Wohnungsecke oder ein Plan für das Wochenende — durch dich fühlt sich alles lebendiger an.",
  },
  {
    day: 17,
    title: "Ein Abendessen im Lieblingsrestaurant",
    subtitle: "Persönlicher Gutschein",
    type: "voucher",
    yearBadge: "Date Night",
    voucherCode: "DATE-NIGHT-17",
    message:
      "Such dir unser Lieblingslokal aus oder einen neuen Ort, den wir schon lange testen wollten. Wir putzen uns raus und stoßen auf die nächsten Jahre an.",
  },
  {
    day: 18,
    title: "Sommer-Flashback mitten im Dezember",
    subtitle: "Sonne im Polaroid",
    type: "polaroid",
    yearBadge: "Jahr 4 • 2024/25",
    // photoUrl: "./photos/tag-18.jpg",
    photoCaption: "Goldene Stunde, salzige Luft und das Gefühl von unendlich viel Zeit",
    message:
      "Falls dir der Dezember heute zu dunkel ist: Denk kurz an die warmen Abende aus diesem Jahr zurück, an denen wir erst heimgegangen sind, als alle Lichter ausgingen.",
  },
  {
    day: 19,
    title: "Du bist mein sicherer Hafen",
    subtitle: "Kleiner Lichtfunke",
    type: "compliment",
    yearBadge: "Herzstück",
    complimentHighlight:
      "Bei dir muss ich nie etwas vorspielen — neben dir darf alles einfach leicht sein.",
    message:
      "Nach fünf Jahren ist das vielleicht das größte Geschenk überhaupt: einfach nebeneinander atmen zu können und zu wissen, dass man angekommen ist.",
  },
  {
    day: 20,
    title: "Spaziergang mit Heißgetränk-Stopp",
    subtitle: "Persönlicher Gutschein",
    type: "voucher",
    yearBadge: "Winter-Auszeit",
    voucherCode: "WINTER-WALK-20",
    message:
      "Wir schnappen uns dicke Schals, laufen durch die Lichter und ich lade dich unterwegs auf Punsch, heiße Schokolade oder deinen Lieblingskaffee ein.",
  },
  {
    day: 21,
    title: "Die schönsten Zufälle aus Jahr 5",
    subtitle: "Ganz frisch aus diesem Jahr",
    type: "polaroid",
    yearBadge: "Jahr 5 • 2025/26",
    // photoUrl: "./photos/tag-21.jpg",
    photoCaption: "Fünf Jahre später und immer noch mein Lieblingsmensch auf jedem Bild",
    message:
      "Dieses letzte Jahr hat wieder gezeigt, wie viele neue Kapitel noch vor uns liegen. Ich freue mich auf jedes einzelne Foto, das noch dazukommt.",
  },
  {
    day: 22,
    title: "Noch zwei Mal schlafen",
    subtitle: "Brief vor dem Finale",
    type: "letter",
    yearBadge: "Jahr 5 • Countdown",
    message:
      "Schau dir das Glas heute noch einmal genau an — fast alle Sterne leuchten schon zusammen in ihrem warmen Licht.\n\nDanke für deine Geduld, deinen Humor, deine Umarmungen und dafür, dass du jeden Tag mit mir teilst.",
  },
  {
    day: 23,
    title: "Für immer mein Lieblings-Spätzle",
    subtitle: "Vorabend-Funke",
    type: "compliment",
    yearBadge: "Kurz vor Heiligabend",
    complimentHighlight:
      "Von allen Menschen auf dieser Welt würde ich in jedem Leben wieder dich wählen.",
    message:
      "Morgen öffnet sich der 24. Stern und das Glas verwandelt sich in unsere kleine Weihnachtskugel. Mach es dir heute Abend schon mal richtig gemütlich.",
  },
  {
    day: 24,
    title: "Frohe Weihnachten, mein Spätzle — Unser Sternbild",
    subtitle: "Heiligabend-Finale • Jahr 5",
    type: "voucher",
    yearBadge: "24. Dezember • Finale",
    voucherCode: "FÜR-IMMER-WIR-24",
    message:
      "Alle 24 Sterne leuchten jetzt zusammen! Schüttle das Glas noch einmal für den goldenen Schneekugel-Zauber.\n\nDein größter Gutschein zu Weihnachten: Ein gemeinsamer Kurzurlaub / Wochenendtrip im neuen Jahr — wohin wir wollen, wann wir wollen, Hauptsache wir zwei zusammen.\n\nIch liebe dich über alles. Auf unsere nächsten 5, 10 und 50 Jahre!",
  },
];
