// The launcher page. Talks to main.js through window.kiosk (see preload.js).

const $ = (selector) => document.querySelector(selector);

const urlInput = $('#url');
const launchButton = $('#launch');
const urlError = $('#url-error');
const extensionError = $('#extension-error');
const list = $('#extension-list');
const card = $('#extensions-card');
const rowTemplate = $('#extension-row');

let state;

// --- Render -------------------------------------------------------------------

function render(newState) {
  state = newState;
  $('#version').textContent = 'v' + state.version;
  $('#dev-notice').hidden = !state.isDev;
  if (document.activeElement !== urlInput) urlInput.value = state.settings.url;

  $('#url-hint').textContent = state.exitShortcut
    ? `Press ${state.exitShortcut} in the kiosk to come back here.`
    : 'No exit shortcut is set in config.js — the kiosk can only be left by quitting the app.';

  for (const input of document.querySelectorAll('[data-setting]')) {
    const value = state.settings[input.dataset.setting];
    if (input.type === 'checkbox') input.checked = Boolean(value);
    else if (document.activeElement !== input) {
      input.value = 'percent' in input.dataset ? Math.round(value * 100) : value;
    }
  }

  renderExtensions();
}

function renderExtensions() {
  list.replaceChildren();
  for (const ext of state.extensions) {
    const row = rowTemplate.content.firstElementChild.cloneNode(true);
    const toggle = row.querySelector('.switch input');
    toggle.checked = ext.enabled;
    toggle.addEventListener('change', async () => {
      render(await window.kiosk.setExtensionEnabled(ext.id, toggle.checked));
    });

    row.classList.toggle('disabled', !ext.enabled);
    row.querySelector('.name').textContent = ext.name;
    row.querySelector('.meta').textContent = [ext.version && 'v' + ext.version, ext.builtIn && 'built-in']
      .filter(Boolean)
      .join(' · ');
    row.querySelector('.description').textContent = ext.description;
    row.querySelector('.error').textContent = ext.error || '';

    row.querySelector('.show').addEventListener('click', () => window.kiosk.showExtension(ext.id));
    const remove = row.querySelector('.remove');
    if (ext.builtIn) remove.remove();
    else
      remove.addEventListener('click', async () => {
        render(await window.kiosk.removeExtension(ext.id));
      });

    list.append(row);
  }
  card.classList.toggle('empty', state.extensions.length === 0);
}

function showErrors(element, errors) {
  element.textContent = errors.join('\n');
  element.hidden = errors.length === 0;
}

// --- Launch -------------------------------------------------------------------

$('#launch-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  launchButton.disabled = true;
  const result = await window.kiosk.launch(urlInput.value);
  launchButton.disabled = false;
  showErrors(urlError, result.error ? [result.error] : []);
  if (result.url) urlInput.value = result.url;
});

urlInput.addEventListener('input', () => showErrors(urlError, []));

// --- Extensions: drop & add ------------------------------------------------------

// Never let a drop open the file in this window
for (const type of ['dragover', 'drop']) {
  document.addEventListener(type, (event) => event.preventDefault());
}

let dragDepth = 0;
card.addEventListener('dragenter', () => {
  dragDepth++;
  card.classList.add('dragging');
});
card.addEventListener('dragleave', () => {
  if (--dragDepth === 0) card.classList.remove('dragging');
});
card.addEventListener('drop', async (event) => {
  dragDepth = 0;
  card.classList.remove('dragging');
  if (!event.dataTransfer.files.length) return;
  card.classList.add('busy');
  const result = await window.kiosk.addExtensions(event.dataTransfer.files);
  card.classList.remove('busy');
  render(result);
  showErrors(extensionError, result.errors);
});

$('#add-extension').addEventListener('click', async () => {
  const result = await window.kiosk.chooseExtensions();
  render(result);
  showErrors(extensionError, result.errors);
});

// --- Options --------------------------------------------------------------------

for (const input of document.querySelectorAll('[data-setting]')) {
  input.addEventListener('change', async () => {
    let value;
    if (input.type === 'checkbox') value = input.checked;
    else {
      value = Math.max(Number(input.min) || 0, Number(input.value) || 0);
      if ('percent' in input.dataset) value = (value || 100) / 100;
    }
    render(await window.kiosk.saveSettings({ [input.dataset.setting]: value }));
  });
}

// --- Start ------------------------------------------------------------------------

window.kiosk.onState(render);
window.kiosk.getState().then((s) => {
  render(s);
  urlInput.focus();
  urlInput.select();
});
