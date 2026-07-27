const currentUserInfo = document.getElementById('currentUserInfo');
const currentUserEmailEl = document.getElementById('currentUserEmail');
const changeUserEmail = document.getElementById('changeUserEmail');
const userEmailModal = document.getElementById('userEmailModal');
const userEmailForm = document.getElementById('userEmailForm');
const userEmailInput = document.getElementById('userEmailInput');
const userEmailMessage = document.getElementById('userEmailMessage');
const roleSelectorSection = document.querySelector('.role-selector');
const roleSelect = document.getElementById('roleSelect');
const submitterSection = document.getElementById('submitterSection');
const managerSection = document.getElementById('managerSection');
const ownerSection = document.getElementById('ownerSection');
const submitFeedbackForm = document.getElementById('submitFeedbackForm');
const submitResult = document.getElementById('submitResult');
const dashboardCards = document.getElementById('dashboardCards');
const managerListView = document.getElementById('managerListView');
const managerKanbanView = document.getElementById('managerKanbanView');
const managerItemsPane = document.getElementById('managerItemsPane');
const managerReportingPane = document.getElementById('managerReportingPane');
const statusChartCanvas = document.getElementById('statusChart');
const dueDateChartCanvas = document.getElementById('dueDateChart');
const reportSummary = document.getElementById('reportSummary');
const statusFilter = document.getElementById('statusFilter');
const feedbackDetail = document.getElementById('feedbackDetail');
const viewSwitchButtons = document.querySelectorAll('.view-switch button');
const paneSwitchButtons = document.querySelectorAll('.pane-switch button');
const ownerEmailInput = document.getElementById('ownerEmail');
const loadOwnerActions = document.getElementById('loadOwnerActions');
const ownerActions = document.getElementById('ownerActions');
let currentUserEmail = '';
let feedbackItems = [];
let managerViewMode = 'table';
let managerPane = 'items';
let statusValues = ['New', 'Accepted', 'In Progress', 'Complete', 'Declined'];

function showRole(role) {
  submitterSection.classList.toggle('hidden', role !== 'submitter');
  managerSection.classList.toggle('hidden', role !== 'manager');
  ownerSection.classList.toggle('hidden', role !== 'owner');
}

function setCurrentUserEmail(email) {
  currentUserEmail = email;
  localStorage.setItem('currentUserEmail', email);
  currentUserEmailEl.textContent = email;
  currentUserInfo.classList.remove('hidden');
  userEmailModal.classList.add('hidden');
  roleSelectorSection.classList.remove('hidden');
  showRole(roleSelect.value);
  loadDashboard();
  loadFeedback();
}

function clearCurrentUserEmail() {
  currentUserEmail = '';
  localStorage.removeItem('currentUserEmail');
  currentUserEmailEl.textContent = '';
  currentUserInfo.classList.add('hidden');
  roleSelectorSection.classList.add('hidden');
  submitterSection.classList.add('hidden');
  managerSection.classList.add('hidden');
  ownerSection.classList.add('hidden');
  userEmailModal.classList.remove('hidden');
}

function loadCurrentUser() {
  const savedEmail = localStorage.getItem('currentUserEmail');
  if (savedEmail) {
    setCurrentUserEmail(savedEmail);
  } else {
    clearCurrentUserEmail();
  }
}

roleSelect.addEventListener('change', () => showRole(roleSelect.value));

userEmailForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const email = userEmailInput.value.trim().toLowerCase();
  if (!email) {
    userEmailMessage.textContent = 'Please enter a valid email address.';
    return;
  }

  userEmailMessage.textContent = '';
  setCurrentUserEmail(email);
});

changeUserEmail.addEventListener('click', () => {
  clearCurrentUserEmail();
});

submitFeedbackForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  submitResult.textContent = '';
  const formData = new FormData(submitFeedbackForm);
  formData.append('submitterEmail', currentUserEmail);
  formData.append('submitterName', currentUserEmail);

  try {
    const response = await fetch('/api/feedback', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const problem = await response.json();
      throw new Error(problem.error || 'Submit failed');
    }

    submitResult.textContent = 'Feedback submitted successfully.';
    submitFeedbackForm.reset();
    await loadDashboard();
    await loadFeedback();
  } catch (error) {
    submitResult.textContent = `Error: ${error.message}`;
  }
});

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || response.statusText);
  }
  return response.json();
}

function renderDashboard(data) {
  dashboardCards.innerHTML = '';
  const cards = [
    { title: 'Total feedback', value: data.total },
    { title: 'Active items', value: data.active },
    { title: 'In progress', value: data.inProgress }
  ];

  cards.forEach((card) => {
    const element = document.createElement('div');
    element.className = 'card';
    element.innerHTML = `<h3>${card.title}</h3><p>${card.value}</p>`;
    dashboardCards.appendChild(element);
  });

  const statusCard = document.createElement('div');
  statusCard.className = 'card';
  statusCard.innerHTML = `
    <h3>Status counts</h3>
    <ul>${data.statusCounts.map((item) => `<li>${item.status}: ${item.count}</li>`).join('')}</ul>
  `;
  dashboardCards.appendChild(statusCard);

  const teamsCard = document.createElement('div');
  teamsCard.className = 'card';
  teamsCard.innerHTML = `
    <h3>Teams with items</h3>
    <ul>${data.teamPerformance.map((item) => `<li>${item.team}: ${item.count}</li>`).join('')}</ul>
  `;
  dashboardCards.appendChild(teamsCard);
}

async function loadDashboard() {
  const data = await fetchJson('/api/dashboard');
  renderDashboard(data);
}

let statusChartInstance = null;
let dueDateChartInstance = null;

function renderReportingPanels() {
  if (!feedbackItems.length) {
    reportSummary.innerHTML = '<p>No feedback data available for reporting.</p>';
    if (statusChartInstance) {
      statusChartInstance.destroy();
      statusChartInstance = null;
    }
    if (dueDateChartInstance) {
      dueDateChartInstance.destroy();
      dueDateChartInstance = null;
    }
    return;
  }

  const statusCounts = statusValues.map((status) => feedbackItems.filter((item) => item.status === status).length);
  const dueSoon = feedbackItems.filter((item) => {
    return item.dueDateNextAction && new Date(item.dueDateNextAction) <= new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  }).length;
  const overdue = feedbackItems.filter((item) => {
    return item.dueDateNextAction && new Date(item.dueDateNextAction) < new Date();
  }).length;
  const withoutDueDate = feedbackItems.filter((item) => !item.dueDateNextAction).length;
  const ownerGroups = [...new Set(feedbackItems.filter((item) => item.actionOwner).map((item) => item.actionOwner))].length;
  const unassigned = feedbackItems.filter((item) => !item.actionOwner).length;

  if (statusChartInstance) {
    statusChartInstance.destroy();
  }
  statusChartInstance = new Chart(statusChartCanvas, {
    type: 'doughnut',
    data: {
      labels: statusValues,
      datasets: [{
        data: statusCounts,
        backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#6366f1', '#ef4444'],
        borderWidth: 0
      }]
    },
    options: {
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: { label: (context) => `${context.label}: ${context.parsed}` } }
      },
      maintainAspectRatio: false
    }
  });

  if (dueDateChartInstance) {
    dueDateChartInstance.destroy();
  }
  dueDateChartInstance = new Chart(dueDateChartCanvas, {
    type: 'bar',
    data: {
      labels: ['Overdue', 'Due Soon', 'Without Due Date'],
      datasets: [{
        label: 'Feedback count',
        data: [overdue, dueSoon, withoutDueDate],
        backgroundColor: ['#dc2626', '#f59e0b', '#6b7280']
      }]
    },
    options: {
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 }
        }
      },
      maintainAspectRatio: false
    }
  });

  reportSummary.innerHTML = `
    <div class="card"><h4>Unassigned items</h4><p>${unassigned} feedback items need an owner.</p></div>
    <div class="card"><h4>Open actions</h4><p>${feedbackItems.filter((item) => item.status === 'Accepted' || item.status === 'In Progress').length} are actively being worked.</p></div>
    <div class="card"><h4>Action owner distribution</h4><p>${ownerGroups} distinct owners assigned.</p></div>
  `;
}

