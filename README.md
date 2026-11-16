# Spätzle-Glas — Interaktiver 3D-Adventskalender zum 5-jährigen Jubiläum

Eine für iPhone (iOS Safari / Homescreen-PWA) und Mac optimierte WebGL-PWA mit Three.js, benutzerdefinierten GLSL-Shadern, eigener 3D-Sternphysik und prozeduralem Web-Audio-Windspiel.

## Features

- **Jubiläums-Schloss:** Einstieg über euer Jubiläumsdatum (`01.12.2021`), das zugleich Audio & iOS-Bewegungssensoren freischaltet.
- **24 Origami-Sterne im Glas:** Eigene, leichte 3D-Physik mit iPhone-Schüttelerkennung (`DeviceMotionEvent`), Neigungs-Schwerkraft (`DeviceOrientationEvent`) sowie Maus-/Touch-Interaktion am Mac.
- **Prozedurales Windspiel:** Pentatonische Klänge (D-Dur-Pentatonik) bei Kollisionen, Öffnungs-Akkorde und Stempel-Effekte direkt über die Web Audio API.
- **5 Karten-Formate:** Polaroid-Erinnerung, Liebesbrief, abstempelbarer Gutschein, Kompliment-Funke und Audio-/Video-Erinnerung (`media`).
- **Sternbild & Heiligabend-Finale:** Geöffnete Sterne verbinden sich mit goldenen Lichtfäden; ab dem 24. Türchen startet der Schneekugel-Modus.

## Inhalte anpassen (vor dem 1. Dezember)

1. **Texte, Titel & Gutscheine bearbeiten:**  
   Alle 24 Türchen liegen zentral und typsicher in [`src/data/adventDays.ts`](src/data/adventDays.ts).
2. **Eigene Fotos hinzufügen:**  
   Lege Bilder im Ordner `public/photos/` ab (z. B. `public/photos/tag-02.jpg`) und trage beim jeweiligen `polaroid`-Eintrag in `src/data/adventDays.ts` `photoUrl: "./photos/tag-02.jpg"` ein.
3. **Eigene Audio- & Videoclips hinzufügen (`type: "media"`):**  
   Lege Audiodateien (`.mp3`, `.m4a`) oder Videos (`.mp4`, `.mov`) in `public/media/` ab und setze beim jeweiligen `media`-Eintrag `audioUrl`, `videoUrl` (und optional `videoPosterUrl` für das Video-Vorschaubild). Es können Audio, Video oder beide gemeinsam auf derselben Karte eingebunden werden.
4. **Alle 24 Tage vorab testen (Vorschau-Modus):**  
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
