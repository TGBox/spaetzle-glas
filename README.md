# Spätzle-Glas — Interaktiver 3D-Adventskalender zum 5-jährigen Jubiläum

Eine für iPhone (iOS Safari / Homescreen-PWA) und Mac optimierte WebGL-PWA mit Three.js, benutzerdefinierten GLSL-Shadern, eigener 3D-Sternphysik und prozeduralem Web-Audio-Windspiel.

## Features

- **Kosename-Schloss:** Einstieg über ihren Kosenamen für dich (`JAR_PASSWORDS` in `src/data/adventDays.ts`, Groß-/Kleinschreibung egal). Das Feld verrät die Lösung nicht; der Tipp auf „Glas öffnen“ schaltet zugleich Audio & iOS-Bewegungssensoren frei. Bei späteren Besuchen genügt ein Tipp auf „Glas aufwecken“.
- **24 Origami-Sterne im Glas:** Eigene, leichte 3D-Physik. Auf dem iPhone verhält sich das Glas wie ein echtes Glas in der Hand (siehe „Sensor-Interaktion“), am Mac per Maus/Trackpad.
- **Prozedurales Windspiel:** Pentatonische Klänge (D-Dur-Pentatonik) bei Kollisionen, Öffnungs-Akkorde und Stempel-Effekte direkt über die Web Audio API.
- **8 Karten-Formate:** Polaroid-Erinnerung, Liebesbrief, Rubbel-Gutschein, Kompliment-Funke, Audio-/Video-Erinnerung (`media`), Landkarte mit Fotos pro Ort (`map`), Quiz (`quiz`) und Buchstabiene (`bee`).
- **Rubbel-Gutscheine:** Jeder Gutschein liegt unter einer Goldfolie, die sie mit dem Finger freirubbelt (ab etwa der Hälfte löst sich der Rest). Erst danach erscheinen Titel, Text, Code und „Einlösen“.
- **Zwinkernde Sterne:** Sterne verpasster Tage zwinkern im Glas, und beim späten Öffnen begrüßt sie ein Satz aus `MISSED_DAY_NOTES`.
- **Erinnerungsbuch als PDF:** Nach dem 24. Stern erscheint in „Unsere 24 Momente“ der Knopf „Alle Momente als PDF speichern“. Er öffnet den Druckdialog des Geräts (dort „Als PDF sichern“). Videos und Audios erscheinen im PDF nur als Hinweis.
- **Sternbild & Heiligabend-Finale:** Geöffnete Sterne verbinden sich mit goldenen Lichtfäden; ab dem 24. Türchen startet der Schneekugel-Modus.

## Sensor-Interaktion (iPhone)

| Sensor | Was passiert |
| --- | --- |
| Lage (`DeviceOrientationEvent`) | Die Schwerkraft im Glas zeigt immer nach „echt unten“: kippen lässt die Sterne rutschen, kopfüber fallen sie an den Korken, flach auf dem Tisch legen sie sich an die Rückwand. Leichtes Neigen dreht außerdem den Blick ums Glas (Parallaxe). |
| Beschleunigung (`DeviceMotionEvent.acceleration`) | Jede Bewegung schubst die Sterne (Trägheit), nicht erst ab einer Schüttel-Schwelle. Beim Tragen klimpert das Glas leise. |
| Gyroskop (`rotationRate`) | Dreht sie das iPhone um die Hochachse, bleiben die Sterne kurz zurück und wirbeln im Glas. |
| Schütteln | Weckt den heutigen Stern: Er leuchtet mit jedem Schütteln heller, die Töne steigen an, dann öffnet er sich von selbst. Antippen geht weiterhin. |
| Touch | Finger durchs Glas ziehen rührt die Sterne um, ziehen dreht das Glas, aufs Glas tippen „klopft“ und lässt nahe Sterne hüpfen. |

Am Mac (ohne Sensoren) übernehmen Maus/Trackpad das Umrühren, Drehen und Klopfen; der Button „Schütteln“ ersetzt das Schütteln und verschwindet, sobald echte Sensordaten ankommen. Zusätzlich: leichtes haptisches Feedback bei Taps (wo der Browser es erlaubt) und ein Wake-Lock, damit das Display beim Schütteln nicht ausgeht.

## Inhalte anpassen (vor dem 1. Dezember)

1. **Texte, Titel & Gutscheine bearbeiten:**  
   Alle 24 Türchen liegen zentral und typsicher in [`src/data/adventDays.ts`](src/data/adventDays.ts).
2. **Eigene Fotos hinzufügen:**  
   Lege Bilder im Ordner `public/photos/` ab (z. B. `public/photos/tag-02.jpg`) und trage beim jeweiligen `polaroid`-Eintrag in `src/data/adventDays.ts` `photoUrl: "./photos/tag-02.jpg"` ein.
3. **Eigene Audio- & Videoclips hinzufügen (`type: "media"`):**  
   Lege Audiodateien (`.mp3`, `.m4a`) oder Videos (`.mp4`, `.mov`) in `public/media/` ab und setze beim jeweiligen `media`-Eintrag `audioUrl`, `videoUrl` (und optional `videoPosterUrl` für das Video-Vorschaubild). Es können Audio, Video oder beide gemeinsam auf derselben Karte eingebunden werden.
4. **Landkarte füllen (`type: "map"`, aktuell Tag 9):**  
   Trage unter `places` eure Orte ein: `name`, `latitude`, `longitude`, optional `date` und `note`, dazu unter `photos` ein oder mehrere Bilder aus `public/photos/`. Die Kartenkacheln kommen von OpenStreetMap und brauchen Internet; ohne Netz bleiben Stecknadeln, Ortsliste und Fotos nutzbar.
5. **Quiz anpassen (`type: "quiz"`, aktuell Tag 13):**  
   `quiz.question`, `quiz.options`, `quiz.correctIndex` (ab 0 gezählt) und optional `quiz.wrongHint`. `message` (und optional `photoUrl`) erscheinen erst nach der richtigen Antwort.
6. **Buchstabiene anpassen (`type: "bee"`, aktuell Tag 12 und 19):**  
   `bee.letters` sind die neun Waben (doppelte Buchstaben erlaubt), `bee.center` die Mitte, `bee.words` alle Wörter, die zählen. Eigene Wörter bekommen `special: true` und optional eine `note`, die beim Finden erscheint. Gibt es ein Wort mit allen neun Buchstaben (Pangramm), öffnet es die Botschaft; sonst öffnet sie sich, wenn alle `special`-Wörter gefunden sind. `npm test` prüft, dass jedes eingetragene Wort mit den Waben spielbar ist.
7. **Alle 24 Tage vorab testen (Vorschau-Modus):**  
   Hänge `?preview=true` an die URL an (z. B. `http://localhost:5173/?preview=true`) oder tippe im geöffneten Glas **5× kurz hintereinander auf die Unterzeile** („5 Jahre wir • Advents-Glas“).

## Entwicklung & Verifizierung

```bash
npm install
npm run dev        # Lokaler Entwicklungsserver (Vite)
npm run typecheck  # Strikte TypeScript-Prüfung
npm test           # Vitest Test-Suite
npm run build      # Statisches Production-Bundle in dist/
```

## Kostenloses Hosting

Das gebaute `dist/`-Verzeichnis ist eine rein statische PWA (inkl. `manifest.webmanifest` und `sw.js`) und kann direkt und kostenlos über **Vercel**, **Netlify**, **Cloudflare Pages** oder **GitHub Pages** bereitgestellt werden. Wichtig: Für den iPhone-Schüttelsensor wird **HTTPS** benötigt (bei allen genannten Hostern automatisch aktiv).
