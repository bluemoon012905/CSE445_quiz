const TYPE_LABELS = {
  multiple_choice: 'Multiple choice',
  true_false: 'True / False',
  short_answer: 'Short answer',
  multi_select: 'Select many',
  code_dropdown: 'Code practice'
};

const MODULE_PLACEHOLDERS = Array.from({ length: 7 }, (_, idx) => `Module ${idx + 8}`);

const elements = {
  setupForm: document.getElementById('quiz-setup-form'),
  moduleOptions: document.getElementById('module-options'),
  typeOptions: document.getElementById('type-options'),
  modulePillTemplate: document.getElementById('option-pill-template'),
  questionCountPill: document.getElementById('question-count-pill'),
  quizPanel: document.getElementById('quiz-panel'),
  setupPanel: document.getElementById('setup-panel'),
  summaryPanel: document.getElementById('summary-panel'),
  questionTitle: document.getElementById('question-title'),
  questionMeta: document.getElementById('question-meta'),
  questionBody: document.getElementById('question-body'),
  questionTimer: document.getElementById('question-timer'),
  quizProgress: document.getElementById('quiz-progress'),
  prevBtn: document.getElementById('prev-question'),
  nextBtn: document.getElementById('next-question'),
  finishBtn: document.getElementById('finish-quiz'),
  summaryTableBody: document.querySelector('#summary-table tbody'),
  summaryMeta: document.getElementById('summary-meta'),
  downloadSummaryBtn: document.getElementById('download-summary'),
  retakeButton: document.getElementById('retake-quiz'),
  moduleSummaryBody: document.querySelector('#module-summary-table tbody')
};

const state = {
  questionBank: [],
  activeQuiz: null,
  questionStartTime: null,
  timerInterval: null,
  summaryEntries: [],
  hideModuleInfo: false
};

init();

async function init() {
  attachEventListeners();
  await loadQuestionBank();
}

function attachEventListeners() {
  elements.setupForm.addEventListener('submit', (event) => {
    event.preventDefault();
    startQuizFromForm();
  });

  elements.prevBtn.addEventListener('click', () => {
    if (!state.activeQuiz) {
      return;
    }
    moveToQuestion(state.activeQuiz.currentIndex - 1);
  });
  elements.nextBtn.addEventListener('click', () => {
    if (!state.activeQuiz) {
      return;
    }
    moveToQuestion(state.activeQuiz.currentIndex + 1);
  });
  elements.finishBtn.addEventListener('click', finishQuiz);
  elements.downloadSummaryBtn.addEventListener('click', downloadSummary);
  elements.retakeButton.addEventListener('click', resetToBuilder);
}

async function loadQuestionBank() {
  try {
    const response = await fetch('./questions.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Failed to load questions');
    }
    const data = await response.json();
    state.questionBank = Array.isArray(data.questions) ? data.questions : [];
    updateQuestionCountPill();
    renderFilters();
    renderModuleSummary();
  } catch (error) {
    console.error(error);
    state.questionBank = [];
    elements.questionCountPill.textContent = 'Failed to load questions';
    elements.questionCountPill.classList.add('error');
  }
}

function updateQuestionCountPill() {
  const count = state.questionBank.length;
  if (!count) {
    elements.questionCountPill.textContent = 'No questions yet';
    return;
  }
  elements.questionCountPill.textContent = `${count} question${count === 1 ? '' : 's'} ready`;
}

function renderFilters() {
  renderModuleOptions();
  renderTypeOptions();
}

function renderModuleOptions() {
  const container = elements.moduleOptions;
  container.innerHTML = '';
  const availableModules = Array.from(new Set(state.questionBank.map((q) => q.module))).filter(Boolean);
  const availableSet = new Set(availableModules);
  const entries = [];
  const seen = new Set();

  MODULE_PLACEHOLDERS.forEach((name) => {
    entries.push({ name, disabled: !availableSet.has(name) });
    seen.add(name);
  });

  availableModules
    .filter((name) => !seen.has(name))
    .sort()
    .forEach((name) => {
      entries.push({ name, disabled: false });
    });

  entries.forEach((entry, idx) => {
    const pill = createPill(entry.name, 'modules', idx, !entry.disabled, entry.name, entry.disabled);
    container.appendChild(pill);
  });

  if (!availableModules.length) {
    const helper = document.createElement('p');
    helper.className = 'meta';
    helper.textContent = 'Add questions to enable module selection.';
    container.appendChild(helper);
  }
}

