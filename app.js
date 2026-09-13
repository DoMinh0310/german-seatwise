const STORAGE_KEY = 'seatwise-classroom-v1';
const THEME_KEY = 'seatwise-theme';
const STICKER_KEY = 'seatwise-stickers';
const vocabulary = [
  ['die Stimmung', 'bầu không khí, tâm trạng'], ['sich treffen', 'gặp nhau'], ['gemeinsam', 'cùng nhau'], ['die Einladung', 'lời mời'],
  ['der Ausflug', 'chuyến đi chơi'], ['genießen', 'tận hưởng'], ['die Umgebung', 'khu vực xung quanh'], ['sich freuen', 'vui mừng'],
  ['das Erlebnis', 'trải nghiệm'], ['wichtig', 'quan trọng'], ['die Gelegenheit', 'cơ hội'], ['warten', 'chờ đợi']
];

const state = loadState();
let toastTimer;

// Khởi tạo Mobile Drag and Drop Polyfill
if (typeof MobileDragDrop !== 'undefined') {
  MobileDragDrop.polyfill({
    holdToDrag: 300 // Giữ 300ms để kéo, giúp thao tác vuốt cuộn trang vẫn hoạt động
  });
  window.addEventListener('touchmove', function() {}, {passive: false});
}

const $ = (selector) => document.querySelector(selector);
const els = {
  currentDate: $('#currentDate'),
  addForm: $('#addStudentForm'),
  studentName: $('#studentName'),
  studentList: $('#studentList'),
  emptyState: $('#emptyState'),
  studentCount: $('#studentCount'),
  presentCount: $('#presentCount'),
  ruleForm: $('#ruleForm'),
  ruleA: $('#ruleStudentA'),
  ruleB: $('#ruleStudentB'),
  ruleList: $('#ruleList'),
  ruleCount: $('#ruleCount'),
  frontStudentList: $('#frontStudentList'),
  frontRowCapacity: $('#frontRowCapacity'),
  rowInput: $('#rowInput'),
  columnInput: $('#columnInput'),
  seedInput: $('#seedInput'),
  themeToggle: $('#themeToggle'),
  board: $('#seatingBoard'),
  resultFooter: $('#resultFooter'),
  toast: $('#toast')
  ,historyButton: $('#historyButton'),
  historyModal: $('#historyModal'),
  historyClose: $('#historyClose'),
  historyDays: $('#historyDays'),
  rankingChart: $('#rankingChart'),
  attendanceButton: $('#attendanceButton'),
  attendanceModal: $('#attendanceModal'),
  attendanceClose: $('#attendanceClose'),
  attendanceSummary: $('#attendanceSummary'),
  attendanceTable: $('#attendanceTable')
};

applyTheme(localStorage.getItem(THEME_KEY) || 'light');
applySeasonalFestival();
initVocabulary();
initStickers();
els.currentDate.textContent = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
$('#seatingDate').textContent = `· ${els.currentDate.textContent}`;
render();
renderHistory();
renderAttendance();

els.themeToggle.addEventListener('click', () => {
  const nextTheme = document.body.classList.contains('theme-dark') ? 'light' : 'dark';
  applyTheme(nextTheme);
  localStorage.setItem(THEME_KEY, nextTheme);
});
els.historyButton.addEventListener('click', () => { renderHistory(); els.historyModal.hidden = false; });
els.historyClose.addEventListener('click', closeHistory);
els.historyModal.addEventListener('click', (event) => { if (event.target.matches('[data-close-history]')) closeHistory(); });
els.attendanceButton.addEventListener('click', () => { renderAttendance(); els.attendanceModal.hidden = false; });
els.attendanceClose.addEventListener('click', closeAttendance);
els.attendanceModal.addEventListener('click', (event) => { if (event.target.matches('[data-close-attendance]')) closeAttendance(); });

els.addForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = els.studentName.value.trim();
  if (!name) return;
  if (state.students.some((student) => student.name.toLowerCase() === name.toLowerCase())) {
    showToast('Tên này đã có trong danh sách.');
    return;
  }
  state.students.push({ id: crypto.randomUUID(), name, present: true });
  els.studentName.value = '';
  saveState();
  render();
  els.studentName.focus();
});