function renderFilterOptions() {
  statusFilter.innerHTML = '<option value="all">All</option>' + statusValues.map((status) => `<option value="${status}">${status}</option>`).join('');
}

function renderManagerTable(items) {
  managerListView.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.className = 'table-wrapper';
  const table = document.createElement('table');
  const header = document.createElement('thead');
  header.innerHTML = `
    <tr>
      <th>ID</th>
      <th>Short description</th>
      <th>Status</th>
      <th>Type</th>
      <th>Team</th>
      <th>Owner</th>
      <th>Due next</th>
      <th>Actions</th>
    </tr>
  `;
  table.appendChild(header);
  const body = document.createElement('tbody');

  items.forEach((item) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.id}</td>
      <td class="truncate" title="${item.shortDescription}">${item.shortDescription}</td>
      <td>${item.status}</td>
      <td>${item.feedbackType}</td>
      <td>${item.teamOwner || '-'}</td>
      <td>${item.actionOwner || '-'}</td>
      <td>${item.dueDateNextAction || '-'}</td>
      <td><button data-id="${item.id}">Open</button></td>
    `;
    body.appendChild(row);
  });

  table.appendChild(body);
  wrapper.appendChild(table);
  managerListView.appendChild(wrapper);
  managerListView.querySelectorAll('button[data-id]').forEach((button) => {
    button.addEventListener('click', () => showFeedbackDetail(button.dataset.id));
  });
}

function renderKanbanBoard(items) {
  managerKanbanView.innerHTML = '';
  const statuses = ['New', 'Accepted', 'In Progress', 'Complete', 'Declined'];

  statuses.forEach((status) => {
    const column = document.createElement('div');
    column.className = 'kanban-column';
    column.innerHTML = `<h3>${status}</h3>`;
    const columnItems = items.filter((item) => item.status === status);

    if (!columnItems.length) {
      const emptyState = document.createElement('p');
      emptyState.textContent = 'No items in this column yet.';
      emptyState.style.color = '#6b7280';
      column.appendChild(emptyState);
    }

    columnItems.forEach((item) => column.appendChild(createKanbanCard(item)));
    managerKanbanView.appendChild(column);
  });
}

function createKanbanCard(item) {
  const card = document.createElement('div');
  card.className = 'kanban-card';
  card.dataset.feedbackId = item.id;
  card.innerHTML = `
    <div class="kanban-card-header">
      <h4>${item.shortDescription}</h4>
      <span class="tag">${item.feedbackType || 'Feedback'}</span>
    </div>
    <div class="card-meta">
      <div><strong>ID:</strong> ${item.id}</div>
      <div><strong>Team:</strong> ${item.teamOwner || 'Unassigned'}</div>
      <div><strong>Owner:</strong> ${item.actionOwner || 'Unassigned'}</div>
      <div><strong>Due:</strong> ${item.dueDateNextAction || 'None'}</div>
    </div>
    <div class="inline-field">
      <label>Status<select data-id="${item.id}" class="card-status-select">
        ${statusValues.map((status) => `<option value="${status}" ${item.status === status ? 'selected' : ''}>${status}</option>`).join('')}
      </select></label>
    </div>
    <div class="inline-field">
      <label>Owner email<input type="email" value="${item.actionOwner || ''}" data-id="${item.id}" class="card-owner-input" placeholder="owner@example.com" /></label>
    </div>
    <div class="card-actions">
      <button type="button" class="card-detail-button" data-id="${item.id}">Details</button>
    </div>
  `;

  const statusSelect = card.querySelector('.card-status-select');
  const ownerInput = card.querySelector('.card-owner-input');
  const detailsButton = card.querySelector('.card-detail-button');

  statusSelect.addEventListener('change', async () => {
    await updateFeedbackField(item.id, { status: statusSelect.value });
  });

  ownerInput.addEventListener('change', async () => {
    await updateFeedbackField(item.id, { actionOwner: ownerInput.value.trim() });
  });

  detailsButton.addEventListener('click', () => showFeedbackDetail(item.id));
  return card;
}

async function updateFeedbackField(feedbackId, updates) {
  try {
    await fetchJson(`/api/feedback/${feedbackId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...updates, userEmail: currentUserEmail })
    });
    await loadDashboard();
    await loadFeedback();
  } catch (error) {
    console.error('Unable to update feedback:', error);
  }
}

