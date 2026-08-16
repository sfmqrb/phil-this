// Full index of every scraped transcript (id, filename, rough label).
// Used to let the user browse/request episodes that don't have a quiz yet.
const EPISODE_INDEX = [
  {
    "id": 1,
    "url": "https://www.philosophizethis.org/podcast/ionian-pre-socratic-philosophy-9r2x8",
    "file": "001-episode-001-transcript.md",
    "label": "Episode 1"
  },
  {
    "id": 2,
    "url": "https://www.philosophizethis.org/podcast/episode-2-italian-pre-socratic-philosophy-hb237",
    "file": "002-episode-2-transcript.md",
    "label": "Episode 2"
  },
  {
    "id": 3,
    "url": "https://www.philosophizethis.org/podcast/socrates-98cdl",
    "file": "003-socrates-sophists-episode-3-transcript.md",
    "label": "Socrates sophists"
  },
  {
    "id": 4,
    "url": "https://www.philosophizethis.org/podcast/plato-jl6ng",
    "file": "004-plato-episode-4-transcript.md",
    "label": "Plato"
  },
  {
    "id": 5,
    "url": "https://www.philosophizethis.org/podcast/aristotle-part-1-8z586",
    "file": "005-episode-5-aristotles-ethics-transcript.md",
    "label": "Aristotles ethics"
  },
  {
    "id": 6,
    "url": "https://www.philosophizethis.org/podcast/aristotle-part-2-axker",
    "file": "006-episode-006-transcript.md",
    "label": "Aristotle Part 2"
  },
  {
    "id": 7,
    "url": "https://www.philosophizethis.org/podcast/daoism-lda6l",
    "file": "007-episode-007-transcript.md",
    "label": "Daoism"
  },
  {
    "id": 8,
    "url": "https://www.philosophizethis.org/podcast/confucianism-x84be",
    "file": "008-episode-008-transcript.md",
    "label": "Confucianism"
  },
  {
    "id": 9,
    "url": "https://www.philosophizethis.org/podcast/the-buddha-6j7hj",
    "file": "009-episode-009-transcript.md",
    "label": "Episode 9"
  },
  {
    "id": 10,
    "url": "https://www.philosophizethis.org/podcast/hellenistic-age-1-epicurus-msntc",
    "file": "010-episode-10-transcript.md",
    "label": "The Hellenistic Age Pt. 1 - Epicurus"
  },
  {
    "id": 11,
    "url": "https://www.philosophizethis.org/podcast/the-early-stoa-72e6f",
    "file": "011-stoicism-early-cynics-episode-11-transcript.md",
    "label": "Stoicism early cynics"
  },
  {
    "id": 12,
    "url": "https://www.philosophizethis.org/podcast/hellenistic-age-3-hallmarks-of-stoic-ethics-em8yt",
    "file": "012-episode-12-transcript.md",
    "label": "The Hellenistic Age Pt. 3 - Hallmarks of Stoic Ethics"
  },
  {
    "id": 13,
    "url": "https://www.philosophizethis.org/podcast/hellenistic-age-3-skepticism-gpz9p",
    "file": "013-skeptics-episode-13-transcript.md",
    "label": "Skeptics"
  },
  {
    "id": 14,
    "url": "https://www.philosophizethis.org/podcast/hellenistic-age-5-race-to-the-dark-ages-b2tsj",
    "file": "014-end-of-antiquity-philosophy-episode-14-transcript.md",
    "label": "The Hellenistic Age Pt. 5 - A Race to the Dark Ages"
  },
  {
    "id": 15,
    "url": "https://www.philosophizethis.org/podcast/plotinus-a-period-of-transition-38z8d",
    "file": "015-philosophy-of-plotinus-episode-15-transcript.md",
    "label": "Philosophy of plotinus"
  },
  {
    "id": 16,
    "url": "https://www.philosophizethis.org/podcast/saint-augustine-hj3ph",
    "file": "016-saint-augustine-philosophy-episode-16-transcript.md",
    "label": "Saint Augustine"
  },
  {
    "id": 17,
    "url": "https://www.philosophizethis.org/podcast/episode-17-boethius-pxrwn",
    "file": "017-boethius-philosophy-episode-17-transcript.md",
    "label": "Boethius"
  },
  {
    "id": 18,
    "url": "https://www.philosophizethis.org/podcast/avicenna-mz68j",
    "file": "018-avicenna-philosophy-episode-18-transcript.md",
    "label": "Avicenna"
  },
  {
    "id": 19,
    "url": "https://www.philosophizethis.org/podcast/episode-19-three-islamic-truths-58j6g",
    "file": "019-islamic-truths-episode-19-transcript.md",
    "label": "Three Islamic Truths"
  },
  {
    "id": 20,
    "url": "https://www.philosophizethis.org/podcast/episode-20-two-medieval-approaches-to-god-pm347",
    "file": "020-episode-20-two-medival-approaches-to-god-transcript.md",
    "label": "Two Medieval Approaches To God"
  },
  {
    "id": 21,
    "url": "https://www.philosophizethis.org/podcast/episode-21-saint-thomas-aquinas-pmcsw",
    "file": "021-saint-thomas-aquinas-philosophy.md",
    "label": "Saint Thomas Aquinas"
  },
  {
    "id": 22,
    "url": "https://www.philosophizethis.org/podcast/renaissance-philosophy-bfs2a",
    "file": "022-renaissance-philosophy-episode-22-transcript.md",
    "label": "Renaissance philosophy"
  },
  {
    "id": 23,
    "url": "https://www.philosophizethis.org/podcast/machiavelli-protestant-reformation-ac483",
    "file": "023-machiavelli-protestant-reformation-episode-23-transcript.md",
    "label": "Machiavelli"
  },
  {
    "id": 24,
    "url": "https://www.philosophizethis.org/podcast/montaigne-6fp82",
    "file": "024-philosophy-michel-de-montaigne-episode-24-transcript.md",
    "label": "Montaigne"
  },
  {
    "id": 25,
    "url": "https://www.philosophizethis.org/podcast/francis-bacon-scientific-method-zlbtj",
    "file": "025-episode-025-transcript.md",
    "label": "A Scientific Method For Your Life!"
  },
  {
    "id": 26,
    "url": "https://www.philosophizethis.org/podcast/thomas-hobbes-social-contract-mttgr",
    "file": "026-hobbes-pt-1-transcript.md",
    "label": "Hobbes pt"
  },
  {
    "id": 27,
    "url": "https://www.philosophizethis.org/podcast/thomas-hobbes-ck7zj",
    "file": "027-thomas-hobbes-transcript.md",
    "label": "Thomas Hobbes Pt. 2"
  },
  {
    "id": 28,
    "url": "https://www.philosophizethis.org/podcast/descartes-dl6x8",
    "file": "028-descartes-pt-1-transcript.md",
    "label": "Descartes Pt. 1 - A Little Context"
  },
  {
    "id": 29,
    "url": "https://www.philosophizethis.org/podcast/descartes-pt2-7dw8l",
    "file": "029-descartes-pt-2-transcript.md",
    "label": "Descartes Pt. 2"
  },
  {
    "id": 30,
    "url": "https://www.philosophizethis.org/podcast/god-exists-3w864",
    "file": "030-god-exists-transcript.md",
    "label": "Rene Descartes Pt. 3 - God Exists"
  },
  {
    "id": 31,
    "url": "https://www.philosophizethis.org/podcast/pascals-wager-zktzk",
    "file": "031-pascals-wager-transcript.md",
    "label": "Pascal's Wager"
  },
  {
    "id": 32,
    "url": "https://www.philosophizethis.org/podcast/blaise-pascal-aflgw",
    "file": "032-pascal-pt-2-transcript.md",
    "label": "+EV your way to success!!"
  },
  {
    "id": 33,
    "url": "https://www.philosophizethis.org/podcast/from-baruch-to-benedicto-lr7nt",
    "file": "033-spinoza-pt-1-transcript.md",
    "label": "Spinoza pt"
  },
  {
    "id": 34,
    "url": "https://www.philosophizethis.org/podcast/spinoza-njk4a",
    "file": "034-spinoza-pt-2-transcript.md",
    "label": "Spinoza pt"
  },
  {
    "id": 35,
    "url": "https://www.philosophizethis.org/podcast/from-sea-to-shining-sea-ysm5m",
    "file": "035-john-locke-pt-1.md",
    "label": "John locke pt"
  },
  {
    "id": 36,
    "url": "https://www.philosophizethis.org/podcast/john-locke-rsxrn",
    "file": "036-john-locke-pt-2-transcript.md",
    "label": "John locke pt"
  },
  {
    "id": 37,
    "url": "https://www.philosophizethis.org/podcast/a-million-points-of-light-347e7",
    "file": "037-leibniz-pt-1-transcript.md",
    "label": "Leibniz pt"
  },
  {
    "id": 38,
    "url": "https://www.philosophizethis.org/podcast/the-best-of-all-possible-worlds-a58f4",
    "file": "038-leibniz-pt-2-transcript.md",
    "label": "Leibniz pt"
  },
  {
    "id": 39,
    "url": "https://www.philosophizethis.org/podcast/before-our-very-eyes-brjes",
    "file": "039-episode-39-transcript.md",
    "label": "Episode 39"
  },
  {
    "id": 40,
    "url": "https://www.philosophizethis.org/podcast/superstition-rk2zx",
    "file": "040-transcript-episode-40.md",
    "label": "Episode 40"
  },
  {
    "id": 41,
    "url": "https://www.philosophizethis.org/podcast/belief-5d6mr",
    "file": "041-episode-41-transcript.md",
    "label": "Episode 41"
  },
  {
    "id": 42,
    "url": "https://www.philosophizethis.org/podcast/optimism-b6kx5",
    "file": "042-episode-42-transcript.md",
    "label": "Episode 42"
  },
  {
    "id": 43,
    "url": "https://www.philosophizethis.org/podcast/tolerance-al4x8",
    "file": "043-episode-43-transcript.md",
    "label": "Episode 43"
  },
  {
    "id": 44,
    "url": "https://www.philosophizethis.org/podcast/slavery-kfb7m",
    "file": "044-episode-44-transcript.md",
    "label": "Episode 44"
  },
  {
    "id": 45,
    "url": "https://www.philosophizethis.org/podcast/rousseau-government-f969b",
    "file": "045-transcript-government.md",
    "label": "Government"
  },
  {
    "id": 46,
    "url": "https://www.philosophizethis.org/podcast/rousseau-pt-2-ex68a",
    "file": "046-episode-46-transcript.md",
    "label": "Rousseau Pt. 2"
  },
  {
    "id": 47,
    "url": "https://www.philosophizethis.org/podcast/the-general-will-8kpmp",
    "file": "047-episode-47-transcript.md",
    "label": "Rousseau Pt. 3 - The General Will"
  },
  {
    "id": 48,
    "url": "https://www.philosophizethis.org/podcast/specialization-g8pbz",
    "file": "048-transcript-episode-48.md",
    "label": "Adam Smith Pt. 1 - Specialization"
  },
  {
    "id": 49,
    "url": "https://www.philosophizethis.org/podcast/wealth-of-nations-lj6ph",
    "file": "049-episode-49-transcript.md",
    "label": "Adam Smith Pt. 2 - The Tip of the Iceberg Of Wealth"
  },
  {
    "id": 50,
    "url": "https://www.philosophizethis.org/podcast/edmund-burke-caw68",
    "file": "050-episode-50-transcript.md",
    "label": "Are You Left Or Right?"
  },
  {
    "id": 51,
    "url": "https://www.philosophizethis.org/podcast/david-hume-7waml",
    "file": "051-episode-51-transcript.md",
    "label": "David Hume Pt. 1"
  },
  {
    "id": 52,
    "url": "https://www.philosophizethis.org/podcast/david-hume-pt2-g685x",
    "file": "052-episode-52-transcript.md",
    "label": "David Hume Pt. 2"
  },
  {
    "id": 53,
    "url": "https://www.philosophizethis.org/podcast/david-hume-pt3-mbc8z",
    "file": "053-episode-53-transcript.md",
    "label": "Episode 53"
  },
  {
    "id": 54,
    "url": "https://www.philosophizethis.org/podcast/david-hume-art-prcgk",
    "file": "054-episode-54-transcript.md",
    "label": "David Hume Pt. 4 - Art"
  },
  {
    "id": 55,
    "url": "https://www.philosophizethis.org/podcast/interview-massimo-pigliucci-6lm4e",
    "file": "055-episode-055-transcript.md",
    "label": "Interview on Hume with Massimo Pigliucci"
  },
  {
    "id": 56,
    "url": "https://www.philosophizethis.org/podcast/episode-056-kant-pt-1-an-introduction-to-the-introduction",
    "file": "056-episode-056-transcript.md",
    "label": "Kant Pt. 1 - An Introduction to the Introduction"
  },
  {
    "id": 57,
    "url": "https://www.philosophizethis.org/podcast/kant-pt-2",
    "file": "057-episode-57-transcript.md",
    "label": "Kant Pt. 2 - The Introduction"
  },
  {
    "id": 58,
    "url": "https://www.philosophizethis.org/podcast/deontology-vs-consequentialism",
    "file": "058-episode-58-transcript.md",
    "label": "Kant pt. 3 - Deontology vs. Consequentialism"
  },
  {
    "id": 59,
    "url": "https://www.philosophizethis.org/podcast/trolley-cars",
    "file": "059-episode-59-transcript.md",
    "label": "Kant Pt. 4 - Categorical Trolley Cars"
  },
  {
    "id": 60,
    "url": "https://www.philosophizethis.org/podcast/the-sublime",
    "file": "060-episode-60-transcript.md",
    "label": "Kant Pt. 5 - The Sublime"
  },
  {
    "id": 61,
    "url": "https://www.philosophizethis.org/podcast/what-is-enlightenment",
    "file": "061-episode-61-transcript.md",
    "label": "Kant Pt. 6 - What is Enlightenment?"
  },
  {
    "id": 62,
    "url": "https://www.philosophizethis.org/podcast/suicide",
    "file": "062-episode-62-transcript.md",
    "label": "Kant Pt. 7 - Suicide"
  },
  {
    "id": 63,
    "url": "https://www.philosophizethis.org/podcast/limitations-of-knowledge",
    "file": "063-episode-63-transcript.md",
    "label": "Kant Pt. 8 - Limitations of Knowledge"
  },
  {
    "id": 64,
    "url": "https://www.philosophizethis.org/podcast/hermaneutics",
    "file": "064-episode-64-transcript.md",
    "label": "Hermeneutics: Interpreting Interpretations"
  },
  {
    "id": 65,
    "url": "https://www.philosophizethis.org/podcast/episode-065-mary-wollstonecraft",
    "file": "065-episode-065-transcript.md",
    "label": "Mary Wollstonecraft"
  },
  {
    "id": 66,
    "url": "https://www.philosophizethis.org/podcast/episode-066-hegel-pt-1-introduction",
    "file": "066-episode-066-transcript.md",
    "label": "Hegel Pt. 1 - Introduction"
  },
  {
    "id": 67,
    "url": "https://www.philosophizethis.org/podcast/episode-067-what-hegel-was-saying",
    "file": "067-episode-067-transcript.md",
    "label": "What Hegel Was Saying!"
  },
  {
    "id": 68,
    "url": "https://www.philosophizethis.org/podcast/episode-068-on-moodiness",
    "file": "068-episode-068-transcript.md",
    "label": "Episode 68"
  },
  {
    "id": 69,
    "url": "https://www.philosophizethis.org/podcast/episode-069-an-appeal-to-reason",
    "file": "069-episode-069-transcript.md",
    "label": "Episode 69"
  },
  {
    "id": 70,
    "url": "https://www.philosophizethis.org/podcast/episode-070-off-moodiness",
    "file": "070-episode-070-transcript.md",
    "label": "Off Moodiness"
  },
  {
    "id": 71,
    "url": "https://www.philosophizethis.org/podcast/episode-071-is-killing-animals-for-food-morally-justifiable",
    "file": "071-episode-071-transcript.md",
    "label": "Episode 71"
  },
  {
    "id": 72,
    "url": "https://www.philosophizethis.org/podcast/insecurity",
    "file": "072-episode-72-transcript.md",
    "label": "On Insecurity"
  },
  {
    "id": 73,
    "url": "https://www.philosophizethis.org/podcast/how-to-win-an-argument-pt-1",
    "file": "073-episode-73-transcript.md",
    "label": "Episode 73"
  },
  {
    "id": 74,
    "url": "https://www.philosophizethis.org/podcast/hegel-returns",
    "file": "074-episode-74-transcript.md",
    "label": "Hegel Returns!"
  },
  {
    "id": 75,
    "url": "https://www.philosophizethis.org/podcast/how-to-win-an-argument-pt-1-z37tg",
    "file": "075-episode-075-transcript.md",
    "label": "How To Win An Argument Pt. 2"
  },
  {
    "id": 76,
    "url": "https://www.philosophizethis.org/podcast/hegels-god",
    "file": "076-episode-76-transcript.md",
    "label": "Hegel's God"
  },
  {
    "id": 77,
    "url": "https://www.philosophizethis.org/podcast/religion-pt-1",
    "file": "077-episode-77-transcript.md",
    "label": "Marx and Kierkegaard on Religion Pt. 1"
  },
  {
    "id": 78,
    "url": "https://www.philosophizethis.org/podcast/religion-pt-1-dkzgn",
    "file": "078-episode-078-transcript.md",
    "label": "Marx and Kierkegaard on Religion Pt. 2"
  },
  {
    "id": 79,
    "url": "https://www.philosophizethis.org/podcast/episode-079-kierkegaard-on-anxiety",
    "file": "079-episode-79-transcript.md",
    "label": "Kierkegaard on Anxiety"
  },
  {
    "id": 80,
    "url": "https://www.philosophizethis.org/podcast/feuerbach",
    "file": "080-episode-080-transcript.md",
    "label": "Feuerbach on Religion"
  },
  {
    "id": 81,
    "url": "https://www.philosophizethis.org/podcast/capitalism-vs-communism",
    "file": "081-episode-81-transcript.md",
    "label": "Capitalism vs. Communism"
  },
  {
    "id": 82,
    "url": "https://www.philosophizethis.org/podcast/austrian-school",
    "file": "082-episode-82-transcript.md",
    "label": "Austrians and Marx"
  },
  {
    "id": 83,
    "url": "https://www.philosophizethis.org/podcast/henry-david-thoreau",
    "file": "083-episode-83-transcript.md",
    "label": "Episode 83"
  },
  {
    "id": 84,
    "url": "https://www.philosophizethis.org/podcast/william-james",
    "file": "084-episode-84-transcript.md",
    "label": "William James on Truth"
  },
  {
    "id": 85,
    "url": "https://www.philosophizethis.org/podcast/peter-singer",
    "file": "085-episode-85-transcript.md",
    "label": "Peter Singer on Effective Altruism"
  },
  {
    "id": 86,
    "url": "https://www.philosophizethis.org/podcast/sartre-on-freedom",
    "file": "086-episode-086-transcript.md",
    "label": "Sartre and Camus Pt. 1 - Freedom"
  },
  {
    "id": 87,
    "url": "https://www.philosophizethis.org/podcast/sartre-and-camus",
    "file": "087-episode-87-transcript.md",
    "label": "Sartre and Camus Pt. 2"
  },
  {
    "id": 88,
    "url": "https://www.philosophizethis.org/podcast/episode-088-sartre-and-camus-pt-3",
    "file": "088-episode-088-transcript.md",
    "label": "Episode 88"
  },
  {
    "id": 89,
    "url": "https://www.philosophizethis.org/podcast/episode-089-simone-de-beauvoir",
    "file": "089-episode-089-transcript.md",
    "label": "Simone De Beauvoir"
  },
  {
    "id": 90,
    "url": "https://www.philosophizethis.org/podcast/god-is-dead-and-so-is",
    "file": "090-episode-090-transcript.md",
    "label": "Nietzsche Pt. 1 - God is Dead And So Is Captain Morgan"
  },
  {
    "id": 91,
    "url": "https://www.philosophizethis.org/podcast/the-will-to-power",
    "file": "091-episode-091-transcript.md",
    "label": "Nietzsche Pt. 2 - The Will to Power"
  },
  {
    "id": 92,
    "url": "https://www.philosophizethis.org/podcast/thus-spoke-zarathustra",
    "file": "092-episode-092-transcript.md",
    "label": "Episode 92"
  },
  {
    "id": 93,
    "url": "https://www.philosophizethis.org/podcast/on-love",
    "file": "093-episode-93-transcript.md",
    "label": "Nietzsche Pt. 4 - Love"
  },
  {
    "id": 94,
    "url": "https://www.philosophizethis.org/podcast/a-look-at-suffering",
    "file": "094-episode-094-transcript.md",
    "label": "A Look at Suffering"
  },
  {
    "id": 95,
    "url": "https://www.philosophizethis.org/podcast/episode-095-",
    "file": "095-episode-095-transcript.md",
    "label": "Episode 95"
  },
  {
    "id": 96,
    "url": "https://www.philosophizethis.org/podcast/episode-096-is-ayn-rand-a-philosopher",
    "file": "096-episode-096-transcript.md",
    "label": "Episode 96"
  },
  {
    "id": 97,
    "url": "https://www.philosophizethis.org/podcast/wittgenstein-pt-1",
    "file": "097-episode-97-transcript.md",
    "label": "Episode 97"
  },
  {
    "id": 98,
    "url": "https://www.philosophizethis.org/podcast/schopenhauer-pt-1",
    "file": "098-episode-98-transcript.md",
    "label": "Episode 98"
  },
  {
    "id": 99,
    "url": "https://www.philosophizethis.org/podcast/episode-99-schopenhauer-pt-2-ethics",
    "file": "099-episode-99-transcript.md",
    "label": "Episode 99"
  },
  {
    "id": 100,
    "url": "https://www.philosophizethis.org/podcast/heidegger-dasein",
    "file": "100-episode-100-transcript.md",
    "label": "Episode 100"
  },
  {
    "id": 101,
    "url": "https://www.philosophizethis.org/podcast/heidegger-technology",
    "file": "101-episode-101-transcript.md",
    "label": "Episode 101"
  },
  {
    "id": 102,
    "url": "https://www.philosophizethis.org/podcast/heidegger-authenticity",
    "file": "102-episode-102-transcript.md",
    "label": "Episode 102"
  },
  {
    "id": 103,
    "url": "https://www.philosophizethis.org/podcast/quest-for-certainty",
    "file": "103-episode-103-transcript.md",
    "label": "Episode 103"
  },
  {
    "id": 104,
    "url": "https://www.philosophizethis.org/podcast/consciousness-is-freedom",
    "file": "104-episode-104-transcript.md",
    "label": "Episode 104"
  },
  {
    "id": 105,
    "url": "https://www.philosophizethis.org/podcast/sartre-camus-self",
    "file": "105-episode-105-transcript.md",
    "label": "Episode 105"
  },
  {
    "id": 106,
    "url": "https://www.philosophizethis.org/podcast/simone-de-beauvoir-ethics",
    "file": "106-episode-106-transcript.md",
    "label": "Episode 106"
  },
  {
    "id": 107,
    "url": "https://www.philosophizethis.org/podcast/the-ethics-of-ambiguity",
    "file": "107-episode-107-transcript.md",
    "label": "Episode 107"
  },
  {
    "id": 108,
    "url": "https://www.philosophizethis.org/podcast/frankfurt-school-intro",
    "file": "108-episode-108-transcript.md",
    "label": "Episode 108"
  },
  {
    "id": 109,
    "url": "https://www.philosophizethis.org/podcast/frankfurt-enlightenment",
    "file": "109-episode-109-transcript.md",
    "label": "Episode 109"
  },
  {
    "id": 110,
    "url": "https://www.philosophizethis.org/podcast/the-culture-industry",
    "file": "110-episode-110-transcript.md",
    "label": "Episode 110"
  },
  {
    "id": 111,
    "url": "https://www.philosophizethis.org/podcast/frankfurt-school-eros",
    "file": "111-episode-111-transcript.md",
    "label": "The Frankfurt School Pt. 4 - Eros"
  },
  {
    "id": 112,
    "url": "https://www.philosophizethis.org/podcast/eros-and-civilization-pt-2",
    "file": "112-episode-112-transcript.md",
    "label": "The Frankfurt School Pt. 5 - Civilization"
  },
  {
    "id": 113,
    "url": "https://www.philosophizethis.org/podcast/art-as-a-tool-for-liberation",
    "file": "113-episode-113-transcript.md",
    "label": "The Frankfurt School Pt. 6 - Art As A Tool For Liberation"
  },
  {
    "id": 114,
    "url": "https://www.philosophizethis.org/podcast/the-great-refusal",
    "file": "114-episode-114-transcript.md",
    "label": "The Frankfurt School Pt. 7 - The Great Refusal"
  },
  {
    "id": 115,
    "url": "https://www.philosophizethis.org/podcast/structuralism-and-context",
    "file": "115-episode-115-transcript.md",
    "label": "Structuralism and Context"
  },
  {
    "id": 116,
    "url": "https://www.philosophizethis.org/podcast/structuralism-and-mythology-pt-1",
    "file": "116-episode-116-transcript.md",
    "label": "Structuralism and Mythology Pt. 1"
  },
  {
    "id": 117,
    "url": "https://www.philosophizethis.org/podcast/structuralism-and-mythology-pt-2",
    "file": "117-episode-117-transcript.md",
    "label": "Structuralism and Mythology Pt. 2"
  },
  {
    "id": 118,
    "url": "https://www.philosophizethis.org/podcast/basic-post-modernism",
    "file": "118-episode-118-transcript.md",
    "label": "A Basic Look At Post-Modernism"
  },
  {
    "id": 119,
    "url": "https://www.philosophizethis.org/podcast/derrida-and-words",
    "file": "119-episode-119-transcript.md",
    "label": "Episode 119"
  },
  {
    "id": 120,
    "url": "https://www.philosophizethis.org/podcast/logical-positivists",
    "file": "120-episode-120-transcript.md",
    "label": "Episode 120"
  },
  {
    "id": 121,
    "url": "https://www.philosophizethis.org/podcast/michel-foucault-pt-1",
    "file": "121-episode-121-transcript.md",
    "label": "Michel Foucault Pt. 1"
  },
  {
    "id": 122,
    "url": "https://www.philosophizethis.org/podcast/the-order-of-things",
    "file": "122-episode-122-transcript.md",
    "label": "Michel Foucault Pt. 2 - The Order of Things"
  },
  {
    "id": 123,
    "url": "https://www.philosophizethis.org/podcast/foucault-power",
    "file": "123-episode-123-transcript.md",
    "label": "Michel Foucault Pt. 3 - Power"
  },
  {
    "id": 124,
    "url": "https://www.philosophizethis.org/podcast/simulacra-and-simulation",
    "file": "124-episode-124-transcript.md",
    "label": "Simulacra and Simulation"
  },
  {
    "id": 125,
    "url": "https://www.philosophizethis.org/podcast/deleuze-pt-1",
    "file": "125-episode-125-transcript.md",
    "label": "Gilles Deleuze Pt. 1 - What is Philosophy?"
  },
  {
    "id": 126,
    "url": "https://www.philosophizethis.org/podcast/gilles-deleuze-pt-2-immanence",
    "file": "126-episode-126-transcript.md",
    "label": "Gilles Deleuze Pt. 2 - Immanence"
  },
  {
    "id": 127,
    "url": "https://www.philosophizethis.org/podcast/anti_oedipus",
    "file": "127-episode-127-transcript.md",
    "label": "Gilles Deleuze Pt. 3 - Anti-Oedipus"
  },
  {
    "id": 128,
    "url": "https://www.philosophizethis.org/podcast/deleuze-flows",
    "file": "128-episode-128-transcript.md",
    "label": "Gilles Deleuze Pt. 4 - Flows"
  },
  {
    "id": 129,
    "url": "https://www.philosophizethis.org/podcast/deleuze-difference",
    "file": "129-episode-129-transcript.md",
    "label": "Gilles Deleuze Pt. 5 - Difference"
  },
  {
    "id": 130,
    "url": "https://www.philosophizethis.org/podcast/dewey-lippman",
    "file": "130-episode-130-transcript.md",
    "label": "Dewey and Lippmann on Democracy"
  },
  {
    "id": 131,
    "url": "https://www.philosophizethis.org/podcast/gramsci-hegemony",
    "file": "131-episode-131-transcript.md",
    "label": "Antonio Gramsci on Cultural Hegemony"
  },
  {
    "id": 132,
    "url": "https://www.philosophizethis.org/podcast/anti-liberalism-pt-1",
    "file": "132-episode-132-transcript.md",
    "label": "Carl Schmitt on Liberalism Pt. 1"
  },
  {
    "id": 133,
    "url": "https://www.philosophizethis.org/podcast/anti-liberalism-pt-2",
    "file": "133-episode-133-transcript.md",
    "label": "Carl Schmitt on Liberalism Pt. 2"
  },
  {
    "id": 134,
    "url": "https://www.philosophizethis.org/podcast/consequences-of-reason",
    "file": "134-episode-134-transcript.md",
    "label": "Consequences of Reason"
  },
  {
    "id": 135,
    "url": "https://www.philosophizethis.org/podcast/leo-strauss",
    "file": "135-episode-135-transcript.md",
    "label": "Ancients vs. Moderns (Leo Strauss)"
  },
  {
    "id": 136,
    "url": "https://www.philosophizethis.org/podcast/banality-of-evil",
    "file": "136-episode-136-transcript.md",
    "label": "The Banality of Evil (Hannah Arendt)"
  },
  {
    "id": 137,
    "url": "https://www.philosophizethis.org/podcast/theory-of-justice",
    "file": "137-episode-137-transcript.md",
    "label": "A Theory of Justice (John Rawls)"
  },
  {
    "id": 138,
    "url": "https://www.philosophizethis.org/podcast/the-minimal-state",
    "file": "138-episode-138-transcript.md",
    "label": "The Minimal State (Robert Nozick)"
  },
  {
    "id": 139,
    "url": "https://www.philosophizethis.org/podcast/episode-139-friedrich-von-hayek-the-road-to-serfdom",
    "file": "139-episode-139-transcript.md",
    "label": "The Road to Serfdom (Friedrich Von Hayek)"
  },
  {
    "id": 140,
    "url": "https://www.philosophizethis.org/podcast/episode-140-isaiah-berlin-pt-1-pluralism",
    "file": "140-episode-140-transcript.md",
    "label": "Isaiah Berlin pt. 1 - Pluralism"
  },
  {
    "id": 141,
    "url": "https://www.philosophizethis.org/podcast/pluralism-and-culture",
    "file": "141-episode-141-transcript.md",
    "label": "Isaiah Berlin pt. 2 - Pluralism and Culture"
  },
  {
    "id": 142,
    "url": "https://www.philosophizethis.org/podcast/richard-rorty",
    "file": "142-episode-142-transcript.md",
    "label": "Richard Rorty"
  },
  {
    "id": 143,
    "url": "https://www.philosophizethis.org/podcast/the-public-sphere",
    "file": "143-episode-143-transcript.md",
    "label": "The Public Sphere (Jürgen Habermas)"
  },
  {
    "id": 144,
    "url": "https://www.philosophizethis.org/podcast/episode-144-max-weber-iron-cage",
    "file": "144-episode-144-transcript.md",
    "label": "Episode 144"
  },
  {
    "id": 145,
    "url": "https://www.philosophizethis.org/podcast/episode-145-henri-bergson-pt-1-history",
    "file": "145-episode-145-transcript.md",
    "label": "Henri Bergson Pt. 1 - History"
  },
  {
    "id": 146,
    "url": "https://www.philosophizethis.org/podcast/episode-146-bergson-on-laughter-pt-2-vitalism",
    "file": "146-episode-146-transcript.md",
    "label": "Bergson on Laughter Pt. 2 - Vitalism"
  },
  {
    "id": 147,
    "url": "https://www.philosophizethis.org/podcast/episode-147-being-and-becoming",
    "file": "147-episode-147-transcript.md",
    "label": "Being and Becoming"
  },
  {
    "id": 148,
    "url": "https://www.philosophizethis.org/podcast/episode-148-on-media-pt-1-manufacturing-consent",
    "file": "148-episode-148-transcript.md",
    "label": "On Media Pt. 1 - Manufacturing Consent"
  },
  {
    "id": 149,
    "url": "https://www.philosophizethis.org/podcast/episode-149-on-media-pt-2-marshall-mcluhan",
    "file": "149-episode-149-transcript.md",
    "label": "On Media Pt. 2 (Marshall McLuhan)"
  },
  {
    "id": 150,
    "url": "https://www.philosophizethis.org/podcast/episode-150-the-frankfurt-school-erich-fromm-on-love",
    "file": "150-episode-150-transcript.md",
    "label": "Episode 150"
  },
  {
    "id": 151,
    "url": "https://www.philosophizethis.org/podcast/episode-150-the-frankfurt-school-erich-fromm-on-love-mx2z9",
    "file": "151-episode-151-transcript.md",
    "label": "The Frankfurt School - Erich Fromm on Freedom"
  },
  {
    "id": 152,
    "url": "https://www.philosophizethis.org/podcast/episode-152-the-frankfurt-school-walter-benjamin-pt-1",
    "file": "152-episode-152-transcript.md",
    "label": "The Frankfurt School - Walter Benjamin Pt. 1"
  },
  {
    "id": 153,
    "url": "https://www.philosophizethis.org/podcast/episode-152-the-frankfurt-school-walter-benjamin-pt-1-tkewa",
    "file": "153-episode-153-transcript.md",
    "label": "The Frankfurt School - Walter Benjamin Pt. 2 - Distraction"
  },
  {
    "id": 154,
    "url": "https://www.philosophizethis.org/podcast/episode-152-the-frankfurt-school-walter-benjamin-pt-1-agcpw",
    "file": "154-episode-154-transcript.md",
    "label": "Pragmatism and Truth"
  },
  {
    "id": 155,
    "url": "https://www.philosophizethis.org/podcast/episode-152-the-frankfurt-school-walter-benjamin-pt-1-tkewa-ctms6",
    "file": "155-episode-155-transcript.md",
    "label": "Emil Cioran Pt. 1 - Absurdity and Nothingness"
  },
  {
    "id": 156,
    "url": "https://www.philosophizethis.org/podcast/episode-152-the-frankfurt-school-walter-benjamin-pt-1-agcpw-fll9y",
    "file": "156-episode-156-transcript.md",
    "label": "Emil Cioran pt. 2 - Failure and Suicide"
  },
  {
    "id": 157,
    "url": "https://www.philosophizethis.org/podcast/episode-152-the-frankfurt-school-walter-benjamin-pt-1-tkewa-ctms6-sd4bd",
    "file": "157-episode-157-transcript.md",
    "label": "The Creation of Meaning - Simone De Beauvoir"
  },
  {
    "id": 158,
    "url": "https://www.philosophizethis.org/podcast/episode-158-the-creation-of-meaning-nietzsche-the-ascetic-ideal",
    "file": "158-episode-158-transcript.md",
    "label": "The Creation of Meaning - Nietzsche - The Ascetic Ideal"
  },
  {
    "id": 159,
    "url": "https://www.philosophizethis.org/podcast/episode-158-the-creation-of-meaning-nietzsche-the-ascetic-ideal-f8k5h",
    "file": "159-episode-159-transcript.md",
    "label": "The Creation of Meaning - Nietzsche - Amor Fati"
  },
  {
    "id": 160,
    "url": "https://www.philosophizethis.org/podcast/episode-158-the-creation-of-meaning-nietzsche-the-ascetic-ideal-f8k5h-k8xfx",
    "file": "160-episode-160-transcript.md",
    "label": "The Creation of Meaning - Kierkegaard - Silence, Obedience and Joy"
  },
  {
    "id": 161,
    "url": "https://www.philosophizethis.org/podcast/episode-158-the-creation-of-meaning-nietzsche-the-ascetic-ideal-f8k5h-k8xfx-6tyfj",
    "file": "161-episode-161-transcript.md",
    "label": "The Open Society and Its Enemies (Karl Popper)"
  },
  {
    "id": 162,
    "url": "https://www.philosophizethis.org/podcast/episode-158-the-creation-of-meaning-nietzsche-the-ascetic-ideal-f8k5h-k8xfx-6tyfj-xc8hy",
    "file": "162-episode-162-transcript.md",
    "label": "The Creation of Meaning - The Denial of Death"
  },
  {
    "id": 163,
    "url": "https://www.philosophizethis.org/podcast/episode-158-the-creation-of-meaning-nietzsche-the-ascetic-ideal-f8k5h-k8xfx-6tyfj-xc8hy-dl4jz-kcsd5",
    "file": "163-episode-163-transcript.md",
    "label": "The Creation of Meaning - Escape From Evil"
  },
  {
    "id": 164,
    "url": "https://www.philosophizethis.org/podcast/episode-164-self-reliance",
    "file": "164-episode-164-transcript.md",
    "label": "Self Reliance (Ralph Waldo Emerson)"
  },
  {
    "id": 165,
    "url": "https://www.philosophizethis.org/podcast/episode-165-emerson-on-nature",
    "file": "165-episode-165-transcript.md",
    "label": "Nature and Other Things (Ralph Waldo Emerson)"
  },
  {
    "id": 166,
    "url": "https://www.philosophizethis.org/podcast/episode-166-ortega-circumstance",
    "file": "166-episode-166-transcript.md",
    "label": "Circumstance (Jose Ortega)"
  },
  {
    "id": 167,
    "url": "https://www.philosophizethis.org/podcast/episode-167-revolt-of-the-masses",
    "file": "167-episode-167-transcript.md",
    "label": "Revolt of the Masses (Jose Ortega)"
  },
  {
    "id": 168,
    "url": "https://www.philosophizethis.org/podcast/episode-168-ethics-of-care",
    "file": "168-episode-168-transcript.md",
    "label": "Introduction to an Ethics of Care"
  },
  {
    "id": 169,
    "url": "https://www.philosophizethis.org/podcast/episode-169-latour-modern",
    "file": "169-episode-169-transcript.md",
    "label": "We Have Never Been Modern (Bruno Latour)"
  },
  {
    "id": 170,
    "url": "https://www.philosophizethis.org/podcast/episode-170-the-fall",
    "file": "170-episode-170-transcript.md",
    "label": "The Fall (Albert Camus)"
  },
  {
    "id": 171,
    "url": "https://www.philosophizethis.org/podcast/episode-171-guy-debord",
    "file": "171-episode-171-transcript.md",
    "label": "The Society of the Spectacle (Guy Debord)"
  },
  {
    "id": 172,
    "url": "https://www.philosophizethis.org/podcast/episode-172-attention-weil",
    "file": "172-episode-172-transcript.md",
    "label": "Attention (Simone Weil)"
  },
  {
    "id": 173,
    "url": "https://www.philosophizethis.org/podcast/episode-173-simone-weil-roots",
    "file": "173-episode-173-transcript.md",
    "label": "The Need For Roots (Simone Weil)"
  },
  {
    "id": 174,
    "url": "https://www.philosophizethis.org/podcast/episode-174-simone-weil-mathematician",
    "file": "174-episode-174-transcript.md",
    "label": "The Mathematician (Simone Weil)"
  },
  {
    "id": 175,
    "url": "https://www.philosophizethis.org/podcast/episode-175-simone-weil-vessels-of-god",
    "file": "175-episode-175-transcript.md",
    "label": "Vessels of God (Simone Weil)"
  },
  {
    "id": 176,
    "url": "https://www.philosophizethis.org/podcast/episode-176-susan-sontag",
    "file": "176-episode-176-transcript.md",
    "label": "Do you criticize yourself the way you criticize a movie? (Susan Sontag)"
  },
  {
    "id": 177,
    "url": "https://www.philosophizethis.org/podcast/episode-177-susan-sontag",
    "file": "177-episode-177-transcript.md",
    "label": "Do you speak the language of pictures and videos? (Susan Sontag)"
  },
  {
    "id": 178,
    "url": "https://www.philosophizethis.org/podcast/episode-178-susan-sontag",
    "file": "178-episode-178-transcript.md",
    "label": "How much is your view of everything affected by metaphors? (Susan Sontag)"
  },
  {
    "id": 179,
    "url": "https://www.philosophizethis.org/podcast/episode-179-consciousness-hard-problem",
    "file": "179-episode-179-transcript.md",
    "label": "Why is consciousness something worth talking about?"
  },
  {
    "id": 180,
    "url": "https://www.philosophizethis.org/podcast/episode-179-consciousness-hard-problem-l8d98",
    "file": "180-episode-180-transcript.md",
    "label": "What if everything is consciousness?"
  },
  {
    "id": 181,
    "url": "https://www.philosophizethis.org/podcast/episode-179-consciousness-hard-problem-l8d98-td63g",
    "file": "181-episode-181-transcript.md",
    "label": "Episode 181"
  },
  {
    "id": 182,
    "url": "https://www.philosophizethis.org/podcast/episode-179-consciousness-hard-problem-l8d98-td63g-47g5g",
    "file": "182-episode-182-transcript.md",
    "label": "What if free will is an illusion?"
  },
  {
    "id": 183,
    "url": "https://www.philosophizethis.org/podcast/episode-179-consciousness-hard-problem-l8d98-td63g-47g5g-nfwhy",
    "file": "183-episode-183-transcript.md",
    "label": "Is ChatGPT really intelligent?"
  },
  {
    "id": 184,
    "url": "https://www.philosophizethis.org/podcast/episode-179-consciousness-hard-problem-l8d98-td63g-47g5g-ha6yr",
    "file": "184-episode-184-transcript.md",
    "label": "Is Artificial Intelligence really an existential threat?"
  },
  {
    "id": 185,
    "url": "https://www.philosophizethis.org/podcast/episode-179-consciousness-hard-problem-l8d98-td63g-47g5g-ha6yr-papmr-kaj7p",
    "file": "185-episode-185-transcript.md",
    "label": "Should we prepare for an AI revolution?"
  },
  {
    "id": 186,
    "url": "https://www.philosophizethis.org/podcast/episode-179-consciousness-hard-problem-l8d98-td63g-47g5g-ha6yr-papmr",
    "file": "186-episode-186-transcript.md",
    "label": "Are we heading for a digital prison?"
  },
  {
    "id": 187,
    "url": "https://www.philosophizethis.org/podcast/episode-179-consciousness-hard-problem-l8d98-td63g-47g5g-ha6yr-papmr-kaj7p-4ybpm",
    "file": "187-episode-187-transcript.md",
    "label": "How much freedom would you trade for security? (Foucault, Hobbes, Mill, Agamben)"
  },
  {
    "id": 188,
    "url": "https://www.philosophizethis.org/podcast/episode-179-consciousness-hard-problem-l8d98-td63g-47g5g-ha6yr-papmr-kaj7p-4ybpm-pdh4b",
    "file": "188-episode-188-transcript.md",
    "label": "Achievement Society and the rise of narcissism, depression and anxiety"
  },
  {
    "id": 189,
    "url": "https://www.philosophizethis.org/podcast/episode-179-consciousness-hard-problem-l8d98-td63g-47g5g-ha6yr-papmr-kaj7p-4ybpm-pdh4b-sp7wa",
    "file": "189-episode-189-transcript.md",
    "label": "Everything that connects us is slowly disappearing"
  },
  {
    "id": 190,
    "url": "https://www.philosophizethis.org/podcast/episode-179-consciousness-hard-problem-l8d98-td63g-47g5g-ha6yr-papmr-kaj7p-4ybpm-m83zf",
    "file": "190-episode-190-transcript.md",
    "label": "Are emotions a waste of time? - Neo-Stoicism (Martha Nussbaum)"
  },
  {
    "id": 191,
    "url": "https://www.philosophizethis.org/podcast/episode-179-consciousness-hard-problem-l8d98-td63g-47g5g-ha6yr-papmr-kaj7p-4ybpm-m83zf-6gzkc",
    "file": "191-episode-191-transcript.md",
    "label": "Episode 191"
  },
  {
    "id": 192,
    "url": "https://www.philosophizethis.org/podcast/anarchism-part-one",
    "file": "192-episode-192-transcript.md",
    "label": "Should we overthrow the government tomorrow? - Anarchism Pt. 1 (Chomsky, Malatesta)"
  },
  {
    "id": 193,
    "url": "https://www.philosophizethis.org/podcast/anarchism-part-one-26l4k",
    "file": "193-episode-193-transcript.md",
    "label": "Episode 193"
  },
  {
    "id": 194,
    "url": "https://www.philosophizethis.org/podcast/anarchism-part-one-26l4k-pj5c2",
    "file": "194-episode-194-transcript.md",
    "label": "Do we really need the police? - Anarchism Pt. 3 (Gelderloos, Security)"
  },
  {
    "id": 195,
    "url": "https://www.philosophizethis.org/podcast/anarchism-part-one-26l4k-pj5c2-yehbw",
    "file": "195-episode-195-transcript.md",
    "label": "Could Anarcho-Capitalism be the solution to our problems? - Anarchism Pt. 4 (Rothbard, Friedman, Malice)"
  },
  {
    "id": 196,
    "url": "https://www.philosophizethis.org/podcast/anarchism-part-one-26l4k-pj5c2-yehbw-jebes",
    "file": "196-episode-196-transcript.md",
    "label": "Episode 196"
  },
  {
    "id": 197,
    "url": "https://www.philosophizethis.org/podcast/anarchism-part-one-26l4k-pj5c2-yehbw-jebes-cwz68",
    "file": "197-episode-197-transcript.md",
    "label": "Episode 197"
  },
  {
    "id": 198,
    "url": "https://www.philosophizethis.org/podcast/anarchism-part-one-26l4k-pj5c2-yehbw-jebes-cwz68-y6cd4",
    "file": "198-episode-198-transcript.md",
    "label": "The truth is in the process. Zizek Pt. 3 (Ideology, Dialectics)"
  },
  {
    "id": 199,
    "url": "https://www.philosophizethis.org/podcast/episode-199-transcript",
    "file": "199-episode-199-transcript.md",
    "label": "A conservative communist’s take on global capitalism and desire. (Zizek, Marx, Hegel)"
  },
  {
    "id": 200,
    "url": "https://www.philosophizethis.org/podcast/episode-200-transcript",
    "file": "200-episode-200-transcript.md",
    "label": "The Postmodern subject and “ideology without ideology” (Zizek, Byung Chul Han)"
  },
  {
    "id": 201,
    "url": "https://www.philosophizethis.org/podcast/episode-201-transcript",
    "file": "201-episode-201-transcript.md",
    "label": "Resistance, Love and the importance of Failure. (Zizek, Han)"
  },
  {
    "id": 202,
    "url": "https://www.philosophizethis.org/podcast/episode-201-transcript-bkx3e",
    "file": "202-episode-202-transcript.md",
    "label": "Why we can’t think beyond Capitalism. (Mark Fisher, Capitalist Realism)"
  },
  {
    "id": 203,
    "url": "https://www.philosophizethis.org/podcast/episode-201-transcript-bkx3e-37rkx",
    "file": "203-episode-203-transcript.md",
    "label": "Why the future is being slowly cancelled. - Postmodernism (Mark Fisher, Capitalist Realism)"
  },
  {
    "id": 204,
    "url": "https://www.philosophizethis.org/podcast/episode-201-transcript-bkx3e-37rkx-bpl83",
    "file": "204-episode-204-transcript.md",
    "label": "The importance of philosophy, justice and the common good. (Michael Sandel)"
  },
  {
    "id": 205,
    "url": "https://www.philosophizethis.org/podcast/episode-201-transcript-bkx3e-37rkx-bpl83-ysc9b",
    "file": "205-episode-205-transcript.md",
    "label": "Why a meritocracy is corrosive to society. (Michael Sandel)"
  },
  {
    "id": 206,
    "url": "https://www.philosophizethis.org/podcast/episode-201-transcript-bkx3e-37rkx-bpl83-ysc9b-kkg62",
    "file": "206-episode-206-transcript.md",
    "label": "Capitalism is dead. This is Technofeudalism. (Yanis Varoufakis)"
  },
  {
    "id": 207,
    "url": "https://www.philosophizethis.org/podcast/episode-201-transcript-bkx3e-37rkx-bpl83-ysc9b-kkg62-rk7n2-57j8w",
    "file": "207-episode-207-transcript.md",
    "label": "Fear is toxic to a democracy. (Martha Nussbaum)"
  },
  {
    "id": 208,
    "url": "https://www.philosophizethis.org/podcast/episode-201-transcript-bkx3e-37rkx-bpl83-ysc9b-kkg62-rk7n2",
    "file": "208-episode-208-transcript.md",
    "label": "The moral evolution of a philosopher. (Peter Singer)"
  },
  {
    "id": 209,
    "url": "https://www.philosophizethis.org/podcast/episode-201-transcript-bkx3e-37rkx-bpl83-ysc9b-kkg62-rk7n2-8j6gw",
    "file": "209-episode-209-transcript.md",
    "label": "Improving our world through applied ethics. (Peter Singer, Katarzyna de Lazari-Radek)"
  },
  {
    "id": 210,
    "url": "https://www.philosophizethis.org/podcast/episode-201-transcript-bkx3e-37rkx-bpl83-ysc9b-kkg62-rk7n2-8j6gw-p837t",
    "file": "210-episode-210-transcript.md",
    "label": "The Pedagogy of the Oppressed (Paulo Freire, Education)"
  },
  {
    "id": 211,
    "url": "https://www.philosophizethis.org/podcast/episode-201-transcript-bkx3e-37rkx-bpl83-ysc9b-kkg62-rk7n2-8j6gw-p837t-fwc2c",
    "file": "211-episode-211-transcript.md",
    "label": "Nietzsche returns with a hammer!"
  },
  {
    "id": 212,
    "url": "https://www.philosophizethis.org/podcast/episode-201-transcript-bkx3e-37rkx-bpl83-ysc9b-kkg62-rk7n2-8j6gw-p837t-fwc2c-armek",
    "file": "212-episode-212-transcript.md",
    "label": "Nietzsche and Critchley on the tragic perspective."
  },
  {
    "id": 213,
    "url": "https://www.philosophizethis.org/podcast/episode-201-transcript-bkx3e-37rkx-bpl83-ysc9b-kkg62-rk7n2-8j6gw-p837t-fwc2c-armek-de5ar",
    "file": "213-episode-213-transcript.md",
    "label": "Episode 213"
  },
  {
    "id": 214,
    "url": "https://www.philosophizethis.org/podcast/episode-201-transcript-bkx3e-37rkx-bpl83-ysc9b-kkg62-rk7n2-8j6gw-p837t-fwc2c-armek-de5ar-2at4j",
    "file": "214-episode-214-transcript.md",
    "label": "Framing our Being in a completely different way. (Heidegger)"
  },
  {
    "id": 215,
    "url": "https://www.philosophizethis.org/podcast/episode-201-transcript-bkx3e-37rkx-bpl83-ysc9b-kkg62-rk7n2-8j6gw-p837t-fwc2c-armek-de5ar-2at4j-l2jz9",
    "file": "215-episode-215-transcript.md",
    "label": "How Mysticism is missing from our modern lives. (Critchley, Heidegger)"
  },
  {
    "id": 216,
    "url": "https://www.philosophizethis.org/podcast/episode-201-transcript-bkx3e-37rkx-bpl83-ysc9b-kkg62-rk7n2-8j6gw-p837t-fwc2c-armek-de5ar-2at4j-l2jz9-7zdw5",
    "file": "216-episode-216-transcript.md",
    "label": "The Self-Overcoming of Nihilism - Kyoto School pt. 1 (Nishitani)"
  },
  {
    "id": 217,
    "url": "https://www.philosophizethis.org/podcast/episode-201-transcript-bkx3e-37rkx-bpl83-ysc9b-kkg62-rk7n2-8j6gw-p837t-fwc2c-armek-de5ar-2at4j-l2jz9-7zdw5-7exg8",
    "file": "217-episode-217-transcript.md",
    "label": "Religion and Nothingness - Kyoto School pt. 2 (Nishitani)"
  },
  {
    "id": 218,
    "url": "https://www.philosophizethis.org/podcast/episode-201-transcript-bkx3e-37rkx-bpl83-ysc9b-kkg62-rk7n2-8j6gw-p837t-fwc2c-armek-de5ar-2at4j-l2jz9-7zdw5-7exg8-8b7k4",
    "file": "218-episode-218-transcript.md",
    "label": "Notes From Underground (Dostoevsky)"
  },
  {
    "id": 219,
    "url": "https://www.philosophizethis.org/podcast/episode-201-transcript-bkx3e-37rkx-bpl83-ysc9b-kkg62-rk7n2-8j6gw-p837t-fwc2c-armek-de5ar-2at4j-l2jz9-7zdw5-7exg8-8b7k4-rk3et",
    "file": "219-episode-219-transcript.md",
    "label": "Crime and Punishment (Dostoevsky)"
  },
  {
    "id": 220,
    "url": "https://www.philosophizethis.org/podcast/episode-201-transcript-bkx3e-37rkx-bpl83-ysc9b-kkg62-rk7n2-8j6gw-p837t-fwc2c-armek-de5ar-2at4j-l2jz9-7zdw5-7exg8-8b7k4-rk3et-ez2lj",
    "file": "220-episode-220-transcript.md",
    "label": "Demons (Dostoevsky)"
  },
  {
    "id": 221,
    "url": "https://www.philosophizethis.org/podcast/episode-201-transcript-bkx3e-37rkx-bpl83-ysc9b-kkg62-rk7n2-8j6gw-p837t-fwc2c-armek-de5ar-2at4j-l2jz9-7zdw5-7exg8-8b7k4-rk3et-ez2lj-jy3k5",
    "file": "221-episode-221-transcript.md",
    "label": "The Idiot (Dostoevsky)"
  },
  {
    "id": 222,
    "url": "https://www.philosophizethis.org/podcast/episode-201-transcript-bkx3e-37rkx-bpl83-ysc9b-kkg62-rk7n2-8j6gw-p837t-fwc2c-armek-de5ar-2at4j-l2jz9-7zdw5-7exg8-8b7k4-rk3et-ez2lj-jy3k5-ahe2m",
    "file": "222-episode-222-transcript.md",
    "label": "Love in The Brothers Karamazov (Dostoevsky)"
  },
  {
    "id": 223,
    "url": "https://www.philosophizethis.org/podcast/episode-201-transcript-bkx3e-37rkx-bpl83-ysc9b-kkg62-rk7n2-8j6gw-p837t-fwc2c-armek-de5ar-2at4j-l2jz9-7zdw5-7exg8-8b7k4-rk3et-ez2lj-jy3k5-ahe2m-2gzy7",
    "file": "223-episode-223-transcript.md",
    "label": "Episode 223"
  },
  {
    "id": 224,
    "url": "https://www.philosophizethis.org/podcast/episode-201-transcript-bkx3e-37rkx-bpl83-ysc9b-kkg62-rk7n2-8j6gw-p837t-fwc2c-armek-de5ar-2at4j-l2jz9-7zdw5-7exg8-8b7k4-rk3et-ez2lj-jy3k5-ahe2m-2gzy7-z6ch3",
    "file": "224-episode-224-transcript.md",
    "label": "The Stranger (Albert Camus)"
  },
  {
    "id": 225,
    "url": "https://www.philosophizethis.org/podcast/episode-201-transcript-bkx3e-37rkx-bpl83-ysc9b-kkg62-rk7n2-8j6gw-p837t-fwc2c-armek-de5ar-2at4j-l2jz9-7zdw5-7exg8-8b7k4-rk3et-ez2lj-jy3k5-ahe2m-2gzy7-z6ch3-psrz6",
    "file": "225-episode-225-transcript.md",
    "label": "Episode 225"
  },
  {
    "id": 226,
    "url": "https://www.philosophizethis.org/podcast/episode-201-transcript-bkx3e-37rkx-bpl83-ysc9b-kkg62-rk7n2-8j6gw-p837t-fwc2c-armek-de5ar-2at4j-l2jz9-7zdw5-7exg8-8b7k4-rk3et-ez2lj-jy3k5-ahe2m-2gzy7-z6ch3-psrz6-tcgbg",
    "file": "226-episode-226-transcript.md",
    "label": "The Rebel (Albert Camus)"
  },
  {
    "id": 227,
    "url": "https://www.philosophizethis.org/podcast/episode-201-transcript-bkx3e-37rkx-bpl83-ysc9b-kkg62-rk7n2-8j6gw-p837t-fwc2c-armek-de5ar-2at4j-l2jz9-7zdw5-7exg8-8b7k4-rk3et-ez2lj-jy3k5-ahe2m-2gzy7-z6ch3-psrz6-tcgbg-jbhht",
    "file": "227-episode-227-transcript.md",
    "label": "On Exile (Albert Camus)"
  },
  {
    "id": 228,
    "url": "https://www.philosophizethis.org/podcast/episode-201-transcript-bkx3e-37rkx-bpl83-ysc9b-kkg62-rk7n2-8j6gw-p837t-fwc2c-armek-de5ar-2at4j-l2jz9-7zdw5-7exg8-8b7k4-rk3et-ez2lj-jy3k5-ahe2m-2gzy7-z6ch3-psrz6-tcgbg-jbhht-7ptz2",
    "file": "228-episode-228-transcript.md",
    "label": "Kafka and The Fall (Albert Camus)"
  },
  {
    "id": 229,
    "url": "https://www.philosophizethis.org/podcast/episode-201-transcript-bkx3e-37rkx-bpl83-ysc9b-kkg62-rk7n2-8j6gw-p837t-fwc2c-armek-de5ar-2at4j-l2jz9-7zdw5-7exg8-8b7k4-rk3et-ez2lj-jy3k5-ahe2m-2gzy7-z6ch3-psrz6-tcgbg-jbhht-7ptz2-5cth6",
    "file": "229-episode-229-transcript.md",
    "label": "Episode 229"
  },
  {
    "id": 230,
    "url": "https://www.philosophizethis.org/podcast/episode-201-transcript-bkx3e-37rkx-bpl83-ysc9b-kkg62-rk7n2-8j6gw-p837t-fwc2c-armek-de5ar-2at4j-l2jz9-7zdw5-7exg8-8b7k4-rk3et-ez2lj-jy3k5-ahe2m-2gzy7-z6ch3-psrz6-tcgbg-jbhht-7ptz2-5cth6-78j5w",
    "file": "230-episode-230-transcript.md",
    "label": "Hope as an Existentialism (Ernst Bloch)"
  },
  {
    "id": 231,
    "url": "https://www.philosophizethis.org/podcast/episode-201-transcript-bkx3e-37rkx-bpl83-ysc9b-kkg62-rk7n2-8j6gw-p837t-fwc2c-armek-de5ar-2at4j-l2jz9-7zdw5-7exg8-8b7k4-rk3et-ez2lj-jy3k5-ahe2m-2gzy7-z6ch3-psrz6-tcgbg-jbhht-7ptz2-5cth6-78j5w-fc6jf",
    "file": "231-episode-231-transcript.md",
    "label": "The Late Work of Wittgenstein - Language Games"
  },
  {
    "id": 232,
    "url": "https://www.philosophizethis.org/podcast/h48mld6lelcfrts",
    "file": "232-episode-232-transcript.md",
    "label": "The Crisis of Narration (Byung Chul Han)"
  },
  {
    "id": 233,
    "url": "https://www.philosophizethis.org/podcast/h48mld6lelcfrts-c55k9",
    "file": "233-episode-233-transcript.md",
    "label": "A philosophy of self-destruction. (Dostoevsky, Bataille)"
  },
  {
    "id": 234,
    "url": "https://www.philosophizethis.org/podcast/h48mld6lelcfrts-c55k9-m583b",
    "file": "234-episode-234-transcript.md",
    "label": "Episode 234"
  },
  {
    "id": 235,
    "url": "https://www.philosophizethis.org/podcast/h48mld6lelcfrts-c55k9-m583b-aleb9",
    "file": "235-episode-235-transcript.md",
    "label": "The Philosophy of Zen Buddhism (Byung Chul Han)"
  },
  {
    "id": 236,
    "url": "https://www.philosophizethis.org/podcast/h48mld6lelcfrts-c55k9-m583b-aleb9-526rs",
    "file": "236-episode-236-transcript.md",
    "label": "Meditations (Marcus Aurelius)"
  },
  {
    "id": 237,
    "url": "https://www.philosophizethis.org/podcast/h48mld6lelcfrts-c55k9-m583b-aleb9-526rs-fy73x",
    "file": "237-episode-237-transcript.md",
    "label": "The Stoics are wrong. (Nietzsche, Schopenhauer)"
  },
  {
    "id": 238,
    "url": "https://www.philosophizethis.org/podcast/h48mld6lelcfrts-c55k9-m583b-aleb9-526rs-fy73x-nfdzf",
    "file": "238-episode-238-transcript.md",
    "label": "Frankenstein (Mary Shelley)"
  },
  {
    "id": 239,
    "url": "https://www.philosophizethis.org/podcast/h48mld6lelcfrts-c55k9-m583b-aleb9-526rs-fy73x-nfdzf-ckdej",
    "file": "239-episode-239-transcript.md",
    "label": "Episode 239"
  },
  {
    "id": 240,
    "url": "https://www.philosophizethis.org/podcast/h48mld6lelcfrts-c55k9-m583b-aleb9-526rs-fy73x-nfdzf-ckdej-2na8n",
    "file": "240-episode-240-transcript.md",
    "label": "Varieties of Religion Today (Charles Taylor)"
  },
  {
    "id": 241,
    "url": "https://www.philosophizethis.org/podcast/h48mld6lelcfrts-c55k9-m583b-aleb9-526rs-fy73x-nfdzf-ckdej-2na8n-c69nm",
    "file": "241-episode-241-transcript.md",
    "label": "The Tragedy of Julius Caesar (William Shakespeare)"
  },
  {
    "id": 242,
    "url": "https://www.philosophizethis.org/podcast/h48mld6lelcfrts-c55k9-m583b-aleb9-526rs-fy73x-nfdzf-ckdej-2na8n-c69nm-raz94",
    "file": "242-episode-242-transcript.md",
    "label": "Episode 242"
  },
  {
    "id": 243,
    "url": "https://www.philosophizethis.org/podcast/h48mld6lelcfrts-c55k9-m583b-aleb9-526rs-fy73x-nfdzf-ckdej-2na8n-c69nm-raz94-y4r52",
    "file": "243-episode-243-transcript.md",
    "label": "Hamlet (William Shakespeare)"
  },
  {
    "id": 244,
    "url": "https://www.philosophizethis.org/podcast/h48mld6lelcfrts-c55k9-m583b-aleb9-526rs-fy73x-nfdzf-ckdej-2na8n-c69nm-raz94-y4r52-m337w",
    "file": "244-episode-244-transcript.md",
    "label": "After Virtue (Alasdair Macintyre)"
  },
  {
    "id": 245,
    "url": "https://www.philosophizethis.org/podcast/h48mld6lelcfrts-c55k9-m583b-aleb9-526rs-fy73x-nfdzf-ckdej-2na8n-c69nm-raz94-y4r52-m337w-25dxe",
    "file": "245-episode-245-transcript.md",
    "label": "The Rival Moral Approaches of the Modern World (Alasdair Macintyre)"
  }
];

if (typeof module !== "undefined" && module.exports) { module.exports = EPISODE_INDEX; }