els.studentList.addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-toggle]');
  const remove = event.target.closest('[data-remove]');
  if (toggle) {
    const student = state.students.find((item) => item.id === toggle.dataset.toggle);
    if (student) student.present = !student.present;
    clearArrangement();
    saveState();
    render();
  }
  if (remove) {
    const id = remove.dataset.remove;
    state.students = state.students.filter((student) => student.id !== id);
    state.rules = state.rules.filter((rule) => !rule.includes(id));
    state.frontRow = state.frontRow.filter((studentId) => studentId !== id);
    state.fixedSeats = state.fixedSeats.filter((fs) => fs.studentId !== id);
    clearArrangement();
    saveState();
    render();
    showToast('Đã xóa khỏi danh sách lớp.');
  }
});

$('#markAllPresent').addEventListener('click', () => {
  state.students.forEach((student) => { student.present = true; });
  clearArrangement();
  saveState();
  render();
});

els.ruleForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const first = els.ruleA.value;
  const second = els.ruleB.value;
  if (!first || !second || first === second) {
    showToast('Hãy chọn hai người khác nhau.');
    return;
  }
  const exists = state.rules.some((rule) => rule.includes(first) && rule.includes(second));
  if (exists) {
    showToast('Quy tắc này đã tồn tại.');
    return;
  }
  state.rules.push([first, second]);
  els.ruleA.value = '';
  els.ruleB.value = '';
  saveState();
  render();
  showToast('Đã thêm quy tắc ngồi cạnh.');
});

els.ruleList.addEventListener('click', (event) => {
  const remove = event.target.closest('[data-rule-index]');
  if (!remove) return;
  state.rules.splice(Number(remove.dataset.ruleIndex), 1);
  saveState();
  render();
});

els.frontStudentList.addEventListener('change', (event) => {
  const checkbox = event.target.closest('[data-front-student]');
  if (!checkbox) return;
  const id = checkbox.dataset.frontStudent;
  state.frontRow = checkbox.checked ? [...state.frontRow, id] : state.frontRow.filter((studentId) => studentId !== id);
  saveState();
  renderFrontStudents();
});

[els.rowInput, els.columnInput].forEach((input) => {
  input.addEventListener('change', () => {
    input.value = Math.min(8, Math.max(1, Number(input.value) || 1));
    state.layout[input.id === 'rowInput' ? 'rows' : 'columns'] = Number(input.value);
    state.arrangement = [];
    state.lastRandomized = null;
    saveState();
    renderFrontStudents();
    renderBoard(state.arrangement);
  });
});

$('#randomizeButton').addEventListener('click', () => {
  const presentStudents = state.students.filter((student) => student.present);
  const seatCount = state.layout.rows * state.layout.columns * 2;
  const frontCapacity = state.layout.columns * 2;
  if (!presentStudents.length) {
    showToast('Hãy thêm hoặc đánh dấu có mặt ít nhất một người.');
    return;
  }
  if (presentStudents.length > seatCount) {
    clearArrangement();
    saveState();
    renderBoard(state.arrangement);
    showToast(`Bố cục hiện tại chỉ chứa được ${seatCount} người.`);
    return;
  }
  if (state.frontRow.filter((id) => presentStudents.some((student) => student.id === id)).length > frontCapacity) {
    showToast(`Hàng đầu chỉ có ${frontCapacity} chỗ với bố cục hiện tại.`);
    return;
  }
  const requestedSeed = els.seedInput.value.trim();
  state.seed = requestedSeed || createSeed();
  if (!requestedSeed) els.seedInput.value = '';
  state.arrangement = findArrangement(presentStudents, state.rules, state.layout, state.seed);
  if (!state.arrangement) {
    clearArrangement();
    saveState();
    renderBoard(state.arrangement);
    showToast('Không tìm được sơ đồ thỏa mãn các luật hiện tại.');
    return;
  }
  state.lastRandomized = new Date().toISOString();
  recordHistory(state.arrangement, state.seed);
  saveState();
  renderBoard(state.arrangement);
  renderHistory();
  renderAttendance();
  els.resultFooter.innerHTML = `<span>Đã xếp ${presentStudents.length} người · ${formatTime(state.lastRandomized)}</span><span class="result-tip">Seed ${escapeHtml(String(state.seed))}</span>`;
  showToast('Sơ đồ chỗ ngồi mới đã sẵn sàng.');
});

