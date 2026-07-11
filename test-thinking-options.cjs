const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
let apiKey = '';
try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/GEMINI_API_KEY\s*=\s*(.+)/);
    if (match) apiKey = match[1].trim();
} catch (e) {}

const ai = new GoogleGenAI({ apiKey });

async function testConfig(name, thinkingConfig) {
    console.log(`\n--- Testing ${name} ---`);
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: 'List 3 colors.',
            config: {
                thinkingConfig
            }
        });
        console.log('Success! Thoughts length:', (response.candidates?.[0]?.content?.parts || []).filter(p => p.thought).length);
        console.log('Response text:', response.text.trim());
    } catch (err) {
        console.error('Error:', err.status, err.message);
    }
}

async function run() {
    // Test 1: thinkingLevel LOW
    await testConfig('thinkingLevel LOW', { thinkingLevel: 'LOW' });
    
    // Test 2: thinkingLevel MINIMAL
    await testConfig('thinkingLevel MINIMAL', { thinkingLevel: 'MINIMAL' });
    
    // Test 3: thinkingBudget 0 (to disable)
    await testConfig('thinkingBudget 0', { thinkingBudget: 0 });
    
    // Test 4: thinkingBudget -1
    await testConfig('thinkingBudget -1', { thinkingBudget: -1 });
}

run();
