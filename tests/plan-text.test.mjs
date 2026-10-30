import assert from "node:assert/strict";
import test from "node:test";

import { pageQuality, parsePlanText } from "../src/lib/plans/pages.ts";
import { locateQuote } from "../src/lib/plans/quotes.ts";

// Failure modes:
// 1. Page markers parse off by one, so a quote links to the wrong PDF page.
// 2. A true quote fails on a line break, hyphenation, a word split by a stray space, or quote style.
// 3. A quote the plan does not contain passes, including a short phrase that matches anywhere.
// 4. A quote found on a neighbouring page keeps the page the model cited.
// 5. A page of extraction garbage counts as text the brief can quote.

// From Chibombo's plan (PDF page 36) and Žabari's (PDF page 60), as Phase 0 extracted them.
const planText = `URL: https://example.test/chibombo.pdf
Pages: 3

=== page 35 ===

condition of appropriate essential health infrastructure so as to improve equity of access to quality
health care services, the district needs to focus on the construction of new health infrastructure and

=== page 36 ===

CHIBOMBO DISTRICT INTEGRATED DEVELOPMENT PLAN 2023-2033
Page 25
the upgrading, expansion, and renovation of existing health infrastructure. Proposed investment
programmes include Construction of a General Hospital (Specialized), Constriction of a District
Hospital, Constriction of four first level Hospitals, Upgrading of Health post to Rural Health Centre,
Connection of health facilities to the national grid (Zesco Power Supply), Construction of modern
maternity annexes, with incinerators, water reticulation system and altenative power supply.

=== page 37 ===

Присутна је и металска индустрија, тако да у насељу Симићево постоји Фабрика
специјалне опреме „Гошћа“, Када су прерађивачки капацитети у питању, исти постоје у
Симићеву, Оре овици и Александровцу.
`;

const { url, pages } = parsePlanText(planText);

test("page markers give each page its PDF page number", () => {
  assert.equal(url, "https://example.test/chibombo.pdf");
  assert.deepEqual(pages.map((page) => page.num), [35, 36, 37]);
  assert.match(pages[1].text, /^CHIBOMBO DISTRICT/);
  assert.match(pages[1].text, /power supply\.$/);
});

test("a true quote matches across line breaks, split words, and quote styles", () => {
  const acrossLines = locateQuote("Construction of a General Hospital (Specialized), Constriction of a District Hospital", pages, 36);
  assert.deepEqual(acrossLines, { status: "exact", page: 36, similarity: 1 });

  const splitWord = locateQuote("исти постоје у Симићеву, Ореовици и Александровцу", pages, 37);
  assert.equal(splitWord.status, "exact");

  const quoteStyle = locateQuote('Фабрика специјалне опреме "Гошћа"', pages, 37);
  assert.equal(quoteStyle.status, "exact");
});

test("a quote with a few characters the PDF text broke matches fuzzily on its page", () => {
  const match = locateQuote("Construction of modern maternity annexes, with incinerators, water reticulation system and alternative power supply", pages, 36);
  assert.equal(match.status, "fuzzy");
  assert.equal(match.page, 36);
});

test("a quote the plan does not contain, or one too short to prove anything, fails", () => {
  assert.equal(locateQuote("Construction of a new international airport and a district stadium by 2026", pages, 36).status, "unmatched");
  assert.equal(locateQuote("Construction of a District Hospital and four new first level hospitals by 2030", pages, 36).status, "unmatched");
  assert.equal(locateQuote("health infrastructure", pages, 36).status, "too short");
});

test("a quote that runs across a page break matches, on the page it starts on", () => {
  // From Phase 3a: a Serbian sentence split over pages 34 and 35 was dropped as unmatched.
  const split = [
    { num: 34, text: "Мобилна телефонија функционише преко провајдера. Изграђени су\nантенски системи и базне станице мобилне телефоније на појединим локацијама, а" },
    { num: 35, text: "по плановима развоја надлежних предузећа планира се изградња истих и у осталим насељима." },
  ];
  const match = locateQuote("Изграђени су антенски системи и базне станице мобилне телефоније на појединим локацијама, а по плановима развоја надлежних предузећа планира се изградња истих", split, 34);
  assert.deepEqual(match, { status: "exact", page: 34, similarity: 1 });
});

test("a quote on a neighbouring page is given the page it is on", () => {
  const match = locateQuote("the district needs to focus on the construction of new health infrastructure", pages, 36);
  assert.deepEqual(match, { status: "exact", page: 35, similarity: 1 });
});

test("empty and garbled pages are flagged", () => {
  assert.equal(pageQuality(pages[1].text), "ok");
  assert.equal(pageQuality("12\n\n"), "empty");
  const acrossColumns = "T h e d i s t r i c t w i l l c o n s t r u c t a h o s p i t a l i n e a c h w a r d b y t w o t h o u s a n d t h i r t y".repeat(2);
  assert.equal(pageQuality(acrossColumns), "garbled");
  assert.equal(pageQuality("��� ".repeat(40) + "health facility construction programme"), "garbled");
});
