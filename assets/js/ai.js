// assets/js/ai.js
export const AI_CONFIG = {
  API_BASE_URL: "/api" // ✅ Use relative path for reliability
};

export async function generateStory({ title, scenes, characters, genre, tone }) {
  const prompt = `
Title: ${title}
Genre: ${genre}
Tone: ${tone}

Characters: ${characters.map(c => `${c.name}: ${c.description || ''}`).join(", ")}
Scenes: ${scenes.map((s, i) => `(${i + 1}) ${s.text}`).join("\n")}
`;

  try {
    const resp = await fetch(`${AI_CONFIG.API_BASE_URL}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
      credentials: "include"
    });

    if (!resp.ok) throw new Error(`Backend error ${resp.status}`);
    return await resp.json(); // ✅ { story: "...", references: [] }
  } catch (err) {
    console.error("❌ generateStory error:", err);
    return { story: "⚠️ Failed to reach AI backend.", references: [] };
  }
}