function renderModuleSummary() {
  if (!elements.moduleSummaryBody) {
    return;
  }
  const body = elements.moduleSummaryBody;
  body.innerHTML = '';
  const availableModules = Array.from(new Set(state.questionBank.map((q) => q.module))).filter(Boolean);
  const extras = availableModules.filter((name) => !MODULE_PLACEHOLDERS.includes(name)).sort();
  const modules = [...MODULE_PLACEHOLDERS, ...extras];
  modules.forEach((moduleName) => {
    const questions = state.questionBank.filter((q) => q.module === moduleName);
    const generatedCount = questions.filter((q) => q.generated).length;
    const uploadedCount = questions.length - generatedCount;
    const row = document.createElement('tr');
    const moduleCell = document.createElement('td');
    moduleCell.textContent = moduleName;
    const uploadedCell = document.createElement('td');
    uploadedCell.textContent = uploadedCount;
    const generatedCell = document.createElement('td');
    generatedCell.textContent = generatedCount;
    row.appendChild(moduleCell);
    row.appendChild(uploadedCell);
    row.appendChild(generatedCell);
    body.appendChild(row);
  });
}

function renderTypeOptions() {
  const container = elements.typeOptions;
  container.innerHTML = '';
  const availableTypes = Array.from(new Set(state.questionBank.map((q) => q.type))).filter(Boolean);
  const order = Object.keys(TYPE_LABELS);
  availableTypes.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  availableTypes.forEach((typeName, idx) => {
    const pill = createPill(TYPE_LABELS[typeName] || typeName, 'types', idx, true, typeName);
    container.appendChild(pill);
  });
  if (!availableTypes.length) {
    container.textContent = 'Supported question types will appear here.';
  }
}

function createPill(label, groupName, idx, checked = false, valueOverride, disabled = false) {
  const node = elements.modulePillTemplate.content.firstElementChild.cloneNode(true);
  const input = node.querySelector('input');
  const span = node.querySelector('span');
  input.name = groupName;
  input.type = 'checkbox';
  input.id = `${groupName}-${idx}`;
  input.value = valueOverride || label;
  input.checked = checked && !disabled;
  input.disabled = disabled;
  span.textContent = label;
  if (disabled) {
    node.classList.add('pill-disabled');
  }
  return node;
}

function startQuizFromForm() {
  if (!state.questionBank.length) {
    alert('No questions available yet. Upload the question bank to begin.');
    return;
  }
  const formData = new FormData(elements.setupForm);
  const requestedCount = Number(formData.get('questionCount')) || 1;
  const selectedModules = formData.getAll('modules');
  const selectedTypes = formData.getAll('types');
  const shuffle = formData.get('shuffle') === 'on';
  const includeGenerated = formData.get('includeGenerated') === 'on';
  const hideModuleInfo = formData.get('hideModuleInfo') === 'on';
  startQuiz({ requestedCount, selectedModules, selectedTypes, shuffle, includeGenerated, hideModuleInfo });
}

function startQuiz({ requestedCount, selectedModules, selectedTypes, shuffle, includeGenerated, hideModuleInfo }) {
  const modulesSet = selectedModules.length ? new Set(selectedModules) : null;
  const typesSet = selectedTypes.length ? new Set(selectedTypes) : null;
  const filtered = state.questionBank.filter((question) => {
    const moduleMatch = modulesSet ? modulesSet.has(question.module) : true;
    const typeMatch = typesSet ? typesSet.has(question.type) : true;
    const generatedMatch = includeGenerated ? true : !question.generated;
    return moduleMatch && typeMatch && generatedMatch;
  });

  if (!filtered.length) {
    alert('No questions match the selected modules/types.');
    return;
  }

  const questionCount = Math.min(requestedCount, filtered.length);
  const selection = shuffle ? shuffleArray(filtered) : filtered.slice();
  const chosen = selection.slice(0, questionCount);

  state.activeQuiz = {
    questions: chosen,
    currentIndex: 0,
    responses: chosen.map(() => ({ answer: null, timeSpentMs: 0 })),
    startedAt: Date.now()
  };
  state.summaryEntries = [];
  state.hideModuleInfo = hideModuleInfo;
  elements.setupPanel.hidden = true;
  elements.summaryPanel.hidden = true;
  elements.quizPanel.hidden = false;
  moveToQuestion(0, { skipPersist: true });
}

