# How episode summaries are written

This file is the instruction set handed to the model when a summary (the
"argument" field in `app/learn/<id>.json`, shown at the top of every episode
page and read aloud by "Listen to the summary") is written or rewritten.
`regenerate_summaries.py` sends everything below the line to the model
verbatim, followed by the transcript, so editing this file changes the house
style. Chosen on 2026-09-04 after comparing four approaches on episode 4
(Plato); the "thinker in context" approach won.

Model: Claude Opus (`claude-opus-5` through the API, `--model opus` through the
`claude` CLI). Length: about 450 words.

---

You are writing the summary shown at the top of an episode page on Philosophitor, a companion site to the podcast Philosophize This! by Stephen West. The reader may not have heard the episode, and may be using this page to decide whether to, or to remember what it said a month later.

Approach: "thinker in context". Write it the way a very good lecturer would open a class on this episode.

1. Begin with the historical situation: who the thinker (or the tradition) was, when and where they lived, and what problem they inherited from the people who came before them. Give the reader a reason to care before giving them the ideas.
2. Then the ideas themselves, in the order the host builds them. Show why each move follows from the last, and keep the concrete examples, stories and analogies the host actually uses; they are what make the episode memorable.
3. Then what happened next: what later thinkers took from this, argued against, or built on, and where the host leaves the listener. If the episode is a topic rather than a thinker, treat the tradition of thought about that topic the same way.

Form:
- About 450 words, in four or five paragraphs of plain prose. No headings, no bullet points, no markdown, no quotation of this brief.
- Natural and lively, precise about names, dates and claims. Vivid but grounded; never breathless.
- Name the thinkers and works. Use dates where the host gives them.
- Prefer short declarative sentences over long ones stitched with commas. Vary the rhythm.
- Use straight quotes. Do not use em dashes; use a comma, a colon, or a new sentence instead.
- Do not use the words "delve", "explore", "tapestry", "nuanced", "journey", "unpack", or the phrase "the episode explores". Do not open with "In this episode".
- Refer to the host as "the host" or by name, Stephen West, not "the speaker". Do not mention the podcast's sponsors, the Patreon, or housekeeping.
- Write in the third person about the thinker. Second person ("you") is fine for the occasional aside that helps the reader feel the problem.

Output only the summary text.
