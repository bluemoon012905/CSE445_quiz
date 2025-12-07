import http from 'http';
import { readFile, writeFile, access, stat } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 4173;
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const QUESTION_FILE = path.join(DATA_DIR, 'questions.json');
const MAX_REQUEST_SIZE = 1_000_000; // 1 MB for question uploads

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

async function ensureQuestionFile() {
  try {
    await access(QUESTION_FILE);
  } catch (_) {
    await writeFile(QUESTION_FILE, JSON.stringify({ questions: [] }, null, 2), 'utf8');
  }
}

async function loadQuestionBank() {
  const file = await readFile(QUESTION_FILE, 'utf8');
  const parsed = JSON.parse(file);
  if (!Array.isArray(parsed.questions)) {
    return { questions: [] };
  }
  return parsed;
}

async function saveQuestionBank(bank) {
  await writeFile(QUESTION_FILE, JSON.stringify(bank, null, 2), 'utf8');
}

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_REQUEST_SIZE) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(parsed);
      } catch (error) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', (err) => reject(err));
  });
}

function validateQuestionPayload(candidate) {
  const errors = [];
  const required = ['module', 'topic', 'prompt', 'type', 'answer'];
  required.forEach((field) => {
    if (candidate[field] === undefined || candidate[field] === null || candidate[field] === '') {
      errors.push(`Missing field: ${field}`);
    }
  });

  const supportedTypes = ['multiple_choice', 'true_false', 'short_answer', 'multi_select'];
  if (!supportedTypes.includes(candidate.type)) {
    errors.push(`Unsupported type: ${candidate.type}`);
  }

  if (['multiple_choice', 'multi_select'].includes(candidate.type)) {
    if (!Array.isArray(candidate.options) || candidate.options.length < 2) {
      errors.push('Options array with at least two entries is required');
    }
  }

  if (candidate.type === 'multiple_choice') {
    if (typeof candidate.answer !== 'string') {
      errors.push('Multiple choice questions expect a string answer matching an option id');
    }
  }

  if (candidate.type === 'true_false') {
    if (typeof candidate.answer !== 'boolean') {
      errors.push('True/false questions must store a boolean answer');
    }
  }

  if (candidate.type === 'short_answer') {
    if (typeof candidate.answer !== 'string' || !candidate.answer.trim()) {
      errors.push('Short answer questions store the reference answer as text');
    }
  }

  if (candidate.type === 'multi_select') {
    if (!Array.isArray(candidate.answer) || !candidate.answer.length) {
      errors.push('Multi-select questions require an array of correct option ids');
    }
  }

  if (candidate.options) {
    const ids = new Set();
    candidate.options.forEach((opt, idx) => {
      if (!opt || typeof opt.id !== 'string' || !opt.id.trim()) {
        errors.push(`Option ${idx + 1} is missing an id`);
      } else if (ids.has(opt.id)) {
        errors.push(`Duplicate option id detected: ${opt.id}`);
      }
      if (!opt.label || typeof opt.label !== 'string') {
        errors.push(`Option ${idx + 1} needs a label`);
      }
      ids.add(opt.id);
    });
  }

  return errors;
}

function buildQuestionId(question) {
  if (question.id && typeof question.id === 'string') {
    return question.id;
  }
  const slugBase = `${question.module || 'module'}-${question.topic || 'topic'}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  const suffix = Date.now().toString(36);
  return `${slugBase}-${suffix}`;
}

async function handleApiRequest(req, res, url) {
  if (url.pathname === '/api/questions' && req.method === 'GET') {
    const bank = await loadQuestionBank();
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(bank));
    return;
  }

  if (url.pathname === '/api/questions' && req.method === 'POST') {
    try {
      const { question } = await readJsonBody(req);
      if (!question || typeof question !== 'object') {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Body must contain a question object' }));
        return;
      }
      const errors = validateQuestionPayload(question);
      if (errors.length) {
        res.writeHead(422, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ error: 'Invalid question payload', details: errors }));
        return;
      }
      const bank = await loadQuestionBank();
      const questionWithId = { ...question, id: buildQuestionId(question) };
      bank.questions.push(questionWithId);
      await saveQuestionBank(bank);
      res.writeHead(201, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ question: questionWithId }));
      return;
    } catch (error) {
      res.writeHead(400, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ error: error.message }));
      return;
    }
  }

  if (url.pathname === '/api/questions' && req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify({ error: 'Not found' }));
}

async function serveStaticAsset(urlPath, res) {
  const safePath = path.normalize(urlPath).replace(/^\/+/, '');
  const targetPath = path.join(PUBLIC_DIR, safePath === '' ? 'index.html' : safePath);
  if (!targetPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  let filePath = targetPath;
  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Server error');
  }
}

await ensureQuestionFile();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) {
      await handleApiRequest(req, res, url);
      return;
    }
    await serveStaticAsset(url.pathname, res);
  } catch (error) {
    console.error('Request error', error);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Unexpected error');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Quiz server running on http://${HOST}:${PORT}`);
});