$('#resetData').addEventListener('click', () => {
  if (!confirm('Xóa toàn bộ danh sách lớp và quy tắc?')) return;
  localStorage.removeItem(STORAGE_KEY);
  state.students = [];
  state.rules = [];
  state.arrangement = [];
  state.frontRow = [];
  state.seed = '';
  state.history = {};
  state.lastRandomized = null;
  saveState();
  render();
  renderHistory();
  renderAttendance();
  showToast('Đã làm trống dữ liệu.');
});

let dragSourceId = null;
document.addEventListener('dragstart', (e) => {
  const option = e.target.closest('.front-student-option');
  const card = e.target.closest('.student-card');
  const seat = e.target.closest('.seat.occupied');
  
  const hasArrangement = state.arrangement && state.arrangement.length > 0;

  if (option || card) {
    if (hasArrangement) {
        e.preventDefault();
        return;
    }
    dragSourceId = (option || card).dataset.dragId;
    e.dataTransfer.setData('text/plain', dragSourceId);
    e.dataTransfer.effectAllowed = 'copyMove';
  } else if (seat) {
    if (hasArrangement && Number(seat.dataset.tableIndex) >= state.layout.columns) {
        e.preventDefault();
        return;
    }
    dragSourceId = seat.dataset.studentId;
    e.dataTransfer.setData('text/plain', dragSourceId);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => seat.classList.add('is-dragging'), 0);
  }
});
document.addEventListener('dragend', (e) => {
  const seat = e.target.closest('.seat.occupied');
  if (seat) seat.classList.remove('is-dragging');
  dragSourceId = null;
});
els.board.addEventListener('dragover', (e) => {
  const seat = e.target.closest('.seat');
  const hasArrangement = state.arrangement && state.arrangement.length > 0;
  if (seat && dragSourceId) {
    if (hasArrangement && Number(seat.dataset.tableIndex) >= state.layout.columns) return;
    e.preventDefault();
    seat.classList.add('drag-over');
  }
});
els.board.addEventListener('dragleave', (e) => {
  const seat = e.target.closest('.seat');
  if (seat) seat.classList.remove('drag-over');
});
els.board.addEventListener('drop', (e) => {
  const seat = e.target.closest('.seat');
  if (!seat) return;
  
  const hasArrangement = state.arrangement && state.arrangement.length > 0;
  const tableIndex = Number(seat.dataset.tableIndex);
  
  if (hasArrangement && tableIndex >= state.layout.columns) return;

  e.preventDefault();
  seat.classList.remove('drag-over');
  
  const studentId = e.dataTransfer.getData('text/plain') || dragSourceId;
  if (!studentId) return;
  
  const seatIndex = Number(seat.dataset.seatIndex);
  
  if (hasArrangement) {
      let srcTable, srcSeat, srcStudent;
      for (let i = 0; i < state.layout.columns; i++) {
          for (let j = 0; j < state.arrangement[i].length; j++) {
              if (state.arrangement[i][j] && state.arrangement[i][j].id === studentId) {
                  srcTable = i; srcSeat = j; srcStudent = state.arrangement[i][j];
              }
          }
      }
      if (srcStudent) {
          const destStudent = state.arrangement[tableIndex][seatIndex];
          state.arrangement[tableIndex][seatIndex] = srcStudent;
          state.arrangement[srcTable][srcSeat] = destStudent;
          
          saveState();
          renderBoard(state.arrangement);
      }
      return;
  }
  if (tableIndex < state.layout.columns) {
    if (!state.frontRow.includes(studentId)) state.frontRow.push(studentId);
  }

  saveState();
  render();
});

function render() {
  els.studentCount.textContent = state.students.length;
  els.presentCount.textContent = state.students.filter((student) => student.present).length;
  els.rowInput.value = state.layout.rows;
  els.columnInput.value = state.layout.columns;
  renderStudents();
  renderRuleOptions();
  renderRules();
  renderFrontStudents();
  renderBoard(state.arrangement);
}

