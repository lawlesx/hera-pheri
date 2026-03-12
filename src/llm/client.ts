const BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const MODEL    = process.env.OLLAMA_MODEL    ?? "granite4:3b";

interface OllamaResponse {
  response: string;
}

/**
 * Send a prompt to the local Ollama instance and return the response text.
 * Returns an empty string (never throws) if Ollama is unreachable.
 */
export async function callOllama(prompt: string): Promise<string> {
  console.log(`\n💬  Prompting Ollama (${MODEL})...`);
  try {
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, prompt, stream: false }),
    });

    if (!res.ok) {
      console.warn(`\n⚠️  Ollama HTTP ${res.status}: ${res.statusText}`);
      return "";
    }

    const data = (await res.json()) as OllamaResponse;
    return data.response.trim();
  } catch (err) {
    console.warn(`\n⚠️  Ollama unavailable: ${err instanceof Error ? err.message : String(err)}`);
    return "";
  }
}