function moveToQuestion(targetIndex, options = {}) {
  if (!state.activeQuiz) {
    return;
  }
  const { questions } = state.activeQuiz;
  if (targetIndex < 0 || targetIndex >= questions.length) {
    return;
  }
  if (!options.skipPersist) {
    persistCurrentResponse();
  }
  state.activeQuiz.currentIndex = targetIndex;
  renderQuestion();
  beginQuestionTimer();
}

function renderQuestion() {
  const quiz = state.activeQuiz;
  const question = quiz.questions[quiz.currentIndex];
  elements.questionTitle.textContent = `Question ${quiz.currentIndex + 1} of ${quiz.questions.length}`;
  const typeLabel = TYPE_LABELS[question.type] || question.type;
  const diff = question.difficulty ? ` • Difficulty: ${capitalize(question.difficulty)}` : '';
  const metaParts = [];
  if (!state.hideModuleInfo) {
    metaParts.push(question.module);
  }
  metaParts.push(question.topic);
  metaParts.push(typeLabel);
  elements.questionMeta.textContent = `${metaParts.join(' • ')}${diff}`;
  elements.questionBody.innerHTML = '';

  const prompt = document.createElement('p');
  prompt.textContent = question.prompt;
  elements.questionBody.appendChild(prompt);
  if (question.type === 'code_dropdown' && question.code) {
    const pre = document.createElement('pre');
    pre.className = 'code-snippet';
    pre.textContent = question.code;
    elements.questionBody.appendChild(pre);
  }

  const answerBlock = document.createElement('div');
  answerBlock.className = 'answer-block';
  const response = state.activeQuiz.responses[quiz.currentIndex];

  if (question.type === 'short_answer') {
    const textarea = document.createElement('textarea');
    textarea.className = 'text-answer';
    textarea.value = response.answer || '';
    textarea.placeholder = 'Type your answer…';
    textarea.dataset.answerInput = 'short';
    answerBlock.appendChild(textarea);
  } else if (question.type === 'true_false') {
    renderBooleanOptions(answerBlock, response.answer, question);
  } else if (question.type === 'multi_select') {
    renderMultiSelectOptions(answerBlock, response.answer, question);
  } else if (question.type === 'code_dropdown') {
    renderCodeDropdown(answerBlock, response.answer, question);
  } else {
    renderSingleChoiceOptions(answerBlock, response.answer, question);
  }

  elements.questionBody.appendChild(answerBlock);
  updateNavigationButtons();
  updateProgressText();
}

function renderSingleChoiceOptions(container, storedAnswer, question) {
  const options = question.options && question.options.length ? question.options : [];
  options.forEach((option, idx) => {
    const wrapper = document.createElement('label');
    wrapper.className = 'answer-option';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'single-answer';
    input.value = option.id;
    input.checked = storedAnswer === option.id;
    const span = document.createElement('span');
    span.textContent = option.label;
    wrapper.appendChild(input);
    wrapper.appendChild(span);
    container.appendChild(wrapper);
  });
}

function renderBooleanOptions(container, storedAnswer, question) {
  const options = question.options && question.options.length
    ? question.options
    : [
        { id: 'true', label: 'True', value: true },
        { id: 'false', label: 'False', value: false }
      ];
  options.forEach((option) => {
    const wrapper = document.createElement('label');
    wrapper.className = 'answer-option';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'boolean-answer';
    const value = typeof option.value === 'boolean' ? option.value : option.id === 'true';
    input.value = value ? 'true' : 'false';
    input.checked = storedAnswer === value;
    const span = document.createElement('span');
    span.textContent = option.label;
    wrapper.appendChild(input);
    wrapper.appendChild(span);
    container.appendChild(wrapper);
  });
}

