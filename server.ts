/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
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

  // In-memory control state backup for low-latency ESP32 polling
  let espControlState = {
    led: 50,
    fan: 1,
    humidifier: 0,
    auto: true,
    voice: false,
    songUrl: "http://codesandbox.sandcat.nl/test.mp3",
    songName: "Default Sync Track",
    isPlaying: false,
    volume: 50
  };

  // Get ESP32 control state (lightweight JSON for ESP32 HTTP polling)
  app.get("/api/control", async (req, res) => {
    try {
      // Try to fetch latest live document from Firestore REST API as a fallback
      const firestoreUrl = "https://firestore.googleapis.com/v1/projects/kitten-smarthome/databases/ai-studio-kittensmarthomea-7eaaabc9-3649-44ab-ac87-6d970ec15491/documents/control/esp32";
      const response = await fetch(firestoreUrl);
      if (response.ok) {
        const data = await response.json();
        if (data && data.fields) {
          const fields = data.fields;
          espControlState = {
            led: fields.led ? Number(fields.led.integerValue || fields.led.doubleValue || 50) : espControlState.led,
            fan: fields.fan ? Number(fields.fan.integerValue || fields.fan.doubleValue || 1) : espControlState.fan,
            humidifier: fields.humidifier ? Number(fields.humidifier.integerValue || fields.humidifier.doubleValue || 0) : espControlState.humidifier,
            auto: fields.auto ? Boolean(fields.auto.booleanValue) : espControlState.auto,
            voice: fields.voice ? Boolean(fields.voice.booleanValue) : espControlState.voice,
            songUrl: fields.songUrl ? String(fields.songUrl.stringValue) : espControlState.songUrl,
            songName: fields.songName ? String(fields.songName.stringValue) : espControlState.songName,
            isPlaying: fields.isPlaying ? Boolean(fields.isPlaying.booleanValue) : espControlState.isPlaying,
            volume: fields.volume ? Number(fields.volume.integerValue || fields.volume.doubleValue || 50) : espControlState.volume,
          };
        }
      }
    } catch (err) {
      console.warn("[Control API] Firestore REST fallback fetch error (using cache):", err);
    }

    // Resolve local upload relative path dynamically to absolute public URL
    let resolvedSongUrl = espControlState.songUrl;
    if (resolvedSongUrl && resolvedSongUrl.startsWith("/uploads/")) {
      const host = req.headers.host || "localhost:3000";
      // Support secure https if behind reverse proxy/Cloud Run
      const protocol = req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
      resolvedSongUrl = `${protocol}://${host}${espControlState.songUrl}`;
    }

    res.json({
      ...espControlState,
      songUrl: resolvedSongUrl
    });
  });

  // Update ESP32 control state (called by the frontend to keep cache fresh)
  app.post("/api/control", (req, res) => {
    try {
      const { led, fan, humidifier, auto, voice, songUrl, songName, isPlaying, volume } = req.body;
      if (led !== undefined) espControlState.led = Number(led);
      if (fan !== undefined) espControlState.fan = Number(fan);
      if (humidifier !== undefined) espControlState.humidifier = Number(humidifier);
      if (auto !== undefined) espControlState.auto = Boolean(auto);
      if (voice !== undefined) espControlState.voice = Boolean(voice);
      if (songUrl !== undefined) espControlState.songUrl = String(songUrl);
      if (songName !== undefined) espControlState.songName = String(songName);
      if (isPlaying !== undefined) espControlState.isPlaying = Boolean(isPlaying);
      if (volume !== undefined) espControlState.volume = Number(volume);

      res.json({ success: true, state: espControlState });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to update control state", details: err.message });
    }
  });

  // Create local uploads directory if it doesn't exist
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Serve uploaded files statically
  app.use("/uploads", express.static(uploadsDir));

  // Local file upload endpoint with cloud proxy to bypass Firebase Storage and 302 proxy issues
  app.post("/api/upload-audio", async (req, res) => {
    try {
      const { fileName, fileType, fileData } = req.body;
      if (!fileName || !fileData) {
        return res.status(400).json({ error: "fileName and fileData are required in body." });
      }

      // Convert base64 data to binary buffer
      const buffer = Buffer.from(fileData, "base64");

      // Validate file size (12MB maximum limit)
      if (buffer.length > 12 * 1024 * 1024) {
        return res.status(400).json({ error: "File exceeds the 12MB limit." });
      }

      // Generate a clean safe filename to avoid injection or path traversal
      const safeName = fileName.replace(/[^a-zA-Z0-9_.-]/g, "_");

      let publicUrl = "";
      let uploadSuccess = false;

      // 1. Try Catbox.moe (Provides permanent public URLs accessible by ESP32)
      try {
        console.log(`[Upload API] Attempting cloud upload to Catbox: ${safeName}`);
        const catboxForm = new FormData();
        catboxForm.append("reqtype", "fileupload");
        const fileBlob = new Blob([buffer], { type: fileType || "audio/mpeg" });
        catboxForm.append("fileToUpload", fileBlob, safeName);

        const catboxResponse = await fetch("https://catbox.moe/user/api.php", {
          method: "POST",
          body: catboxForm,
        });

        if (catboxResponse.ok) {
          const text = await catboxResponse.text();
          if (text && text.startsWith("https://files.catbox.moe/")) {
            publicUrl = text.trim();
            uploadSuccess = true;
            console.log(`[Upload API] Successfully uploaded to Catbox: ${publicUrl}`);
          } else {
            console.warn(`[Upload API] Catbox response was unexpected: ${text}`);
          }
        } else {
          console.warn(`[Upload API] Catbox returned status ${catboxResponse.status}`);
        }
      } catch (catboxErr) {
        console.error(`[Upload API] Catbox upload failed:`, catboxErr);
      }

      // 2. Try Tmpfiles.org as a temporary fallback if Catbox is down
      if (!uploadSuccess) {
        try {
          console.log(`[Upload API] Attempting cloud upload to Tmpfiles: ${safeName}`);
          const tmpForm = new FormData();
          const fileBlob = new Blob([buffer], { type: fileType || "audio/mpeg" });
          tmpForm.append("file", fileBlob, safeName);

          const tmpResponse = await fetch("https://tmpfiles.org/api/v1/upload", {
            method: "POST",
            body: tmpForm,
          });

          if (tmpResponse.ok) {
            const json = await tmpResponse.json();
            if (json && json.status === "success" && json.data && json.data.url) {
              const rawUrl = json.data.url;
              // Convert download url (e.g., https://tmpfiles.org/123/name.mp3 -> https://tmpfiles.org/dl/123/name.mp3)
              publicUrl = rawUrl.replace("https://tmpfiles.org/", "https://tmpfiles.org/dl/");
              uploadSuccess = true;
              console.log(`[Upload API] Successfully uploaded to Tmpfiles: ${publicUrl}`);
            } else {
              console.warn(`[Upload API] Tmpfiles response was unexpected:`, json);
            }
          } else {
            console.warn(`[Upload API] Tmpfiles returned status ${tmpResponse.status}`);
          }
        } catch (tmpErr) {
          console.error(`[Upload API] Tmpfiles upload failed:`, tmpErr);
        }
      }

      // 3. Fallback to saving locally (though ESP32 cannot easily fetch it due to 302 proxy auth)
      if (!uploadSuccess) {
        const filePath = path.join(uploadsDir, safeName);
        fs.writeFileSync(filePath, buffer);
        publicUrl = `/uploads/${safeName}`;
        console.log(`[Upload API] Both cloud uploads failed. Falling back to local file: ${publicUrl}`);
      }

      res.json({
        url: publicUrl,
        fileName: safeName,
        success: true
      });
    } catch (err: any) {
      console.error("[Upload API Error]:", err);
      res.status(500).json({
        error: "Failed to process and store file on server.",
        details: err.message || err
      });
    }
  });

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
- If the phrase "heading out" is detected or they are leaving the house, set "led" to 0, "fan" to 0, "humidifier" to 0, and "auto" to true.
- If they specify a number for the light, fan, or humidifier (e.g. "fan 50", "light 50", or "humidifier 30"), always assume they want a percentage (0-100%). Map this percentage value to its 0-255 analog scale equivalent (e.g., 50% becomes 128, 100% becomes 255, 10% becomes 26). Do NOT set the fan/led/humidifier directly to the number 50 unless they say "analog 50".
- If they ask to turn lights on, off, or dim/brighten them manually (without mentioning a profile), set "led" to a value between 0 (completely off) and 255 (maximum glow) using the percentage rule.
- If they ask to speed up, slow down, or stop the cooling/ventilation fan manually, set "fan" to a value between 0 (off) and 255 (maximum speed) using the percentage rule.
- If they ask to activate, turn on, speed up, slow down, or shut down the ultrasonic humidifier manually, set "humidifier" to a value between 0 (completely off) and 255 (maximum mist intensity) using the percentage rule.
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
                    humidifier: {
                      type: Type.INTEGER,
                      description: "Humidifier mist intensity level (0-255)."
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