function setManagerViewMode(mode) {
  managerViewMode = mode;
  viewSwitchButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.view === mode);
  });
  managerListView.classList.toggle('hidden', mode !== 'table');
  managerKanbanView.classList.toggle('hidden', mode !== 'kanban');
  applyStatusFilter();
}

function setManagerPane(pane) {
  managerPane = pane;
  paneSwitchButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.pane === pane);
  });
  managerItemsPane.classList.toggle('hidden', pane !== 'items');
  managerReportingPane.classList.toggle('hidden', pane !== 'reporting');
  if (pane === 'reporting') {
    renderReportingPanels();
  }
}

async function loadFeedback() {
  feedbackItems = await fetchJson('/api/feedback');
  applyStatusFilter();
}

function applyStatusFilter() {
  const filter = statusFilter.value;
  const items = filter === 'all' ? feedbackItems : feedbackItems.filter((item) => item.status === filter);
  renderManagerTable(items);
  renderKanbanBoard(items);
  if (managerPane === 'reporting') {
    renderReportingPanels();
  }
}

statusFilter.addEventListener('change', applyStatusFilter);

viewSwitchButtons.forEach((button) => {
  button.addEventListener('click', () => setManagerViewMode(button.dataset.view));
});

paneSwitchButtons.forEach((button) => {
  button.addEventListener('click', () => setManagerPane(button.dataset.pane));
});

setManagerViewMode(managerViewMode);
setManagerPane(managerPane);