function renderMultiSelectOptions(container, storedAnswer, question) {
  const storedSet = Array.isArray(storedAnswer) ? new Set(storedAnswer) : new Set();
  const options = question.options || [];
  options.forEach((option, idx) => {
    const wrapper = document.createElement('label');
    wrapper.className = 'answer-option';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = 'multi-answer';
    input.value = option.id;
    input.checked = storedSet.has(option.id);
    const span = document.createElement('span');
    span.textContent = option.label;
    wrapper.appendChild(input);
    wrapper.appendChild(span);
    container.appendChild(wrapper);
  });
}

function renderCodeDropdown(container, storedAnswer, question) {
  const select = document.createElement('select');
  select.className = 'dropdown-answer';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Select an option';
  select.appendChild(placeholder);
  (question.options || []).forEach((option) => {
    const opt = document.createElement('option');
    opt.value = option.id;
    opt.textContent = option.label;
    select.appendChild(opt);
  });
  select.value = storedAnswer || '';
  container.appendChild(select);
}

function persistCurrentResponse() {
  if (!state.activeQuiz) {
    return;
  }
  const question = state.activeQuiz.questions[state.activeQuiz.currentIndex];
  const response = state.activeQuiz.responses[state.activeQuiz.currentIndex];
  const timeNow = Date.now();
  if (state.questionStartTime) {
    response.timeSpentMs += timeNow - state.questionStartTime;
  }
  clearInterval(state.timerInterval);
  state.timerInterval = null;
  state.questionStartTime = null;

  let answer = null;
  if (question.type === 'short_answer') {
    const textarea = elements.questionBody.querySelector('textarea');
    answer = textarea ? textarea.value.trim() : '';
  } else if (question.type === 'true_false') {
    const checked = elements.questionBody.querySelector('input[name="boolean-answer"]:checked');
    if (checked) {
      answer = checked.value === 'true';
    }
  } else if (question.type === 'multi_select') {
    answer = Array.from(elements.questionBody.querySelectorAll('input[name="multi-answer"]:checked')).map((input) => input.value);
    if (!answer.length) {
      answer = null;
    }
  } else if (question.type === 'code_dropdown') {
    const select = elements.questionBody.querySelector('select.dropdown-answer');
    answer = select ? select.value || null : null;
  } else {
    const selected = elements.questionBody.querySelector('input[name="single-answer"]:checked');
    answer = selected ? selected.value : null;
  }
  response.answer = answer;
}

function beginQuestionTimer() {
  clearInterval(state.timerInterval);
  const response = state.activeQuiz.responses[state.activeQuiz.currentIndex];
  state.questionStartTime = Date.now();
  updateTimerDisplay(response.timeSpentMs);
  state.timerInterval = setInterval(() => {
    updateTimerDisplay(response.timeSpentMs + (Date.now() - state.questionStartTime));
  }, 250);
}

function updateTimerDisplay(totalMs) {
  const seconds = Math.floor(totalMs / 1000);
  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');
  elements.questionTimer.textContent = `${mins}:${secs}`;
}

function updateNavigationButtons() {
  const quiz = state.activeQuiz;
  elements.prevBtn.disabled = quiz.currentIndex === 0;
  elements.nextBtn.hidden = quiz.currentIndex === quiz.questions.length - 1;
  elements.finishBtn.hidden = quiz.currentIndex !== quiz.questions.length - 1;
}

function updateProgressText() {
  const answered = state.activeQuiz.responses.filter((res) => res.answer !== null && res.answer !== '').length;
  const total = state.activeQuiz.questions.length;
  elements.quizProgress.textContent = `${answered}/${total} question${total === 1 ? '' : 's'} answered`;
}

function finishQuiz() {
  persistCurrentResponse();
  const quiz = state.activeQuiz;
  if (!quiz) {
    return;
  }
  const summaryEntries = quiz.questions.map((question, idx) => {
    const userAnswer = quiz.responses[idx].answer;
    const timeSpentMs = quiz.responses[idx].timeSpentMs;
    const correctness = isAnswerCorrect(question, userAnswer);
    return {
      index: idx + 1,
      question,
      userAnswer,
      timeSpentMs,
      correct: correctness
    };
  });
  state.summaryEntries = summaryEntries;
  renderSummary();
  elements.quizPanel.hidden = true;
  elements.summaryPanel.hidden = false;
}