function clearArrangement() {
  state.arrangement = [];
  state.lastRandomized = null;
}

function recordHistory(arrangement, seed) {
  const now = new Date();
  const dayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const front = arrangement.slice(0, state.layout.columns).flat().map((student) => ({ id: student.id, name: student.name }));
  state.history[dayKey] = { seed: String(seed), front, people: arrangement.flat().length, attendance: arrangement.flat().map((student) => ({ id: student.id, name: student.name })) };
}

function renderHistory() {
  const history = state.history || {};
  const days = Object.entries(history).sort(([first], [second]) => second.localeCompare(first));
  els.historyDays.innerHTML = days.length ? `<strong>Ngày đã lưu</strong>${days.map(([date, item]) => `<div class="history-day"><span>${formatDate(date)}</span><small>${item.people} người · seed ${escapeHtml(item.seed)}</small></div>`).join('')}` : '<div class="history-empty">Chưa có sơ đồ nào được lưu.<br />Hãy random một lần để bắt đầu.</div>';
  const counts = {};
  days.forEach(([, item]) => item.front.forEach((student) => { counts[student.name] = (counts[student.name] || 0) + 1; }));
  const ranking = Object.entries(counts).sort(([firstName, firstCount], [secondName, secondCount]) => firstCount - secondCount || firstName.localeCompare(secondName, 'vi'));
  const max = Math.max(...ranking.map(([, count]) => count), 1);
  els.rankingChart.innerHTML = ranking.length ? `<strong>Số lần ngồi hàng đầu</strong>${ranking.map(([name, count], index) => `<div class="ranking-row"><span class="ranking-position">${index + 1}</span><span class="ranking-name">${escapeHtml(name)}</span><span class="ranking-bar"><i style="width: ${(count / max) * 100}%"></i></span><b>${count}</b></div>`).join('')}` : '<div class="history-empty">Chưa đủ dữ liệu để xếp hạng.</div>';
}

function closeHistory() { els.historyModal.hidden = true; }
function closeAttendance() { els.attendanceModal.hidden = true; }

function renderAttendance() {
  const weekdays = Object.entries(state.history || {}).filter(([date]) => { const day = new Date(`${date}T12:00:00`).getDay(); return day >= 1 && day <= 5; }).sort(([first], [second]) => first.localeCompare(second));
  const totalDays = weekdays.length;
  const presentByName = {};
  const names = new Set(state.students.map((student) => student.name));
  weekdays.forEach(([, record]) => (Array.isArray(record.attendance) ? record.attendance : []).filter((student) => student && typeof student.name === 'string').forEach((student) => { presentByName[student.name] = (presentByName[student.name] || 0) + 1; names.add(student.name); }));
  const rows = [...names].sort((first, second) => first.localeCompare(second, 'vi')).map((name) => { const present = presentByName[name] || 0; return { name, present, absent: Math.max(0, totalDays - present), rate: totalDays ? Math.round((present / totalDays) * 100) : 0 }; });
  els.attendanceSummary.innerHTML = `<div><strong>${totalDays}</strong><span>ngày học đã ghi</span></div><div><strong>${rows.reduce((sum, row) => sum + row.present, 0)}</strong><span>lượt có mặt</span></div><div><strong>${rows.reduce((sum, row) => sum + row.absent, 0)}</strong><span>lượt vắng</span></div>`;
  els.attendanceTable.innerHTML = totalDays && rows.length ? `<div class="attendance-row attendance-head"><span>Học sinh</span><span>Có mặt</span><span>Vắng</span><span>Tỷ lệ</span></div>${rows.map((row) => `<div class="attendance-row"><strong>${escapeHtml(row.name)}</strong><span>${row.present}</span><span>${row.absent}</span><span><i class="attendance-meter"><b style="width: ${row.rate}%"></b></i>${row.rate}%</span></div>`).join('')}` : '<div class="history-empty">Chưa có ngày học nào được lưu từ thứ 2 đến thứ 6.</div>';
}

