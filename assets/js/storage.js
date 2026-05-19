// assets/js/storage.js
export const KEYS = {
  SCENES: "storyScenes",
  CHARACTERS: "storyCharacters",
  TITLE: "storyTitle",
  AI_STORY: "aiStory",
  DRAFT: "draftStory",
  STORIES: "myStories" // array of {id,title,createdAt,aiStory,scenes,characters}
};

export function save(key, value) {
  localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
}

export function load(key, fallback=null) {
  const raw = localStorage.getItem(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function pushStory(story) {
  const list = load(KEYS.STORIES, []);
  list.push(story);
  save(KEYS.STORIES, list);
}

export function byId(id) {
  const list = load(KEYS.STORIES, []);
  return list.find(s => s.id === id);
}

export function removeStory(id) {
  const list = load(KEYS.STORIES, []);
  const next = list.filter(s => s.id !== id);
  save(KEYS.STORIES, next);
}
