# Spätzle-Glas: 3D-Adventskalender zum 5-jährigen Jubiläum

## Problem Statement

Wie können wir deiner Freundin zum 5-jährigen Jubiläum am 1. Dezember ein magisches, taktiles 3D-Adventskalender-Erlebnis auf ihr iPhone (und ihren Mac) zaubern, das sich beim Schütteln, Hören und Öffnen der 24 Erinnerungen so warm und persönlich anfühlt wie ein handgemachtes Geschenk – und garantiert innerhalb von 14 Tagen stabil in iOS Safari läuft?

## Recommended Direction („Konstellation im Lichterglas“)

Eine als PWA installierbare WebGL-Szene (Vite + TypeScript + Three.js + Web Audio API) in warmer Winter-Lichter-Ästhetik („Für mein Spätzle“).
Beim ersten Öffnen gibt sie euer Jubiläumsdatum als Schlüssel ein; dieser Tap entriegelt das Glas, startet die prozedurale Klangwelt und aktiviert den iPhone-Schüttelsensor.

Im Glas liegen 24 Origami-Sterne (nummeriert von 1 bis 24) mit einer leichtgewichtigen, auf 60 FPS optimierten Eigenphysik:

- **Zukünftige Tage:** Schlummern in mattem Pergament; beim Antippen wackeln sie geheimnisvoll mit einem sanften dumpfen Holz-/Glockenton („Dieses Türchen erwacht erst am X. Dezember ✨“).
- **Der heutige Tag:** Pulsiert golden, hat leichten Auftrieb und erzeugt beim Antippen einen warmen Akkord, fliegt in den Vordergrund und entfaltet sich.
- **Bereits geöffnete Tage:** Leuchten dauerhaft warm-bernsteinfarben im Glas und sind durch feine goldene Lichtfäden miteinander verbunden (Richtung A), sodass das Glas bis Weihnachten immer heller strahlt.
- **Schüttel-Interaktion:** Schüttelt sie das iPhone (oder wischt/klickt am Mac), wirbeln die Sterne im Glas durcheinander und erzeugen bei Kollisionen sanfte, pentatonische Windspiel-Klänge, die harmonisch nie schief klingen können.

## Die 5 Karten-Formate beim Öffnen

Jeder der 24 Tage wird in einer typsicheren TypeScript-Datei definiert und nutzt eines von fünf edlen Papier-/Bühnen-Layouts:

1. **Polaroid-Erinnerung:** Gemeinsames Foto aus den 5 Jahren + Datum/Ort + persönliche Notiz.
2. **Liebesbrief / Insider:** Strukturiertes Briefpapier für längere Erinnerungen oder Insider-Witze.
3. **Interaktiver Gutschein:** Ticket-Design mit „Einlösen“-Button, der lokal einen Herz-Stempel („Eingelöst am ...“) auf das Ticket setzt.
4. **Kompliment-Funke:** Kurze, strahlende Botschaft mit besonderem Partikel-Schauer im Hintergrund.
5. **Audio- & Video-Erinnerung (`media`):** Inline-Video-Player (`playsinline` für iOS Safari) und/oder Sprachnachricht-/Musik-Audio-Player mit Klangwellen-Optik.

## Heiligabend-Finale & Galerie (ab 24. Dezember)

Sobald alle 24 Sterne erwacht sind, schaltet das Glas den **Schneekugel-Modus** frei (goldene Lichtfunken beim Schütteln + festlicher Klangteppich + 3D-Herz-Sternbild). Über eine dezente **„Unsere 24 Momente“-Übersicht** kann sie jederzeit alle bereits geöffneten Karten gesammelt durchblättern.

## Key Assumptions to Validate

- [ ] **iOS Sensor- & Audio-Unlock:** Beim Klick auf „Glas entriegeln“ im Jubiläums-Screen werden `DeviceMotionEvent.requestPermission()` und `WebAudio` zuverlässig in iOS Safari aktiviert (Fallback: Touch-Drag / Schüttel-Button für Mac & verweigerte Berechtigung).
- [ ] **60 FPS & Glas-Look auf dem iPhone:** Performanter Custom-GLSL-Fresnel-Glas-Shader statt schwerem `MeshPhysicalMaterial`-Transmission-Pass, sodass iPhone und Mac dauerhaft 60 FPS halten.
- [ ] **Einfache Content-Befüllung:** Alle 24 Türchen lassen sich über `src/data/adventDays.ts` plus Foto-Ordner (`public/photos/`) zentral pflegen; ein geheimer Preview-Parameter (`?preview=true` oder 5x Tippen auf die Unterzeile) ermöglicht das Testen aller 24 Tage vorab.

## MVP Scope (In 14 Tagen fertig & poliert)

- **In Scope:**
  - Jubiläums-Lockscreen (Code-Prüfung + iOS Audio/Motion-Freischaltung)
  - 3D-Glas mit 24 nummerierten Origami-Sternen (4 visuelle Zustände: verschlossen, heute, vergangen-offenbar, geöffnet)
  - Eigene Impuls-/Sphären-Physik im Glas (iPhone-Accelerometer + Maus/Touch-Wischen am Mac)
  - Prozeduraler Web-Audio-Synthesizer (Pentatonisches Windspiel bei Kollision + Öffnungs-Akkord + Stummschalter)
  - 5 Karten-Komponenten (Polaroid, Brief, Gutschein mit Stempel, Kompliment, Audio/Video) + Erinnerungs-Galerie
  - Heiligabend-Schneekugel-Effekt & Sternbild-Verbindungen
  - PWA-Manifest & iOS-Homescreen-Icons („Für mein Spätzle“)
  - Geheimer Vorschau-/Testmodus zum Prüfen aller 24 Tage

## Not Doing (und warum)

- **Keine externe 3D-Physik-Engine (`cannon-es` / `Rapier`):** Spart ~200 KB Bundle-Größe, verhindert Verkanten von Origami-Spitzen und garantiert 60 FPS auf dem iPhone.
- **Kein Backend / Cloud-Sync:** Lokaler `localStorage` reicht völlig; da vergangene Tage im Dezember frei antippbar sind, geht selbst bei einem Gerätewechsel nichts verloren.
- **Kein CMS / Admin-Dashboard:** Die 24 Einträge werden direkt und typsicher in `src/data/adventDays.ts` vor dem 1. Dezember gepflegt.
- **Keine schwere 3D-Falt-Animation pro Papierkarte:** Der Stern leuchtet auf und öffnet eine gestochen scharfe HTML/CSS-Karte mit butterweicher CSS-Transition (viel bessere Lesbarkeit für Fotos und Texte auf dem iPhone).