function renderStudents() {
  els.emptyState.hidden = state.students.length > 0;
  els.emptyState.style.display = state.students.length > 0 ? 'none' : 'flex';
  els.studentList.querySelectorAll('.student-card').forEach((card) => card.remove());
  state.students.forEach((student) => {
    const card = document.createElement('div');
    card.className = `student-card ${student.present ? 'present' : 'absent'}`;
    card.setAttribute('draggable', 'true');
    card.setAttribute('data-drag-id', student.id);
    card.innerHTML = `<span class="avatar ${avatarTone(student)}">${initials(student.name)}</span><span class="student-name" title="${escapeHtml(student.name)}">${escapeHtml(student.name)}</span><button class="attendance-toggle" type="button" data-toggle="${student.id}" aria-label="${student.present ? 'Đánh dấu vắng' : 'Đánh dấu có mặt'}"></button><button class="remove-student" type="button" data-remove="${student.id}" title="Xóa học sinh">×</button>`;
    els.studentList.appendChild(card);
  });
}

function renderRuleOptions() {
  const presentStudents = state.students.filter(s => s.present);
  const options = presentStudents.map((student) => `<option value="${student.id}">${escapeHtml(student.name)}</option>`).join('');
  els.ruleA.innerHTML = `<option value="">Chọn người thứ nhất</option>${options}`;
  els.ruleB.innerHTML = `<option value="">Chọn người thứ hai</option>${options}`;
}

function renderRules() {
  els.ruleCount.textContent = state.rules.length;
  if (!state.rules.length) {
    els.ruleList.innerHTML = '<span class="muted-message">Chưa có quy tắc nào.</span>';
    return;
  }
  els.ruleList.innerHTML = state.rules.map((rule, index) => {
    const first = state.students.find((student) => student.id === rule[0]);
    const second = state.students.find((student) => student.id === rule[1]);
    if (!first || !second) return '';
    return `<span class="rule-chip">${escapeHtml(first.name)} × ${escapeHtml(second.name)} <button type="button" data-rule-index="${index}" aria-label="Xóa quy tắc">×</button></span>`;
  }).join('');
}

function renderFrontStudents() {
  const capacity = state.layout.columns * 2;
  state.frontRow = state.frontRow.filter((id) => state.students.some((student) => student.id === id));
  
  const presentStudents = state.students.filter(s => s.present);
  const presentSelectedCount = state.frontRow.filter((id) => presentStudents.some((student) => student.id === id)).length;
  
  els.frontRowCapacity.textContent = `${presentSelectedCount} / ${capacity} chỗ`;
  if (!presentStudents.length) {
    els.frontStudentList.innerHTML = '<span class="muted-message">Thêm học sinh để chọn.</span>';
    return;
  }
  els.frontStudentList.innerHTML = presentStudents.map((student) => {
    return `<label class="front-student-option" draggable="true" data-drag-id="${student.id}"><input type="checkbox" data-front-student="${student.id}" ${state.frontRow.includes(student.id) ? 'checked' : ''} /><span class="front-check"></span><span>${escapeHtml(student.name)}</span></label>`;
  }).join('');
}

function renderBoard(arrangement) {
  let isDraft = false;
  let displayArrangement = arrangement;
  if (!arrangement.length) {
    isDraft = true;
    const tableCount = state.layout.rows * state.layout.columns;
    displayArrangement = Array.from({ length: tableCount }, () => [null, null]);
  }

  const columns = state.layout.columns;
  els.board.innerHTML = `<div class="seat-grid" style="grid-template-columns: repeat(${columns}, minmax(120px, 1fr))">${displayArrangement.map((table, index) => `<div class="table ${index < columns ? 'front-table' : ''}"><span class="table-number">BÀN ${String(index + 1).padStart(2, '0')}</span><div class="table-seats">${table.map((student, seatIndex) => {
    if (!student) {
      return `<div class="seat empty-seat" data-table-index="${index}" data-seat-index="${seatIndex}"></div>`;
    }
    const isFrontTable = index < columns;
    const canDrag = isDraft || isFrontTable;
    return `<div class="seat occupied" ${canDrag ? 'draggable="true"' : ''} data-student-id="${student.id}" data-table-index="${index}" data-seat-index="${seatIndex}"><span class="seat-avatar ${avatarTone(student)}">${initials(student.name)}</span><span class="seat-name" title="${escapeHtml(student.name)}">${escapeHtml(student.name)}</span></div>`;
  }).join('')}</div></div>`).join('')}</div>`;
  
  if (!isDraft && state.lastRandomized) {
    els.resultFooter.innerHTML = `<span>Đã xếp ${arrangement.flat().length} người · ${formatTime(state.lastRandomized)}</span><span class="result-tip">Seed ${escapeHtml(String(state.seed || ''))}</span>`;
  } else {
    els.resultFooter.innerHTML = `<span>Kéo thả học sinh để ghim chỗ trước khi random</span><span class="result-tip">Hoặc bấm Random ngay</span>`;
  }
}

