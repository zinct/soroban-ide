const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;

const FREE_MODELS = [
  "inclusionai/ling-2.6-1t:free", // Have Soroban knowledge
  "google/gemini-2.0-flash-exp:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen-2.5-72b-instruct:free",
  "google/gemma-2-9b-it:free",
  "mistralai/mistral-7b-instruct:free",
  "microsoft/phi-3-mini-128k-instruct:free",
  "tencent/hy3-preview:free",
  "baidu/qianfan-ocr-fast:free",
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
  "google/lyria-3-pro-preview",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "minimax/minimax-m2.5:free",
  "openrouter/auto", // System choice as last resort
];

const SYSTEM_PROMPT = {
  role: "system",
  content: "You are a specialized AI for Soroban and Stellar Ecosystem",
};

/**
 * Sends a message to OpenRouter using free models with a fallback mechanism.
 * @param {Array} messages - Array of message objects { role, content }
 * @param {number} modelIndex - Index of the model to try (for recursion)
 * @returns {Promise<string>} - The AI response
 */
export const chatWithAI = async (messages, modelIndex = 0) => {
  if (!OPENROUTER_API_KEY) {
    throw new Error("VITE_OPENROUTER_API_KEY is not configured in .env");
  }

  if (modelIndex >= FREE_MODELS.length) {
    throw new Error("All free models failed or reached limit.");
  }

  const currentModel = FREE_MODELS[modelIndex];
  console.info(`[AI Service] Using model: ${currentModel} (Attempt ${modelIndex + 1}/${FREE_MODELS.length})`);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": window.location.href, // Required by OpenRouter
        "X-Title": "Soroban Studio", // Optional but good practice
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: currentModel,
        messages: [SYSTEM_PROMPT, ...messages],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.warn(`Model ${currentModel} failed:`, errorData);

      // If rate limited (429) or other errors, try next model
      return chatWithAI(messages, modelIndex + 1);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.warn(`Error with model ${currentModel}:`, error);
    // Network errors or other issues, try next model
    return chatWithAI(messages, modelIndex + 1);
  }
};

/**
 * Streams a message from OpenRouter.
 * @param {Array} messages - Array of message objects { role, content }
 * @param {Function} onUpdate - Callback called with the current full text
 * @param {number} modelIndex - Index of the model to try
 */
export const streamChatWithAI = async (messages, onUpdate, modelIndex = 0) => {
  if (!OPENROUTER_API_KEY) {
    throw new Error("VITE_OPENROUTER_API_KEY is not configured in .env");
  }

  if (modelIndex >= FREE_MODELS.length) {
    throw new Error("All free models failed or reached limit.");
  }

  const currentModel = FREE_MODELS[modelIndex];
  console.info(`[AI Service] Streaming with model: ${currentModel} (Attempt ${modelIndex + 1}/${FREE_MODELS.length})`);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": window.location.href,
        "X-Title": "Soroban Studio",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: currentModel,
        messages: [SYSTEM_PROMPT, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      console.warn(`Model ${currentModel} stream failed, trying fallback...`);
      return streamChatWithAI(messages, onUpdate, modelIndex + 1);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedResponse = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const dataStr = line.slice(6).trim();
          if (dataStr === "[DONE]") break;

          try {
            const data = JSON.parse(dataStr);
            const content = data.choices[0]?.delta?.content || "";
            accumulatedResponse += content;
            onUpdate(accumulatedResponse);
          } catch (e) {
            // Ignore incomplete JSON chunks
          }
        }
      }
    }
  } catch (error) {
    console.warn(`Error streaming with model ${currentModel}:`, error);
    return streamChatWithAI(messages, onUpdate, modelIndex + 1);
  }
};
