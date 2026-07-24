const roleSelect = document.getElementById('roleSelect');
const submitterSection = document.getElementById('submitterSection');
const managerSection = document.getElementById('managerSection');
const ownerSection = document.getElementById('ownerSection');
const submitFeedbackForm = document.getElementById('submitFeedbackForm');
const submitResult = document.getElementById('submitResult');
const dashboardCards = document.getElementById('dashboardCards');
const managerTable = document.getElementById('managerTable');
const statusFilter = document.getElementById('statusFilter');
const feedbackDetail = document.getElementById('feedbackDetail');
const ownerNameInput = document.getElementById('ownerName');
const loadOwnerActions = document.getElementById('loadOwnerActions');
const ownerActions = document.getElementById('ownerActions');

let feedbackItems = [];
let statusValues = ['New', 'Accepted', 'In Progress', 'Complete', 'Declined'];

function showRole(role) {
  submitterSection.classList.toggle('hidden', role !== 'submitter');
  managerSection.classList.toggle('hidden', role !== 'manager');
  ownerSection.classList.toggle('hidden', role !== 'owner');
}

roleSelect.addEventListener('change', () => showRole(roleSelect.value));

submitFeedbackForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  submitResult.textContent = '';
  const formData = new FormData(submitFeedbackForm);

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

