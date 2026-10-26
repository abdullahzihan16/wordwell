const searchInput = document.querySelector("#search-input");
const wordList = document.querySelector("#word-list");
const wordCount = document.querySelector("#word-count");
const entryPanel = document.querySelector("#entry-panel");
const saveStatus = document.querySelector("#save-status");

const entries = window.dictionaryEntries;
const progressKey = "wordwell-progress-v1";
let filteredEntries = [];
let selectedWord = "";
let lastWord = "";
let readWords = new Set();

function loadProgress() {
  try {
    const saved = localStorage.getItem(progressKey);
    if (!saved) {
      return;
    }

    const progress = JSON.parse(saved);
    if (progress && typeof progress.lastWord === "string" && Array.isArray(progress.readWords)) {
      lastWord = progress.lastWord;
      readWords = new Set(progress.readWords.filter((word) => typeof word === "string"));
    }
  } catch (error) {
    saveStatus.textContent = "Progress storage is unavailable in this browser";
    console.error("Could not load saved dictionary progress:", error);
  }
}

function saveProgress() {
  try {
    localStorage.setItem(progressKey, JSON.stringify({
      lastWord,
      readWords: [...readWords],
    }));
    saveStatus.textContent = "Reading progress saves on this device";
  } catch (error) {
    saveStatus.textContent = "Could not save reading progress";
    console.error("Could not save dictionary progress:", error);
  }
}

function splitList(value) {
  return value
    .split(/\r?\n|;/)
    .map((item) => item.replace(/^\s*\d+\.\s*/, "").trim())
    .filter(Boolean);
}

function makeElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

function renderWordList() {
  wordList.replaceChildren();
  wordCount.textContent = `${filteredEntries.length} ${filteredEntries.length === 1 ? "word" : "words"}`;

  if (filteredEntries.length === 0) {
    wordList.append(makeElement("p", "list-empty", "No matching words. Try another search."));
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const entry of filteredEntries) {
    const button = makeElement("button", "word-option");
    button.type = "button";
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(entry.word === selectedWord));
    button.setAttribute("aria-label", `${entry.word}, ${entry.partOfSpeech}${readWords.has(entry.word) ? ", read" : ""}`);
    button.addEventListener("click", () => selectEntry(entry.word));

    const copy = makeElement("span", "word-option-copy");
    copy.append(
      makeElement("span", "word-name", entry.word),
      makeElement("span", "word-meaning", entry.meaning),
    );
    button.append(
      copy,
      readWords.has(entry.word)
        ? makeElement("span", "word-read", "✓")
        : makeElement("span", "word-arrow", "›"),
    );
    fragment.append(button);
  }
  wordList.append(fragment);
}

function appendSection(container, label, icon, content) {
  const section = makeElement("section", "detail-section");
  const heading = makeElement("h3", "section-label");
  heading.append(makeElement("span", "section-icon", icon), document.createTextNode(label));
  section.append(heading, content);
  container.append(section);
}