function renderSummary() {
  const totalQuestions = state.summaryEntries.length;
  const correctCount = state.summaryEntries.filter((entry) => entry.correct).length;
  const totalTime = state.summaryEntries.reduce((acc, entry) => acc + entry.timeSpentMs, 0);
  const formattedTime = formatDuration(totalTime);
  elements.summaryMeta.textContent = `${totalQuestions} question${totalQuestions === 1 ? '' : 's'} · ${correctCount} correct · ${formattedTime}`;
  elements.summaryTableBody.innerHTML = '';
  state.summaryEntries.forEach((entry) => {
    const row = document.createElement('tr');
    const userAnswerText = formatUserAnswer(entry.question, entry.userAnswer);
    const correctText = formatCorrectAnswer(entry.question);
    appendTextCell(row, entry.index);
    appendTextCell(row, entry.question.module);
    appendSourceCell(row, entry.question);
    appendTextCell(row, entry.question.topic);
    appendTextCell(row, entry.question.prompt);
    const userCell = document.createElement('td');
    userCell.innerHTML = userAnswerText;
    row.appendChild(userCell);
    const correctCell = document.createElement('td');
    correctCell.innerHTML = correctText;
    row.appendChild(correctCell);
    const resultCell = document.createElement('td');
    resultCell.className = entry.correct ? 'result-pass' : 'result-fail';
    resultCell.textContent = entry.correct ? 'Correct' : 'Incorrect';
    row.appendChild(resultCell);
    const timeCell = document.createElement('td');
    timeCell.textContent = (entry.timeSpentMs / 1000).toFixed(1);
    row.appendChild(timeCell);
    elements.summaryTableBody.appendChild(row);
  });
}

function appendTextCell(row, value) {
  const cell = document.createElement('td');
  cell.textContent = value;
  row.appendChild(cell);
}

function appendSourceCell(row, question) {
  const cell = document.createElement('td');
  cell.textContent = question.generated ? 'Generated' : 'Course';
  row.appendChild(cell);
}

function formatUserAnswer(question, answer) {
  if (answer === null || answer === undefined || (typeof answer === 'string' && !answer)) {
    return '<span class="meta">Unanswered</span>';
  }
  if (Array.isArray(answer)) {
    if (!answer.length) {
      return '<span class="meta">Unanswered</span>';
    }
    return answer.map((value) => optionLabel(question, value)).join('<br />');
  }
  if (typeof answer === 'boolean') {
    return answer ? 'True' : 'False';
  }
  return optionLabel(question, answer);
}

function formatCorrectAnswer(question) {
  const { answer } = question;
  if (Array.isArray(answer)) {
    return answer.map((id) => optionLabel(question, id)).join('<br />');
  }
  if (typeof answer === 'boolean') {
    return answer ? 'True' : 'False';
  }
  return optionLabel(question, answer);
}

