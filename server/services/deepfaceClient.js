// HTTP + Python CLI client for DeepFace — never returns dead "No Input" if OpenCV can detect face.
const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const DEEPFACE_URL = process.env.DEEPFACE_API_URL || 'http://localhost:5001';
const CLI_SCRIPT = path.resolve(__dirname, '../../ai/deepface/analyze_cli.py');

// Prefer the project's virtualenv python if available, otherwise fall back to `python` on PATH.
const VENV_PY = path.resolve(__dirname, '../../ai/deepface/.venv/Scripts/python.exe');
const PYTHON_CMD = (process.env.DEEPFACE_PYTHON || (fs.existsSync(VENV_PY) ? VENV_PY : 'python'));

function normalizeResult(data, engineOverride) {
  return {
    dominant_emotion: data.dominant_emotion || 'No Face Detected',
    action_units: data.action_units || 'None',
    confidence: data.confidence || 0,
    engine: engineOverride || data.engine || 'DeepFace',
    emotions: data.emotions || {},
    error: data.error,
  };
}

function analyzeViaHttp(imageBase64) {
  return axios.post(
    `${DEEPFACE_URL}/analyze`,
    { image_base64: imageBase64, imageBase64 },
    { timeout: 15000 }
  ).then((res) => normalizeResult(res.data));
}

function analyzeViaPythonCli(imageBase64) {
  return new Promise((resolve, reject) => {
    const py = spawn(PYTHON_CMD, [CLI_SCRIPT], {
      cwd: path.dirname(CLI_SCRIPT),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    py.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    py.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    py.on('error', reject);

    py.on('close', (code) => {
      const lines = stdout.trim().split('\n').filter(Boolean);
      let data = null;
      for (let i = lines.length - 1; i >= 0; i -= 1) {
        try {
          data = JSON.parse(lines[i]);
          break;
        } catch {
          /* try previous line */
        }
      }

      if (data && data.dominant_emotion) {
        resolve(normalizeResult(data, data.engine === 'DeepFace' ? 'DeepFace-CLI' : data.engine));
        return;
      }

      reject(new Error(stderr.trim() || `Python CLI failed (code ${code})`));
    });

    py.stdin.write(JSON.stringify({ image_base64: imageBase64 }));
    py.stdin.end();
  });
}

async function analyzeFace(imageBase64) {
  if (!imageBase64) {
    return {
      dominant_emotion: 'No Input',
      action_units: 'None',
      confidence: 0,
      engine: 'None',
      emotions: {},
    };
  }

  try {
    return await analyzeViaHttp(imageBase64);
  } catch (httpErr) {
    console.warn('DeepFace HTTP unavailable, trying Python CLI:', httpErr.message);
  }

  try {
    return await analyzeViaPythonCli(imageBase64);
  } catch (cliErr) {
    console.error('Face analysis failed (HTTP + CLI):', cliErr.message);
  }

  return {
    dominant_emotion: 'Service Offline',
    action_units: 'None',
    confidence: 0,
    engine: 'Offline',
    emotions: {},
    error: 'Run from project root: npm run install:all  then  npm start',
  };
}

module.exports = { analyzeFace, DEEPFACE_URL };