async function showFeedbackDetail(feedbackId) {
  const payload = await fetchJson(`/api/feedback/${feedbackId}`);
  const { feedback, actions, history, attachments } = payload;
  feedbackDetail.classList.remove('hidden');
  feedbackDetail.innerHTML = `
    <div class="detail-modal-card">
      <button class="close-modal" id="closeFeedbackModal">×</button>
      <h3>Feedback ${feedback.id}</h3>
      <div class="detail-modal-grid">
        <div class="detail-modal-section">
          <form id="feedbackUpdateForm">
            <label>Description<textarea disabled rows="5">${feedback.longDescription || ''}</textarea></label>
            <label>Feedback Status<select name="status">${statusValues.map((status) => `<option value="${status}" ${feedback.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select></label>
            <label>Type of Feedback<input type="text" name="feedbackType" value="${feedback.feedbackType || ''}" /></label>
            <label>Team owning the feedback item's execution<input type="text" name="teamOwner" value="${feedback.teamOwner || ''}" /></label>
            <label>Action owner<input type="email" name="actionOwner" value="${feedback.actionOwner || ''}" placeholder="owner@example.com" /></label>
            <label>Planned date to complete activities on the feedback<input type="date" name="dueDateCompletion" value="${feedback.dueDateCompletion || ''}" /></label>
            <label>Triage Decision<select name="triageDecision"><option value="Pending" ${feedback.triageDecision === 'Pending' ? 'selected' : ''}>Pending</option><option value="Accepted" ${feedback.triageDecision === 'Accepted' ? 'selected' : ''}>Accepted</option><option value="Declined" ${feedback.triageDecision === 'Declined' ? 'selected' : ''}>Declined</option></select></label>
            <label>Triage Comment<textarea name="triageComment">${feedback.triageComment || ''}</textarea></label>
            <button type="submit">Save updates</button>
          </form>

          <h4 class="mt-20">Status Updates</h4>
          <p class="status-updates-note">Type a single update in the top blank line. When you leave the field, the note is saved and prepended with your date and email.</p>
          <label>Status Updates<textarea id="statusUpdatesInput" class="status-updates-textarea" placeholder="Click here, type an update, and click away to save."></textarea></label>
        </div>

        <div class="detail-modal-section">
          <div class="action-plans-header">
            <h4>Actions planned</h4>
            <button type="button" id="addNewActionButton" class="secondary-button">Add New Action</button>
          </div>
          <div id="actionPlanList">
            ${actions.length ? actions.map((action) => `
              <div class="action-plan-card">
                <div><strong>Action Description</strong></div>
                <div>${action.title}</div>
                <div><strong>Action Owner</strong></div>
                <div>${action.owner || 'Unassigned'}</div>
                <div><strong>Due Date</strong></div>
                <div>${action.dueDate || 'None'}</div>
              </div>
            `).join('') : '<p>No actions planned yet.</p>'}
          </div>
          <div id="newActionFormContainer"></div>
        </div>
      </div>

      <div class="detail-modal-section history-section">
        <h4>History</h4>
        <ul class="preview-list">
          ${history.map((entry) => `<li>${new Date(entry.createdAt).toLocaleString()}: <strong>${entry.eventType}</strong> by ${entry.userName || 'unknown'} - ${entry.note}</li>`).join('') || '<li>No history yet</li>'}
        </ul>
      </div>
    </div>
  `;

  const closeModalButton = document.getElementById('closeFeedbackModal');
  closeModalButton.addEventListener('click', () => {
    feedbackDetail.classList.add('hidden');
  });

  feedbackDetail.addEventListener('click', (event) => {
    if (event.target === feedbackDetail) {
      feedbackDetail.classList.add('hidden');
    }
  });

  const updateForm = document.getElementById('feedbackUpdateForm');
  const statusUpdatesInput = document.getElementById('statusUpdatesInput');

  function formatDateDMY(date) {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}.${m}.${y}`;
  }

  function loadStatusUpdates() {
    const existingLines = feedback.nextActions ? feedback.nextActions.split('\n').filter((line) => line.trim() !== '') : [];
    statusUpdatesInput.value = '\n' + existingLines.join('\n');
  }

  async function saveStatusUpdate() {
    const lines = statusUpdatesInput.value.split('\n');
    const firstLineText = lines[0].trim();
    if (!firstLineText) {
      return;
    }

    const existingLines = lines.slice(1).filter((line) => line.trim() !== '');
    const formatted = `${formatDateDMY(new Date())} ${currentUserEmail} - "${firstLineText}"`;
    const updatedNextActions = [formatted, ...existingLines].join('\n');

    await fetchJson(`/api/feedback/${feedback.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nextActions: updatedNextActions, userEmail: currentUserEmail })
    });

    statusUpdatesInput.value = '\n' + updatedNextActions;
  }

  updateForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(updateForm).entries());
    data.userEmail = currentUserEmail;
    await fetchJson(`/api/feedback/${feedback.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    await loadDashboard();
    await loadFeedback();
    showFeedbackDetail(feedback.id);
  });

  loadStatusUpdates();
  statusUpdatesInput.addEventListener('blur', saveStatusUpdate);

  const actionPlanList = document.getElementById('actionPlanList');
  const newActionFormContainer = document.getElementById('newActionFormContainer');
  const addNewActionButton = document.getElementById('addNewActionButton');

  function renderActionCards(actions) {
    actionPlanList.innerHTML = actions.length ? actions.map((action) => `
      <div class="action-plan-card">
        <div><strong>Action Description</strong></div>
        <div>${action.title}</div>
        <div><strong>Action Owner</strong></div>
        <div>${action.owner || 'Unassigned'}</div>
        <div><strong>Due Date</strong></div>
        <div>${action.dueDate || 'None'}</div>
      </div>
    `).join('') : '<p>No actions planned yet.</p>';
  }

  function renderNewActionForm() {
    newActionFormContainer.innerHTML = `
      <form id="newActionForm">
        <label>Action Description<input type="text" name="title" required /></label>
        <label>Action Owner<input type="email" name="owner" placeholder="owner@example.com" required /></label>
        <label>Due Date<input type="date" name="dueDate" /></label>
        <button type="submit">Save action</button>
      </form>
    `;

    const newActionForm = document.getElementById('newActionForm');
    newActionForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(newActionForm);
      const data = Object.fromEntries(formData.entries());
      data.createdBy = currentUserEmail;
      data.userEmail = currentUserEmail;
      await fetchJson(`/api/feedback/${feedback.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      await showFeedbackDetail(feedback.id);
      await loadDashboard();
    });
  }

  addNewActionButton.addEventListener('click', () => {
    renderNewActionForm();
  });

  renderActionCards(actions);
}

async function loadOwnerActionsList() {
  const ownerEmail = ownerEmailInput.value.trim().toLowerCase();
  if (!ownerEmail) {
    ownerActions.innerHTML = '<p>Please enter an owner email to see assigned actions.</p>';
    return;
  }

  const actions = await fetchJson(`/api/actions/owner/${encodeURIComponent(ownerEmail)}`);
  ownerActions.innerHTML = '';
  if (!actions.length) {
    ownerActions.innerHTML = '<p>No actions found for this owner.</p>';
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr><th>ID</th><th>Feedback</th><th>Title</th><th>Status</th><th>Due</th><th>Result</th><th>Update</th></tr>
        </thead>
        <tbody>
          ${actions.map((action) => `
            <tr>
              <td>${action.id}</td>
              <td>${action.shortDescription}</td>
              <td>${action.title}</td>
              <td>${action.status}</td>
              <td>${action.dueDate || '-'}</td>
              <td class="truncate" title="${action.result || ''}">${action.result || '-'}</td>
              <td><button data-action-id="${action.id}">Update</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
  ownerActions.appendChild(wrapper);

  ownerActions.querySelectorAll('button[data-action-id]').forEach((button) => {
    button.addEventListener('click', () => openActionUpdateDialog(button.dataset.actionId, actions.find((item) => item.id === Number(button.dataset.actionId))));
  });
}

function openActionUpdateDialog(actionId, action) {
  const dialog = document.createElement('div');
  dialog.className = 'panel';
  dialog.innerHTML = `
    <h4>Update action ${actionId}</h4>
    <form id="actionUpdateForm">
      <label>Title<input type="text" name="title" value="${action.title}" required /></label>
      <label>Details<textarea name="details">${action.details || ''}</textarea></label>
      <label>Status<select name="status"><option value="Pending" ${action.status === 'Pending' ? 'selected' : ''}>Pending</option><option value="In Progress" ${action.status === 'In Progress' ? 'selected' : ''}>In Progress</option><option value="Complete" ${action.status === 'Complete' ? 'selected' : ''}>Complete</option></select></label>
      <label>Result<textarea name="result">${action.result || ''}</textarea></label>
      <label>Due date<input type="date" name="dueDate" value="${action.dueDate || ''}" /></label>
      <button type="submit">Save action</button>
      <button type="button" id="closeDialog">Cancel</button>
    </form>
  `;
  ownerActions.prepend(dialog);

  const form = document.getElementById('actionUpdateForm');
  const closeButton = document.getElementById('closeDialog');
  closeButton.addEventListener('click', () => dialog.remove());

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    data.updatedBy = currentUserEmail;
    data.userEmail = currentUserEmail;
    await fetchJson(`/api/actions/${actionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    dialog.remove();
    await loadOwnerActionsList();
  });
}

loadCurrentUser();
renderFilterOptions();
showRole(roleSelect.value);
loadOwnerActions.addEventListener('click', loadOwnerActionsList);