function findArrangement(students, rules, layout, seed) {
  const tableCount = layout.rows * layout.columns;
  const tables = Array.from({ length: tableCount }, () => []);
  const unpinnedStudents = [...students];
  const frontStudents = unpinnedStudents.filter((student) => state.frontRow.includes(student.id));
  const otherStudents = unpinnedStudents.filter((student) => !state.frontRow.includes(student.id));
  const blocked = new Set(rules.map(([first, second]) => [first, second].sort().join('|')));
  const random = seededRandom(seed);
  
  const totalStudents = students.length;
  const allowedSeats = new Set();
  let seatIdx = 0;
  while (allowedSeats.size < totalStudents) {
    allowedSeats.add(seatIdx);
    seatIdx++;
  }

  const candidates = frontStudents.length
    ? shuffle(frontStudents, random).concat(shuffle(otherStudents, random))
    : shuffle(unpinnedStudents, random);
  const placeNext = (studentIndex) => {
    if (studentIndex === candidates.length) return true;
    const student = candidates[studentIndex];
    const eligibleTables = tables.map((table, index) => index).filter((index) => {
      const isFrontEligible = !frontStudents.includes(student) || index < layout.columns;
      const occupiedCount = tables[index].filter(s => s !== undefined).length;
      return isFrontEligible && occupiedCount < 2;
    });
    for (const tableIndex of eligibleTables) {
      const emptySeatIndex = tables[tableIndex][0] === undefined ? 0 : 1;
      const flatIndex = tableIndex * 2 + emptySeatIndex;
      if (!allowedSeats.has(flatIndex)) continue;

      if (!canSit(student, tableIndex, tables, layout, blocked)) continue;
      tables[tableIndex][emptySeatIndex] = student;
      if (placeNext(studentIndex + 1)) return true;
      tables[tableIndex][emptySeatIndex] = undefined;
    }
    return false;
  };
  return placeNext(0) ? tables.map((table) => table.filter(s => s !== undefined)) : null;
}

function canSit(student, index, tables, layout, blocked) {
  const row = Math.floor(index / layout.columns);
  const column = index % layout.columns;
  if (tables[index].some((neighbor) => neighbor && blocked.has([student.id, neighbor.id].sort().join('|')))) return false;
  const nearby = [index - 1, index + 1, index - layout.columns, index + layout.columns];
  return nearby.every((nearIndex) => {
    if (nearIndex < 0 || nearIndex >= tables.length) return true;
    const nearRow = Math.floor(nearIndex / layout.columns);
    const nearColumn = nearIndex % layout.columns;
    if (Math.abs(nearRow - row) + Math.abs(nearColumn - column) !== 1) return true;
    return tables[nearIndex].every((neighbor) => !neighbor || !blocked.has([student.id, neighbor.id].sort().join('|')));
  });
}

