import { isBeeSolved, normalizeBeeWord } from "../domain/beeRules";
import type { AdventDay, PersistedAppState } from "../types/advent";
import { escapeHtml } from "./html";

function photoMarkup(url: string, alt: string): string {
  return `<img class="print-photo" src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" />`;
}

function messageMarkup(message: string): string {
  return `<p class="print-message">${escapeHtml(message)}</p>`;
}

function buildDayBody(day: AdventDay, state: PersistedAppState): string {
  switch (day.type) {
    case "polaroid": {
      const photo = day.photoUrl ? photoMarkup(day.photoUrl, day.title) : "";
      const caption = day.photoCaption
        ? `<p class="print-caption">${escapeHtml(day.photoCaption)}</p>`
        : "";
      return `${photo}${caption}${messageMarkup(day.message)}`;
    }
    case "voucher": {
      const code = day.voucherCode
        ? `<p class="print-code">Gutschein-Code: <strong>${escapeHtml(day.voucherCode)}</strong></p>`
        : "";
      const redeemedDate = state.redeemedVouchers[day.day];
      const status = redeemedDate
        ? `<p class="print-stamp">Eingelöst am ${escapeHtml(redeemedDate)} ♥</p>`
        : `<p class="print-open">Noch einzulösen</p>`;
      return `${messageMarkup(day.message)}${code}${status}`;
    }
    case "stats": {
      const tiles = (day.stats ?? [])
        .map(
          (stat) =>
            `<li><strong>${escapeHtml(stat.value)}</strong> ${escapeHtml(stat.label)}${stat.note ? ` <span class="print-caption">(${escapeHtml(stat.note)})</span>` : ""}</li>`
        )
        .join("");
      return `<ul class="print-stats">${tiles}</ul>${messageMarkup(day.message)}`;
    }
    case "compliment": {
      const highlight = day.complimentHighlight ?? day.title;
      return `<p class="print-quote">„${escapeHtml(highlight)}“</p>${messageMarkup(day.message)}`;
    }
    case "media": {
      const poster = day.videoPosterUrl
        ? photoMarkup(day.videoPosterUrl, day.title)
        : "";
      const kinds = [
        day.videoUrl ? "ein Video" : "",
        day.audioUrl ? "eine Aufnahme zum Anhören" : "",
      ].filter((kind) => kind.length > 0);
      const note =
        kinds.length > 0
          ? `<p class="print-note">Zu diesem Stern gehört ${kinds.join(" und ")}. Öffne ihn im Glas, um es abzuspielen.</p>`
          : "";
      const caption = day.mediaCaption
        ? `<p class="print-caption">${escapeHtml(day.mediaCaption)}</p>`
        : "";
      return `${poster}${caption}${note}${messageMarkup(day.message)}`;
    }
    case "map": {
      const places = (day.places ?? [])
        .map((place) => {
          const meta = [place.date, place.note]
            .filter((part): part is string => Boolean(part))
            .map(escapeHtml)
            .join(" · ");
          const photos = place.photos
            .map((url) => photoMarkup(url, place.name))
            .join("");
          return `
            <div class="print-place">
              <h3 class="print-place-name">${escapeHtml(place.name)}</h3>
              ${meta ? `<p class="print-caption">${meta}</p>` : ""}
              <div class="print-photo-grid">${photos}</div>
            </div>`;
        })
        .join("");
      return `${messageMarkup(day.message)}${places}`;
    }
    case "quiz": {
      const quiz = day.quiz;
      const question = quiz
        ? `<p class="print-quote">${escapeHtml(quiz.question)}</p>
           <p class="print-caption">Richtige Antwort: ${escapeHtml(quiz.options[quiz.correctIndex] ?? "")}</p>`
        : "";
      const photo = day.photoUrl ? photoMarkup(day.photoUrl, day.title) : "";
      return `${question}${photo}${messageMarkup(day.message)}`;
    }
    case "bee": {
      const found = state.beeFoundWords[day.day] ?? [];
      const special = new Set(
        (day.bee?.words ?? [])
          .filter((entry) => entry.special)
          .map((entry) => normalizeBeeWord(entry.word))
      );
      const wordList = [...found]
        .sort((a, b) => a.localeCompare(b, "de"))
        .map((word) =>
          special.has(word) ? `<strong>${escapeHtml(word)}</strong>` : escapeHtml(word)
        )
        .join(" · ");
      const solved = day.bee ? isBeeSolved(day.bee, found) : false;
      const photo = solved && day.photoUrl ? photoMarkup(day.photoUrl, day.title) : "";
      return `
        <p class="print-caption">Gefundene Wörter: ${wordList || "noch keine"}</p>
        ${photo}
        ${solved ? messageMarkup(day.message) : `<p class="print-note">Die Botschaft wartet noch im Glas.</p>`}`;
    }
    case "letter":
      return messageMarkup(day.message);
  }
}

/**
 * Builds the printable keepsake ("Unsere 24 Momente") as static HTML:
 * a cover page followed by one section per opened day. Unopened days are left out
 * so the book never spoils a star.
 */
export function buildPrintBookHtml(
  days: readonly AdventDay[],
  state: PersistedAppState
): string {
  const opened = new Set<number>(state.openedDays);
  const sections = days
    .filter((day) => opened.has(day.day))
    .map((day) => {
      // An unsolved quiz or unscratched voucher is opened but not yet revealed.
      const hidden =
        (day.type === "quiz" && !state.solvedQuizzes.includes(day.day)) ||
        (day.type === "voucher" && !state.scratchedVouchers.includes(day.day));
      const subtitle = day.subtitle
        ? `<p class="print-subtitle">${escapeHtml(day.subtitle)}</p>`
        : "";
      const body = hidden
        ? `<p class="print-note">Dieser Stern ist noch nicht ganz enthüllt. Öffne ihn im Glas.</p>`
        : buildDayBody(day, state);
      const title = hidden ? `Stern ${day.day}` : day.title;

      return `
        <section class="print-page">
          <p class="print-day">${day.day}. Dezember · ${escapeHtml(day.yearBadge)}</p>
          <h2 class="print-title">${escapeHtml(title)}</h2>
          ${hidden ? "" : subtitle}
          ${body}
        </section>`;
    })
    .join("");

  return `
    <section class="print-page print-cover">
      <p class="print-kicker">5 Jahre wir</p>
      <h1 class="print-cover-title">Für mein Spätzle</h1>
      <p class="print-cover-subtitle">Unsere 24 Momente · Advent 2026</p>
    </section>
    ${sections}`;
}