async function fetchJson(url, options) {
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

function renderFilterOptions() {
  statusFilter.innerHTML = '<option value="all">All</option>' + statusValues.map((status) => `<option value="${status}">${status}</option>`).join('');
}

function renderManagerTable(items) {
  managerTable.innerHTML = '';
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
      <td>${item.teamOwner}</td>
      <td>${item.actionOwner}</td>
      <td>${item.dueDateNextAction || '-'}</td>
      <td><button data-id="${item.id}">View</button></td>
    `;
    body.appendChild(row);
  });

  table.appendChild(body);
  wrapper.appendChild(table);
  managerTable.appendChild(wrapper);
  managerTable.querySelectorAll('button[data-id]').forEach((button) => {
    button.addEventListener('click', () => showFeedbackDetail(button.dataset.id));
  });
}

async function loadFeedback() {
  feedbackItems = await fetchJson('/api/feedback');
  renderManagerTable(feedbackItems);
}

function applyStatusFilter() {
  const filter = statusFilter.value;
  const items = filter === 'all' ? feedbackItems : feedbackItems.filter((item) => item.status === filter);
  renderManagerTable(items);
}

statusFilter.addEventListener('change', applyStatusFilter);

async function showFeedbackDetail(feedbackId) {
  const payload = await fetchJson(`/api/feedback/${feedbackId}`);
  const { feedback, actions, history, attachments } = payload;
  feedbackDetail.classList.remove('hidden');
  feedbackDetail.innerHTML = `
    <h3>Feedback ${feedback.id}</h3>
    <div><strong>Short description:</strong> ${feedback.shortDescription}</div>
    <div><strong>Long description:</strong> <pre>${feedback.longDescription}</pre></div>
    <div><strong>Submitter:</strong> ${feedback.submitterName}</div>
    <div><strong>Status:</strong> ${feedback.status}</div>
    <div><strong>Type:</strong> ${feedback.feedbackType}</div>
    <div><strong>Team ownership:</strong> ${feedback.teamOwner || '-'}</div>
    <div><strong>Action owner:</strong> ${feedback.actionOwner || '-'}</div>
    <div><strong>Product:</strong> ${feedback.productName || '-'}</div>
    <div><strong>Next action due:</strong> ${feedback.dueDateNextAction || '-'}</div>
    <div><strong>Completion due:</strong> ${feedback.dueDateCompletion || '-'}</div>
    <div><strong>Next action summary:</strong> ${feedback.nextActions || '-'}</div>
    <div><strong>Triage decision:</strong> ${feedback.triageDecision}</div>
    <div><strong>Triage comment:</strong> ${feedback.triageComment || '-'}</div>
    <div><strong>Attachments:</strong>
      <ul class="preview-list">
        ${attachments.map((attach) => `<li><a href="${attach.url}" target="_blank">${attach.originalName}</a></li>`).join('') || '<li>No attachments</li>'}
      </ul>
    </div>
    <div class="detail-panel">
      <h4>Update feedback</h4>
      <form id="feedbackUpdateForm">
        <label>Status<select name="status">${statusValues.map((status) => `<option value="${status}" ${feedback.status === status ? 'selected' : ''}>${status}</option>`).join('')}</nselect></label>
        <label>Type<input type="text" name="feedbackType" value="${feedback.feedbackType || ''}" /></label>
        <label>Team owner<input type="text" name="teamOwner" value="${feedback.teamOwner || ''}" /></label>
        <label>Action owner<input type="text" name="actionOwner" value="${feedback.actionOwner || ''}" /></label>
        <label>Product name<input type="text" name="productName" value="${feedback.productName || ''}" /></label>
        <label>Next action due<input type="date" name="dueDateNextAction" value="${feedback.dueDateNextAction || ''}" /></label>
        <label>Completion due<input type="date" name="dueDateCompletion" value="${feedback.dueDateCompletion || ''}" /></label>
        <label>Next actions<textarea name="nextActions">${feedback.nextActions || ''}</textarea></label>
        <label>Triage decision<select name="triageDecision"><option value="Pending" ${feedback.triageDecision === 'Pending' ? 'selected' : ''}>Pending</option><option value="Accepted" ${feedback.triageDecision === 'Accepted' ? 'selected' : ''}>Accepted</option><option value="Declined" ${feedback.triageDecision === 'Declined' ? 'selected' : ''}>Declined</option></select></label>
        <label>Triage comment<textarea name="triageComment">${feedback.triageComment || ''}</textarea></label>
        <label>Manager name<input type="text" name="managerName" placeholder="Manager name" /></label>
        <button type="submit">Save updates</button>
      </form>
      <h4>Add an action</h4>
      <form id="actionAddForm">
        <label>Action title<input type="text" name="title" required /></label>
        <label>Details<textarea name="details"></textarea></label>
        <label>Owner<input type="text" name="owner" /></label>
        <label>Due date<input type="date" name="dueDate" /></label>
        <label>Status<select name="status"><option value="Pending">Pending</option><option value="In Progress">In Progress</option><option value="Complete">Complete</option></select></label>
        <label>Created by<input type="text" name="createdBy" placeholder="Your name" /></label>
        <button type="submit">Add action</button>
      </form>
      <h4>Actions</h4>
      <ul class="preview-list">
        ${actions.map((action) => `<li><strong>${action.title}</strong> [${action.status}] assigned to ${action.owner || 'unassigned'} - due ${action.dueDate || 'none'}. Result: ${action.result || 'TBD'}</li>`).join('') || '<li>No actions yet</li>'}
      </ul>
      <h4>History</h4>
      <ul class="preview-list">
        ${history.map((entry) => `<li>${new Date(entry.createdAt).toLocaleString()}: <strong>${entry.eventType}</strong> by ${entry.userName || 'unknown'} - ${entry.note}</li>`).join('') || '<li>No history yet</li>'}
      </ul>
    </div>
  `;

  const updateForm = document.getElementById('feedbackUpdateForm');
  const actionAddForm = document.getElementById('actionAddForm');

  updateForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(updateForm).entries());
    await fetchJson(`/api/feedback/${feedback.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    await loadDashboard();
    await loadFeedback();
    showFeedbackDetail(feedback.id);
  });

  actionAddForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(actionAddForm).entries());
    await fetchJson(`/api/feedback/${feedback.id}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    await showFeedbackDetail(feedback.id);
    await loadDashboard();
  });
}

async function loadOwnerActionsList() {
  const ownerName = ownerNameInput.value.trim();
  if (!ownerName) {
    ownerActions.innerHTML = '<p>Please enter your name to see assigned actions.</p>';
    return;
  }

  const actions = await fetchJson(`/api/actions/owner/${encodeURIComponent(ownerName)}`);
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
      <label>Updated by<input type="text" name="updatedBy" value="${ownerNameInput.value.trim()}" /></label>
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
    await fetchJson(`/api/actions/${actionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    dialog.remove();
    await loadOwnerActionsList();
  });
}

loadDashboard();
loadFeedback();
renderFilterOptions();
showRole(roleSelect.value);
loadOwnerActions.addEventListener('click', loadOwnerActionsList);