function loadState() {
  const saved = readStorage(STORAGE_KEY, null);
  if (!saved) return { students: [], rules: [], frontRow: [], fixedSeats: [], arrangement: [], seed: '', history: {}, layout: { rows: 4, columns: 5 } };
  const history = saved.history && typeof saved.history === 'object' ? Object.fromEntries(Object.entries(saved.history).filter(([, record]) => record && Array.isArray(record.front))) : {};
  const students = Array.isArray(saved.students) ? saved.students.filter((student) => student && typeof student.id === 'string' && typeof student.name === 'string').map((student) => ({ id: student.id, name: student.name.slice(0, 40), present: student.present !== false })) : [];
  const rules = Array.isArray(saved.rules) ? saved.rules.filter((rule) => Array.isArray(rule) && rule.length === 2 && rule.every((id) => typeof id === 'string')) : [];
  const fixedSeats = Array.isArray(saved.fixedSeats) ? saved.fixedSeats.filter((s) => s && typeof s.studentId === 'string' && typeof s.tableIndex === 'number' && typeof s.seatIndex === 'number') : [];
  const arrangement = Array.isArray(saved.arrangement) && saved.arrangement.every((seat) => Array.isArray(seat)) ? saved.arrangement.map((table) => table.filter((student) => student && typeof student.id === 'string' && typeof student.name === 'string')) : [];
  return { ...saved, students, rules, frontRow: Array.isArray(saved.frontRow) ? saved.frontRow.filter((id) => typeof id === 'string') : [], fixedSeats, seed: typeof saved.seed === 'string' ? saved.seed.slice(0, 100) : '', history, layout: saved.layout && typeof saved.layout === 'object' ? saved.layout : { rows: 4, columns: 5 }, arrangement };
}
function readStorage(key, fallback) { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { localStorage.removeItem(key); return fallback; } }
function saveState() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { showToast('Không thể lưu dữ liệu trên trình duyệt này.'); } }
function createSeed() { return String(crypto.getRandomValues(new Uint32Array(1))[0]); }
function seedNumber(seed) { return String(seed).split('').reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 2166136261); }
function seededRandom(seed) { let value = seedNumber(seed); return () => { value += 0x6D2B79F5; let result = value; result = Math.imul(result ^ result >>> 15, result | 1); result ^= result + Math.imul(result ^ result >>> 7, result | 61); return ((result ^ result >>> 14) >>> 0) / 4294967296; }; }
function shuffle(items, random) { const result = [...items]; for (let index = result.length - 1; index > 0; index -= 1) { const swapIndex = Math.floor(random() * (index + 1)); [result[index], result[swapIndex]] = [result[swapIndex], result[index]]; } return result; }
function avatarTone(student) { const value = String(student.id || student.name).split('').reduce((hash, character) => ((hash << 5) - hash + character.charCodeAt(0)) | 0, 0); return `tone-${Math.abs(value) % 5 + 1}`; }
function initials(name) { return name.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase(); }
function formatTime(value) { return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
function formatDate(value) { return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T12:00:00`)); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
function showToast(message) { clearTimeout(toastTimer); els.toast.textContent = message; els.toast.classList.add('show'); toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2400); }
function applyTheme(theme) { const isDark = theme === 'dark'; document.body.classList.toggle('theme-dark', isDark); els.themeToggle.textContent = isDark ? '☀' : '☾'; els.themeToggle.title = isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'; els.themeToggle.setAttribute('aria-label', els.themeToggle.title); }
function applySeasonalFestival() {
  const month = new Date().getMonth() + 1;
  const festival = month === 12
    ? { season: 'winter', label: 'WINTER IN DEUTSCHLAND', name: 'WEIHNACHTSMARKT', dates: '01.12 — 24.12', stickers: ['🎄', '❄️', '☕', '✦'] }
    : month === 2
      ? { season: 'carnival', label: 'FEBRUAR IN DEUTSCHLAND', name: 'KARNEVAL', dates: '11.02 — 17.02', stickers: ['🎭', '🎈', '🎺', '✦'] }
      : month >= 3 && month <= 5
        ? { season: 'spring', label: 'FRÜHLING IN DEUTSCHLAND', name: 'FRÜHLINGSFEST', dates: 'MÄRZ — MAI', stickers: ['🌼', '🎡', '🍋', '✦'] }
        : month >= 9 && month <= 10
          ? { season: 'autumn', label: 'SEPTEMBER IN DEUTSCHLAND', name: 'CANNSTATTER VOLKSFEST', dates: '25.09 — 11.10.2026', stickers: ['🥨', '🍂', '🍺', '🎠'] }
          : { season: 'summer', label: 'SOMMER IN DEUTSCHLAND', name: 'SOMMERFEST', dates: 'JUNI — AUGUST', stickers: ['🌿', '☀️', '🍋', '🎡'] };
  document.body.dataset.season = festival.season;
  $('#festivalBanner').setAttribute('aria-label', festival.name);
  $('#festivalCopy').innerHTML = `${festival.label} <b>·</b> ${festival.name} <b>${festival.dates}</b>`;
  document.querySelectorAll('[data-sticker]').forEach((sticker, index) => { sticker.textContent = festival.stickers[index]; });
}
function initVocabulary() {
  const card = $('#vocabularyCard');
  const list = $('#vocabularyList');
  const counter = $('#vocabularyCounter');
  const previousButton = $('#vocabularyPrev');
  const nextButton = $('#vocabularyNext');
  const daySeed = Math.floor(Date.now() / 86400000);
  const words = [0, 1, 2].map((offset) => vocabulary[(daySeed + offset * 5) % vocabulary.length]);
  let currentIndex = 0;
  let revealed = false;
  let startX = null;
  const renderWord = () => {
    const [word, meaning] = words[currentIndex];
    list.innerHTML = `<button class="vocabulary-item ${revealed ? 'is-revealed' : ''}" type="button" aria-label="Xem nghĩa của ${escapeHtml(word)}"><span class="vocabulary-word">${escapeHtml(word)}</span><span class="vocabulary-meaning">${revealed ? escapeHtml(meaning) : 'Nhấn để xem nghĩa'}</span></button>`;
    counter.textContent = `${currentIndex + 1} / ${words.length}`;
  };
  const changeWord = (direction) => { currentIndex = (currentIndex + direction + words.length) % words.length; revealed = false; renderWord(); };
  renderWord();
  list.addEventListener('click', () => { revealed = !revealed; renderWord(); });
  previousButton.addEventListener('click', () => changeWord(-1));
  nextButton.addEventListener('click', () => changeWord(1));
  card.addEventListener('keydown', (event) => { if (event.key === 'ArrowLeft') changeWord(-1); if (event.key === 'ArrowRight') changeWord(1); });
  card.addEventListener('touchstart', (event) => { startX = event.changedTouches[0].clientX; }, { passive: true });
  card.addEventListener('touchend', (event) => { if (startX === null) return; const distance = event.changedTouches[0].clientX - startX; if (Math.abs(distance) > 35) changeWord(distance < 0 ? 1 : -1); startX = null; }, { passive: true });
}
function initStickers() {
  const saved = readStorage(STICKER_KEY, {});
  document.querySelectorAll('[data-sticker]').forEach((sticker) => {
    const position = saved[sticker.dataset.sticker];
    if (position) { sticker.style.left = `${position.x}px`; sticker.style.top = `${position.y}px`; sticker.style.right = 'auto'; }
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;
    sticker.addEventListener('pointerdown', (event) => { dragging = true; sticker.setPointerCapture(event.pointerId); const rect = sticker.getBoundingClientRect(); offsetX = event.clientX - rect.left; offsetY = event.clientY - rect.top; sticker.classList.add('is-dragging'); });
    sticker.addEventListener('pointermove', (event) => { if (!dragging) return; const x = Math.max(0, Math.min(window.innerWidth - sticker.offsetWidth, event.clientX - offsetX)); const y = Math.max(90, Math.min(window.innerHeight - sticker.offsetHeight, event.clientY - offsetY)); sticker.style.left = `${x}px`; sticker.style.top = `${y}px`; sticker.style.right = 'auto'; });
    sticker.addEventListener('pointerup', () => { dragging = false; sticker.classList.remove('is-dragging'); const rect = sticker.getBoundingClientRect(); const positions = readStorage(STICKER_KEY, {}); positions[sticker.dataset.sticker] = { x: Math.round(rect.left), y: Math.round(rect.top) }; try { localStorage.setItem(STICKER_KEY, JSON.stringify(positions)); } catch { showToast('Không thể lưu vị trí sticker.'); } });
  });
}
