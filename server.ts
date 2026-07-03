/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

// Lazy-loaded Gemini AI client to avoid crashes if the key is missing at start
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not configured.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for body parsing
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API Endpoint for Voice Command processing
  app.post("/api/voice-command", async (req, res) => {
    try {
      const { audio, mimeType } = req.body;

      if (!audio) {
        return res.status(400).json({ error: "No audio data provided in request body." });
      }

      // Check if API key is set
      if (!process.env.GEMINI_API_KEY) {
        console.warn("[Gemini API] API key is missing. Falling back to local keyword simulation.");
        // Simulated response if API key is missing
        return res.json({
          transcript: "Simulated voice command (API Key Missing)",
          reply: "I received your audio, but the Gemini API Key is not configured in Settings. Please add GEMINI_API_KEY in Settings > Secrets to enable live Gemini speech parsing!",
          fallback: true
        });
      }

      const ai = getGeminiClient();

      const audioPart = {
        inlineData: {
          mimeType: mimeType || "audio/webm",
          data: audio,
        },
      };

      const prompt = `You are the vocal interface of KITTEN, a highly advanced, futuristic smart home assistant.
Analyze the user's spoken voice command from this audio stream and determine the correct actions.
You must return a structured JSON response corresponding exactly to the schema.

Guidelines:
- Transcribe the user's spoken words accurately into "transcript".
- Formulate a witty, polite, futuristic response in "reply" (refer to yourself as KITTEN, and match the high-tech, glassmorphic mood).
- If they explicitly ask to activate, switch to, or load an automation mode/profile, set "mode" to one of: 'manual', 'auto', 'study', 'sleep', 'movie', 'gaming'.
- If they ask to turn lights on, off, or dim/brighten them manually (without mentioning a profile), set "led" to a value between 0 (completely off) and 255 (maximum glow).
- If they ask to speed up, slow down, or stop the cooling/ventilation fan manually, set "fan" to a value between 0 (off) and 255 (maximum speed).
- If they ask to switch to auto, automatic, or manual mode generally, set "auto" to true or false.
- If they ask to play music, play a song, stop music, or turn on the speakers:
  - Return "playMusic" with "songName" (e.g., "Synthwave Sunset", "Cozy Lofi", "Cyberpunk Overdrive") and "play" as true.
  - If they ask to stop music, return "playMusic" with "stop" as true.

Make sure your reply reflects the actions you are taking.`;

      // Multi-model fallback chain to handle high demand or temporary 503/UNAVAILABLE errors
      const candidateModels = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
      let response = null;
      let lastError: any = null;

      for (const modelName of candidateModels) {
        let success = false;
        const attempts = 2; // Up to 2 attempts per model with a short backoff

        for (let attempt = 1; attempt <= attempts; attempt++) {
          try {
            console.log(`[Gemini API] Attempt ${attempt}/${attempts} parsing voice command with model: ${modelName}`);
            response = await ai.models.generateContent({
              model: modelName,
              contents: [audioPart, prompt],
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    transcript: {
                      type: Type.STRING,
                      description: "Accurate text transcription of what was spoken in the audio."
                    },
                    reply: {
                      type: Type.STRING,
                      description: "The AI assistant's verbal response to the command."
                    },
                    mode: {
                      type: Type.STRING,
                      description: "The automation profile mode name: 'manual', 'auto', 'study', 'sleep', 'movie', or 'gaming'."
                    },
                    led: {
                      type: Type.INTEGER,
                      description: "LED brightness level (0-255)."
                    },
                    fan: {
                      type: Type.INTEGER,
                      description: "Fan level (0-255)."
                    },
                    auto: {
                      type: Type.BOOLEAN,
                      description: "Set automatic mode state."
                    },
                    playMusic: {
                      type: Type.OBJECT,
                      description: "Controls to start or stop music on the smart home speaker system.",
                      properties: {
                        songName: {
                          type: Type.STRING,
                          description: "Proposed song or genre name."
                        },
                        play: {
                          type: Type.BOOLEAN,
                          description: "Set to true to play/resume music."
                        },
                        stop: {
                          type: Type.BOOLEAN,
                          description: "Set to true to stop music playback."
                        }
                      },
                      required: []
                    }
                  },
                  required: ["transcript", "reply"]
                }
              }
            });

            if (response) {
              console.log(`[Gemini API] Successfully parsed voice command using ${modelName} on attempt ${attempt}`);
              success = true;
              break;
            }
          } catch (err: any) {
            lastError = err;
            console.warn(`[Gemini API] Model ${modelName} attempt ${attempt} failed:`, err.message || err);
            
            // Wait 250ms before retrying the same model or falling back
            await new Promise((resolve) => setTimeout(resolve, 250));
          }
        }

        if (success && response) {
          break;
        }
      }

      if (!response) {
        throw lastError || new Error("All candidate Gemini models failed to respond.");
      }

      const responseText = response.text || "{}";
      const parsedData = JSON.parse(responseText.trim());

      res.json(parsedData);
    } catch (error: any) {
      console.error("[Voice Command Error]:", error);
      res.status(500).json({
        error: "Failed to process voice command.",
        details: error.message || error
      });
    }
  });

  // Serve static files / Vite HMR
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
