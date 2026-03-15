
const fs = require('fs');
const path = require('path');

// Manually verify env 
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath) && !process.env.JSON2VIDEO_API_KEY) {
    const envConfig = fs.readFileSync(envLocalPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value && !process.env[key.trim()]) {
            process.env[key.trim()] = value.trim();
        }
    });
}

function replaceVariables(text, context) {
    if (!text) return "";
    if (typeof text !== 'string') return text;
    return text.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (match, path) => {
        return context[path] || match;
    });
}

async function test() {
    console.log("Testing JSON2Video Advanced Config...");
    const apiKey = process.env.JSON2VIDEO_API_KEY;
    if (!apiKey) {
        console.error("Error: JSON2VIDEO_API_KEY not found.");
        process.exit(1);
    }

    // Mock Data Inputs
    const data = {
        jsonConfig: JSON.stringify({
            resolution: "square",
            quality: "low",
            scenes: [
                {
                    elements: [
                        {
                            type: "text",
                            text: "Scene 1",
                            duration: 3
                        }
                    ]
                },
                {
                    elements: [
                        {
                            type: "text",
                            text: "Scene 2",
                            duration: 2
                        }
                    ]
                }
            ]
        })
    };

    const context = {};

    try {
        const SDK = require('json2video-sdk');
        const Movie = SDK.Movie;

        const movie = new Movie();
        movie.setAPIKey(apiKey);

        // Simulation of the logic added to pipeline-execution.ts
        const jsonConfig = data.jsonConfig ? replaceVariables(data.jsonConfig, context) : null;
        let advancedConfigApplied = false;

        if (jsonConfig) {
            console.log("Parsing Advanced Config...");
            const parsedConfig = typeof jsonConfig === 'string' ? JSON.parse(jsonConfig) : jsonConfig;

            // Apply parsed config to movie object
            if (parsedConfig.scenes) {
                console.log(`Adding ${parsedConfig.scenes.length} scenes...`);
                parsedConfig.scenes.forEach((scene) => {
                    movie.addScene(scene);
                });
            }
            if (parsedConfig.elements) {
                parsedConfig.elements.forEach((element) => {
                    movie.addElement(element);
                });
            }
            // Apply other properties
            Object.keys(parsedConfig).forEach(key => {
                if (key !== 'scenes' && key !== 'elements') {
                    console.log(`Setting ${key} = ${parsedConfig[key]}`);
                    movie.set(key, parsedConfig[key]);
                }
            });
            advancedConfigApplied = true;
        }

        if (!advancedConfigApplied) {
            console.log("No advanced config, using simple mode (not expected for this test)");
        }

        console.log("Starting render...");
        const response = await movie.render();

        if (!response.success) {
            console.error("Render failed:", response);
            return;
        }

        console.log("Render started. Project ID:", response.project);
        console.log("Waiting for completion...");

        // Just wait briefly to confirm it started, no need to burn credits/time waiting for full render of 5s video
        // But for verification, let's wait.
        const result = await movie.waitToFinish();

        console.log("Render finished!");

        if (result.movie && result.movie.url) {
            console.log("SUCCESS: Video URL ->", result.movie.url);
        } else {
            console.error("FAILED: No video URL.");
        }

    } catch (error) {
        console.error("Test failed:", error);
    }
}

test();