function renderEntry(entry) {
  entryPanel.replaceChildren();
  entryPanel.setAttribute("aria-busy", "false");

  const index = entries.findIndex((item) => item.word === entry.word) + 1;
  const topline = makeElement("div", "entry-topline");
  topline.append(
    makeElement("span", "eyebrow", "WORD"),
    makeElement("span", "entry-index", `${String(index).padStart(3, "0")} / ${entries.length}`),
  );

  const title = makeElement("h2", "entry-word", entry.word);
  const partOfSpeech = makeElement("span", "part-of-speech", entry.partOfSpeech);
  const definition = makeElement("p", "definition", entry.meaning);
  entryPanel.append(topline, title, partOfSpeech, definition);

  const divider = makeElement("hr", "detail-divider");
  entryPanel.append(divider);

  if (entry.sentence) {
    appendSection(entryPanel, "IN A SENTENCE", "“", makeElement("blockquote", "example-quote", entry.sentence));
  }

  const examples = splitList(entry.examples);
  if (examples.length > 0) {
    const list = makeElement("ol", "example-list");
    for (const example of examples) {
      list.append(makeElement("li", "", example));
    }
    appendSection(entryPanel, "MORE EXAMPLES", "✎", list);
  }

  const synonyms = splitList(entry.synonyms);
  if (synonyms.length > 0) {
    const tags = makeElement("div", "tags");
    for (const synonym of synonyms) {
      tags.append(makeElement("span", "tag", synonym));
    }
    appendSection(entryPanel, "SYNONYMS", "↔", tags);
  }

  if (entry.bengaliMeaning) {
    appendSection(
      entryPanel,
      "বাংলা অর্থ",
      "অ",
      makeElement("p", "bengali-meaning", entry.bengaliMeaning),
    );
  }

  if (entry.context) {
    appendSection(entryPanel, "CONTEXT", "◎", makeElement("p", "context-copy", entry.context));
  }

  const connected = splitList(entry.connected);
  if (connected.length > 0) {
    const list = makeElement("ul", "connected-list");
    for (const connectedWord of connected) {
      const match = connectedWord.match(/^(.+?)\s+\(\d+\)\s*(.*)$/);
      const word = match ? match[1].trim() : connectedWord;
      const detail = match?.[2].trim() ?? "";
      const target = entries.find((item) => item.word.toLocaleLowerCase() === word.toLocaleLowerCase());
      const item = makeElement("li");

      if (target) {
        const link = makeElement("button", "connected-link", target.word);
        link.type = "button";
        link.addEventListener("click", () => {
          searchInput.value = "";
          filteredEntries = entries;
          selectEntry(target.word);
          wordList.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
        });
        item.append(link);
      } else {
        item.append(document.createTextNode(word));
      }

      if (detail) {
        item.append(document.createTextNode(` ${detail}`));
      }
      list.append(item);
    }
    appendSection(entryPanel, "CONNECTED WORDS", "⌁", list);
  }
}

function selectEntry(word) {
  const entry = entries.find((item) => item.word === word);
  if (entry) {
    selectedWord = word;
    lastWord = word;
    readWords.add(word);
    saveProgress();
    renderWordList();
    renderEntry(entry);
  }
}

function filterEntries(query) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  filteredEntries = entries.filter((entry) =>
    Object.values(entry).some((value) => value.toLocaleLowerCase().includes(normalizedQuery)),
  );

  if (!filteredEntries.some((entry) => entry.word === selectedWord) && filteredEntries.length > 0) {
    selectEntry(filteredEntries[0].word);
  } else if (filteredEntries.length === 0) {
    selectedWord = "";
    entryPanel.replaceChildren();
    entryPanel.setAttribute("aria-busy", "false");
    const state = makeElement("div", "empty-state");
    state.append(makeElement("strong", "", "No words found"), makeElement("p", "", "Try searching for a different word or meaning."));
    entryPanel.append(state);
  }

  renderWordList();
  if (filteredEntries.some((entry) => entry.word === selectedWord)) {
    const selected = entries.find((entry) => entry.word === selectedWord);
    if (selected && entryPanel.childElementCount === 0) {
      renderEntry(selected);
    }
  }
}

function loadDictionary() {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("dictionary-data.js does not contain any dictionary entries.");
  }

  loadProgress();
  const knownWords = new Set(entries.map((entry) => entry.word));
  readWords = new Set([...readWords].filter((word) => knownWords.has(word)));
  const initialEntry = entries.find((entry) => entry.word === lastWord) ?? entries[0];
  filteredEntries = entries;
  selectEntry(initialEntry.word);
}

searchInput.addEventListener("input", () => filterEntries(searchInput.value));
searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    searchInput.value = "";
    filterEntries("");
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && document.activeElement !== searchInput) {
    event.preventDefault();
    searchInput.focus();
  }
});

loadDictionary();