function optionLabel(question, value) {
  if (!question.options || !question.options.length) {
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
  const match = question.options.find((opt) => opt.id === value);
  return match ? match.label : value;
}

function isAnswerCorrect(question, userAnswer) {
  if (userAnswer === null || userAnswer === undefined || userAnswer === '') {
    return false;
  }
  if (question.type === 'short_answer') {
    return userAnswer.trim().toLowerCase() === question.answer.trim().toLowerCase();
  }
  if (question.type === 'true_false') {
    return Boolean(userAnswer) === question.answer;
  }
  if (question.type === 'multi_select') {
    if (!Array.isArray(userAnswer)) {
      return false;
    }
    const expected = Array.isArray(question.answer) ? question.answer : [];
    if (expected.length !== userAnswer.length) {
      return false;
    }
    const expectedSet = new Set(expected);
    return userAnswer.every((value) => expectedSet.has(value));
  }
  return userAnswer === question.answer;
}

function shuffleArray(array) {
  const clone = array.slice();
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function capitalize(value) {
  if (!value) {
    return '';
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

function resetToBuilder() {
  state.activeQuiz = null;
  state.summaryEntries = [];
  elements.quizPanel.hidden = true;
  elements.summaryPanel.hidden = true;
  elements.setupPanel.hidden = false;
}

function downloadSummary() {
  if (!state.summaryEntries.length) {
    alert('Generate a quiz summary first.');
    return;
  }
  const pdfBytes = buildSummaryPdf(state.summaryEntries);
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `quiz-summary-${Date.now()}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function buildSummaryPdf(entries) {
  const headerLines = [
    'CSE445 Quiz Summary',
    `Generated: ${new Date().toLocaleString()}`,
    ''
  ];
  const detailLines = entries.flatMap((entry) => {
    const userAnswer = stripHtml(formatUserAnswer(entry.question, entry.userAnswer));
    const correctAnswer = stripHtml(formatCorrectAnswer(entry.question));
    const time = `${(entry.timeSpentMs / 1000).toFixed(1)}s`;
    const sourceLabel = entry.question.generated ? 'Generated' : 'Official';
    return [
      `Q${entry.index}: ${entry.question.prompt}`,
      `Module: ${entry.question.module} | Topic: ${entry.question.topic} | Source: ${sourceLabel}`,
      `Answer: ${userAnswer} | Correct: ${correctAnswer} | Time: ${time}`,
      `Result: ${entry.correct ? 'Correct' : 'Incorrect'}`,
      ''
    ];
  });
  const lines = headerLines.concat(detailLines);
  return generateSimplePdf(lines);
}

function stripHtml(value) {
  const tmp = document.createElement('div');
  tmp.innerHTML = value;
  return tmp.textContent || tmp.innerText || '';
}

function generateSimplePdf(lines) {
  const sanitizedLines = lines.map((line) =>
    line
      .replace(/\r?\n/g, ' ')
      .replace(/[()\\]/g, (match) => `\\${match}`)
  );
  const pages = [];
  const lineHeight = 18;
  let currentLines = [];
  let currentY = 780;
  const topY = 780;
  sanitizedLines.forEach((line) => {
    if (currentY < 60) {
      pages.push(currentLines);
      currentLines = [];
      currentY = topY;
    }
    currentLines.push({ text: line, y: currentY });
    currentY -= lineHeight;
  });
  if (currentLines.length) {
    pages.push(currentLines);
  }
  if (!pages.length) {
    pages.push([{ text: ' ', y: topY }]);
  }

  const encoder = new TextEncoder();
  const objects = new Map();
  const pageObjectNumbers = pages.map((_, idx) => 3 + idx * 2);
  const fontObjectNumber = 3 + pages.length * 2;

  objects.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
  objects.set(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pageObjectNumbers.map((num) => `${num} 0 R`).join(' ')}] >>`);

  pages.forEach((linesForPage, idx) => {
    const pageObjectNumber = pageObjectNumbers[idx];
    const contentObjectNumber = pageObjectNumber + 1;
    const textCommands = linesForPage
      .map((line) => `BT /F1 12 Tf 50 ${line.y} Td (${line.text}) Tj ET`)
      .join('\n');
    const byteLength = encoder.encode(textCommands).length;
    objects.set(
      pageObjectNumber,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentObjectNumber} 0 R /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> >>`
    );
    objects.set(contentObjectNumber, `<< /Length ${byteLength} >>\nstream\n${textCommands}\nendstream`);
  });
  objects.set(fontObjectNumber, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  let pdfString = '%PDF-1.4\n';
  const offsets = [0];
  const orderedKeys = Array.from(objects.keys()).sort((a, b) => a - b);
  orderedKeys.forEach((key) => {
    offsets[key] = pdfString.length;
    pdfString += `${key} 0 obj\n${objects.get(key)}\nendobj\n`;
  });
  const xrefOffset = pdfString.length;
  const objectCount = fontObjectNumber + 1;
  pdfString += `xref\n0 ${objectCount}\n`;
  pdfString += '0000000000 65535 f \n';
  for (let i = 1; i < objectCount; i += 1) {
    const offset = offsets[i] ?? pdfString.length;
    pdfString += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdfString += `trailer << /Size ${objectCount} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return encoder.encode(pdfString);
}
