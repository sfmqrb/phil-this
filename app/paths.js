// Curriculum arcs ("learning paths") for the Philosophize This! back catalogue.
// Every episode id (1..245) appears in exactly one path. Paths are listed in the
// order a newcomer should tackle them; episodes inside a path are in listening order.
const LEARNING_PATHS = [
  {
    key: "ancient-greece",
    title: "Ancient Greece and the Hellenistic World",
    blurb:
      "Where it all starts: the Presocratics asking what the world is made of, Socrates, Plato and Aristotle, the great Eastern traditions, and the schools that taught people how to live once the polis fell apart.",
    episodes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]
  },
  {
    key: "medieval-renaissance",
    title: "Medieval, Islamic, and Renaissance Philosophy",
    blurb:
      "A thousand years of trying to reconcile faith with reason, from Avicenna and Aquinas to the Renaissance humanists who turned philosophy back toward this world and toward politics.",
    episodes: [18, 19, 20, 21, 22, 23, 24, 26, 27]
  },
  {
    key: "rationalists-empiricists",
    title: "Rationalists and Empiricists",
    blurb:
      "The scientific revolution forces philosophy to restart: Descartes, Pascal, Spinoza and Leibniz try to reason their way to certainty while Locke and Berkeley insist all knowledge begins with the senses.",
    episodes: [28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40]
  },
  {
    key: "enlightenment",
    title: "The Enlightenment",
    blurb:
      "Reason turned loose on church, king and market: Voltaire on tolerance, Rousseau on the general will, Adam Smith on why nations grow rich, Wollstonecraft on educating women, and the birth of left and right.",
    episodes: [41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 65]
  },
  {
    key: "hume-and-kant",
    title: "Hume and Kant",
    blurb:
      "The hinge of modern philosophy. Hume dismantles causation, the self and miracles; Kant rebuilds knowledge and ethics from the ground up with the categorical imperative and the limits of experience.",
    episodes: [51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 69]
  },
  {
    key: "hegel-and-the-rebels",
    title: "Hegel and the 19th-Century Rebels",
    blurb:
      "Hegel makes history itself philosophical, and a generation revolts against him: Feuerbach and Marx on religion and capital, Kierkegaard on anxiety and faith, Schopenhauer and Nietzsche on will, suffering and the death of God.",
    episodes: [
      64, 66, 67, 74, 76, 77, 78, 79, 80, 81, 82, 90, 91, 92, 93, 94, 98, 99
    ]
  },
  {
    key: "existentialism",
    title: "Existentialism",
    blurb:
      "Existence precedes essence. Heidegger on being-toward-death, Sartre on radical freedom and bad faith, Camus on the absurd, and de Beauvoir on ambiguity and the making of women as the second sex.",
    episodes: [
      86, 87, 88, 89, 100, 101, 102, 103, 104, 105, 106, 107, 108
    ]
  },
  {
    key: "critical-theory",
    title: "Critical Theory and the Culture Industry",
    blurb:
      "The Frankfurt School and its allies ask why liberation never arrived: Adorno and Horkheimer on mass culture, Marcuse on repression and refusal, Fromm on love and freedom, Benjamin on art, Chomsky and McLuhan on media, Debord on the spectacle.",
    episodes: [
      109, 110, 111, 112, 113, 114, 148, 149, 150, 151, 152, 153, 171, 210
    ]
  },
  {
    key: "structuralism-postmodernism",
    title: "Structuralism and Postmodernism",
    blurb:
      "Meaning as a system rather than a mirror: Saussure, Barthes and Levi-Strauss on myth and structure, then Derrida, Foucault, Baudrillard and Deleuze on power, simulation, difference and the end of grand narratives.",
    episodes: [
      115, 116, 117, 118, 119, 121, 122, 123, 124, 125, 126, 127, 128, 129,
      169
    ]
  },
  {
    key: "political-philosophy",
    title: "Twentieth-Century Political Philosophy",
    blurb:
      "After the catastrophes: Gramsci on hegemony, Schmitt on sovereignty, Arendt on the banality of evil, Rawls, Nozick, Hayek and Berlin arguing over justice and freedom, and Popper defending the open society.",
    episodes: [
      130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 143, 161
    ]
  },
  {
    key: "pragmatism-mind-machines",
    title: "Pragmatism, Mind, and Machines",
    blurb:
      "The Anglo-American thread: truth as something we make (James, Peirce, Rorty), Wittgenstein and the logical positivists on the limits of language, then consciousness, free will, and what artificial intelligence does to both.",
    episodes: [
      84, 95, 97, 120, 142, 154, 179, 180, 181, 182, 183, 184, 185, 186,
      231
    ]
  },
  {
    key: "meaning-and-the-self",
    title: "Time, Meaning, and the Self",
    blurb:
      "Thinkers who ask what a life is for: Bergson on duration and laughter, Cioran on futility, Becker on the denial of death, Emerson and Ortega on self-reliance and circumstance, Weil on attention, Sontag on how we read the world.",
    episodes: [
      83, 144, 145, 146, 147, 155, 156, 157, 158, 159, 160, 162, 163, 164, 165,
      166, 167, 170, 172, 173, 174, 175, 176, 177, 178
    ]
  },
  {
    key: "power-and-ideology",
    title: "Power, Ideology, and Capitalism Today",
    blurb:
      "Philosophy pointed at the present: Byung-Chul Han on burnout, Agamben on bare life, the anarchist and libertarian critiques of the state, Zizek on ideology, and Mark Fisher on why we cannot imagine an alternative.",
    episodes: [
      96, 187, 188, 189, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201,
      202, 203, 206, 232
    ]
  },
  {
    key: "nihilism-and-mysticism",
    title: "Nihilism, Mysticism, and the Kyoto School",
    blurb:
      "Nietzsche returns with a hammer, Heidegger and Critchley look for the mystical in modern life, and the Kyoto School's Nishitani answers nihilism from the far side of Zen and emptiness.",
    episodes: [211, 212, 213, 214, 215, 216, 217, 223, 230, 235]
  },
  {
    key: "philosophy-and-literature",
    title: "Philosophy and Literature",
    blurb:
      "Novels and plays as philosophical arguments: Dostoevsky's underground and his saints, Camus's strangers and plagues, Kafka's bureaucracies, Shelley's monster, Kundera's lightness, and Shakespeare on love, honor and doubt.",
    episodes: [
      218, 219, 220, 221, 222, 224, 225, 226, 227, 228, 229, 233, 234, 238, 241,
      242, 243
    ]
  },
  {
    key: "practical-ethics",
    title: "Practical Ethics and the Art of Living",
    blurb:
      "The how-to-live episodes gathered in one place: arguing well, managing your moods, what we owe animals and strangers, Sandel on the common good, Singer on giving, modern Stoicism, and MacIntyre's case for virtue.",
    episodes: [
      25, 68, 70, 71, 72, 73, 75, 85, 168, 190, 204, 205, 207, 208, 209,
      236, 237, 239, 240, 244, 245
    ]
  }
];

if (typeof module !== "undefined" && module.exports) { module.exports = LEARNING_PATHS; }
