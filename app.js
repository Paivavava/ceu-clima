/* =========================================================
   Céu — Previsão do tempo
   HTML + CSS + JavaScript puro · Open-Meteo (sem chave de API)
   ========================================================= */
'use strict';

/* ---------------- Configuração ---------------- */
const ENDPOINTS = {
  geocode: 'https://geocoding-api.open-meteo.com/v1/search',
  forecast: 'https://api.open-meteo.com/v1/forecast',
  air: 'https://air-quality-api.open-meteo.com/v1/air-quality',
};

const STORAGE = {
  place: 'ceu:place:v1',
  unit: 'ceu:unit:v1',
};

const DEFAULT_PLACE = {
  name: 'São Paulo',
  admin1: 'São Paulo',
  country: 'Brasil',
  country_code: 'BR',
  latitude: -23.5505,
  longitude: -46.6333,
};

const state = {
  unit: 'c',
  place: null,
  requestedPlace: null,
  data: null,
  controller: null,
  searchController: null,
  results: [],
  activeIndex: -1,
  query: '',
  searchTimer: null,
  searchSeq: 0,
};

/* ---------------- Atalhos DOM ---------------- */
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const els = {
  form: null,
  input: null,
  results: null,
  hint: null,
  geo: null,
  refresh: null,
  details: null,
  hourly: null,
  daily: null,
  hourBadge: null,
  dayBadge: null,
  aqi: null,
  toast: null,
};

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- Códigos do tempo (WMO) ---------------- */
const WMO = {
  0: { label: 'Céu limpo', icon: 'clear' },
  1: { label: 'Predominantemente limpo', icon: 'partly' },
  2: { label: 'Parcialmente nublado', icon: 'partly' },
  3: { label: 'Nublado', icon: 'cloudy' },
  45: { label: 'Nevoeiro', icon: 'fog' },
  48: { label: 'Nevoeiro com geada', icon: 'fog' },
  51: { label: 'Garoa leve', icon: 'rain' },
  53: { label: 'Garoa moderada', icon: 'rain' },
  55: { label: 'Garoa intensa', icon: 'rain' },
  56: { label: 'Garoa congelante', icon: 'rain' },
  57: { label: 'Garoa congelante intensa', icon: 'rain' },
  61: { label: 'Chuva leve', icon: 'rain' },
  63: { label: 'Chuva moderada', icon: 'rain' },
  65: { label: 'Chuva forte', icon: 'rain' },
  66: { label: 'Chuva congelante', icon: 'rain' },
  67: { label: 'Chuva congelante forte', icon: 'rain' },
  71: { label: 'Neve leve', icon: 'snow' },
  73: { label: 'Neve moderada', icon: 'snow' },
  75: { label: 'Neve forte', icon: 'snow' },
  77: { label: 'Grãos de neve', icon: 'snow' },
  80: { label: 'Pancadas de chuva', icon: 'rain' },
  81: { label: 'Pancadas moderadas', icon: 'rain' },
  82: { label: 'Pancadas fortes', icon: 'rain' },
  85: { label: 'Pancadas de neve', icon: 'snow' },
  86: { label: 'Pancadas de neve forte', icon: 'snow' },
  95: { label: 'Tempestade', icon: 'thunder' },
  96: { label: 'Tempestade com granizo', icon: 'thunder' },
  99: { label: 'Tempestade com granizo forte', icon: 'thunder' },
};

const weatherInfo = (code) =>
  WMO[code] || { label: 'Condições variáveis', icon: 'cloudy' };

/* ---------------- Ícones de clima (SVG) ---------------- */
function sunRays(cx, cy, inner, outer) {
  return Array.from({ length: 8 }, (_, i) => {
    const angle = (i * Math.PI) / 4;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x1 = (cx + cos * inner).toFixed(2);
    const y1 = (cy + sin * inner).toFixed(2);
    const x2 = (cx + cos * outer).toFixed(2);
    const y2 = (cy + sin * outer).toFixed(2);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;
  }).join('');
}

function sun(cx, cy, r, withRays = true) {
  const rays = withRays
    ? `<g class="wi__rays" stroke="var(--icon-sun)" stroke-width="2.6" stroke-linecap="round">${sunRays(cx, cy, r + 5.6, r + 11.4)}</g>`
    : '';
  return `${rays}<circle class="wi__sun" cx="${cx}" cy="${cy}" r="${r}" fill="var(--icon-sun)" />`;
}

function moon(cx, cy, r) {
  return `
    <circle class="wi__moon" cx="${cx}" cy="${cy}" r="${r}" fill="var(--icon-moon)" />
    <circle cx="${cx - 4.5}" cy="${cy - 4.5}" r="${r * 0.2}" fill="#c7d5ee" opacity=".5" />
    <circle cx="${cx + 4.5}" cy="${cy + 3.5}" r="${r * 0.27}" fill="#c7d5ee" opacity=".35" />
    <circle cx="${cx + 2}" cy="${cy - 7}" r="${r * 0.12}" fill="#c7d5ee" opacity=".45" />`;
}

const cloudShape = `
  <g class="wi__cloud">
    <circle cx="24" cy="37" r="9" />
    <circle cx="34" cy="31" r="12" />
    <circle cx="45" cy="38" r="8" />
    <rect x="22" y="38" width="24" height="8" rx="4" />
  </g>`;

const cloudBackShape = `
  <g class="wi__cloud wi__cloud--back" transform="translate(11 -7) scale(.82)">
    <circle cx="24" cy="37" r="9" />
    <circle cx="34" cy="31" r="12" />
    <circle cx="45" cy="38" r="8" />
    <rect x="22" y="38" width="24" height="8" rx="4" />
  </g>`;

const starsSmall = `
  <path class="wi__star" style="animation-delay:-1s" d="M47 12l1.1 2.6 2.6 1.1-2.6 1.1L47 19.4l-1.1-2.6-2.6-1.1 2.6-1.1z" fill="#fff" />
  <circle class="wi__star" style="animation-delay:-2s" cx="55" cy="24" r="1.3" fill="#fff" />`;

function rainDrops() {
  return [24, 32, 40]
    .map(
      (x, i) =>
        `<path class="wi__drop" style="animation-delay:${i * 0.22}s" d="M${x} 50v5" stroke="var(--icon-rain)" stroke-width="2.8" stroke-linecap="round" fill="none" />`
    )
    .join('');
}

function drizzleDots() {
  return [25, 33, 41]
    .map(
      (x, i) =>
        `<circle class="wi__drop" style="animation-delay:${i * 0.2}s" cx="${x}" cy="53" r="1.7" fill="var(--icon-rain)" />`
    )
    .join('');
}

function snowFlakes() {
  return [24, 33, 42]
    .map(
      (x, i) => `
      <g class="wi__flake" style="animation-delay:${i * 0.45}s" stroke="var(--icon-snow)" stroke-width="1.7" stroke-linecap="round">
        <path d="M${x} 49.5v7M${x - 2.4} 51.3l4.8 3.9M${x + 2.4} 51.3l-4.8 3.9" />
      </g>`
    )
    .join('');
}

function iconMarkup(kind, isDay = true) {
  let inner = '';

  switch (kind) {
    case 'clear':
      inner = isDay
        ? sun(32, 32, 11.5)
        : `${moon(34, 31, 15)}${starsSmall}`;
      break;

    case 'partly':
      inner = `
        ${isDay ? sun(23, 23, 8.2) : moon(22, 22, 9.5)}
        <g transform="translate(8 10)">${cloudShape}</g>`;
      break;

    case 'cloudy':
      inner = `${cloudBackShape}${cloudShape}`;
      break;

    case 'fog':
      inner = `
        ${cloudShape}
        <g class="wi__fog" stroke="var(--icon-cloud-2)" stroke-width="2.6" stroke-linecap="round">
          <path d="M16 51h27" />
          <path d="M22 57h27" style="animation-delay:-1.2s" />
        </g>`;
      break;

    case 'rain':
      inner = `${cloudShape}${rainDrops()}`;
      break;

    case 'drizzle':
      inner = `${cloudShape}${drizzleDots()}`;
      break;

    case 'snow':
      inner = `${cloudShape}${snowFlakes()}`;
      break;

    case 'thunder':
      inner = `
        ${cloudShape}
        <path class="wi__bolt" d="M34 44l-8 13h6.2l-3 9 12.6-15h-6.4l4.4-7z" fill="var(--icon-bolt)" />`;
      break;

    default:
      inner = cloudShape;
  }

  const nightClass = !isDay && (kind === 'clear' || kind === 'partly') ? ' wi--night' : '';
  return `<svg class="wi wi--${kind}${nightClass}" viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">${inner}</svg>`;
}

/* ---------------- Ícones de detalhes (SVG) ---------------- */
const UI_ICONS = {
  thermometer: `<svg viewBox="0 0 24 24"><path d="M12.5 14.2V5.4a2 2 0 1 1 4 0v8.8a4.5 4.5 0 1 1-4 0Z"/><path d="M14.5 16.5v1.6" /></svg>`,
  droplet: `<svg viewBox="0 0 24 24"><path d="M12 3.5s5.5 5.4 5.5 9.6a5.5 5.5 0 0 1-11 0C6.5 8.9 12 3.5 12 3.5Z"/><path d="M9.4 13.4a2.6 2.6 0 0 0 2.6 2.6"/></svg>`,
  wind: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.3"/><path class="wind-arrow" d="M12 6.7 15.1 15 12 13.2 8.9 15z" fill="currentColor" stroke="none" style="transform:rotate(0deg)"/></svg>`,
  sun: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.8"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"/></svg>`,
  gauge: `<svg viewBox="0 0 24 24"><path d="M4 16.5a8.5 8.5 0 1 1 16 0"/><path d="M12 16.5 15 10"/><circle cx="12" cy="16.5" r="1.3" fill="currentColor" stroke="none"/><path d="M4.8 20h14.4"/></svg>`,
  umbrella: `<svg viewBox="0 0 24 24"><path d="M3.5 12a8.5 8.5 0 0 1 17 0c-1-.9-2.3-1.4-3.6-1.4-1.4 0-2.7.5-3.8 1.4-1-.9-2.3-1.4-3.7-1.4s-2.7.5-3.7 1.4c-1-.9-2.2-1.4-3.6-1.4" transform="translate(.6 1.6)"/><path d="M12 13v5.2a2.2 2.2 0 0 0 4.4 0"/></svg>`,
  sunrise: `<svg viewBox="0 0 24 24"><path d="M3.5 19h17"/><path d="M6.5 15.5a5.5 5.5 0 0 1 11 0"/><path d="M12 3.2v3.4M5.6 6.1l1.7 1.7M18.4 6.1l-1.7 1.7"/><path d="M9 22h6"/></svg>`,
  sunset: `<svg viewBox="0 0 24 24"><path d="M3.5 19h17"/><path d="M6.5 15.5a5.5 5.5 0 0 1 11 0"/><path d="M12 8.4V5M5.6 12.1l1.7-1.7M18.4 12.1l-1.7-1.7"/><path d="M9 22h6"/></svg>`,
  eye: `<svg viewBox="0 0 24 24"><path d="M2.5 12S6 6.4 12 6.4 21.5 12 21.5 12 18 17.6 12 17.6 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/></svg>`,
};

/* ---------------- Formatação ---------------- */
const toF = (c) => (c * 9) / 5 + 32;
const fromKmhToMph = (kmh) => kmh * 0.621371;

function convertTemp(celsius) {
  if (celsius == null || Number.isNaN(celsius)) return null;
  return state.unit === 'f' ? toF(celsius) : celsius;
}

function tempStr(celsius) {
  const value = convertTemp(celsius);
  if (value == null) return '—';
  const rounded = Object.is(Math.round(value), -0) ? 0 : Math.round(value);
  return `${rounded}°`;
}

function tempValue(celsius) {
  const value = convertTemp(celsius);
  if (value == null) return 0;
  const rounded = Math.round(value);
  return Object.is(rounded, -0) ? 0 : rounded;
}

function number(value, digits = 0) {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function timeFromISO(iso) {
  if (!iso) return '—';
  return iso.slice(11, 16);
}

const CARDINALS = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];

function cardinal(deg) {
  if (deg == null) return '—';
  return CARDINALS[Math.round(deg / 45) % 8];
}

function parseDate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function weekday(iso) {
  return parseDate(iso).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
}

function shortDate(iso) {
  const date = parseDate(iso);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function uvLabel(uv) {
  if (uv == null) return null;
  if (uv < 3) return { text: 'Baixo', level: 'low' };
  if (uv < 6) return { text: 'Moderado', level: 'moderate' };
  if (uv < 8) return { text: 'Alto', level: 'high' };
  if (uv < 11) return { text: 'Muito alto', level: 'very-high' };
  return { text: 'Extremo', level: 'extreme' };
}

function aqiInfo(aqi) {
  if (aqi <= 20) return { label: 'Bom', level: 'good' };
  if (aqi <= 40) return { label: 'Razoável', level: 'moderate' };
  if (aqi <= 60) return { label: 'Moderado', level: 'moderate' };
  if (aqi <= 80) return { label: 'Ruim', level: 'bad' };
  if (aqi <= 100) return { label: 'Muito ruim', level: 'worse' };
  return { label: 'Extremo', level: 'worse' };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function highlight(text, query) {
  const raw = String(text ?? '');
  const q = query.trim();
  const index = q ? raw.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (index < 0) return escapeHtml(raw);
  return `${escapeHtml(raw.slice(0, index))}<mark>${escapeHtml(raw.slice(index, index + q.length))}</mark>${escapeHtml(raw.slice(index + q.length))}`;
}

function placeRegion(place) {
  if (!place) return '';
  const parts = [];
  if (place.admin1 && place.admin1.toLowerCase() !== place.name.toLowerCase()) parts.push(place.admin1);
  if (place.country) parts.push(place.country);
  if (!parts.length) {
    return `${Number(place.latitude).toFixed(2)}°, ${Number(place.longitude).toFixed(2)}°`;
  }
  return parts.join(', ');
}

/* ---------------- Céu animado ---------------- */
function buildSky() {
  const isSmall = window.innerWidth < 640;
  const starsHost = $('#stars');
  const rainHost = $('#rain');
  const snowHost = $('#snow');
  if (!starsHost || !rainHost || !snowHost) return;

  const stars = [];
  const starCount = isSmall ? 50 : 90;
  for (let i = 0; i < starCount; i += 1) {
    const size = (Math.random() * 1.6 + 0.8).toFixed(1);
    stars.push(
      `<span class="star" style="left:${(Math.random() * 100).toFixed(2)}%;top:${(
        Math.random() * 62
      ).toFixed(2)}%;width:${size}px;height:${size}px;animation-delay:-${(
        Math.random() * 6
      ).toFixed(2)}s;animation-duration:${(Math.random() * 3 + 2.6).toFixed(2)}s"></span>`
    );
  }
  starsHost.innerHTML = stars.join('');

  const rain = [];
  const rainCount = isSmall ? 55 : 95;
  for (let i = 0; i < rainCount; i += 1) {
    rain.push(
      `<span style="left:${(Math.random() * 108 - 4).toFixed(2)}%;--dur:${(
        Math.random() * 0.55 + 0.7
      ).toFixed(2)}s;--delay:-${(Math.random() * 2.4).toFixed(2)}s;opacity:${(
        Math.random() * 0.5 + 0.35
      ).toFixed(2)}"></span>`
    );
  }
  rainHost.innerHTML = rain.join('');

  const snow = [];
  const snowCount = isSmall ? 32 : 55;
  for (let i = 0; i < snowCount; i += 1) {
    const size = (Math.random() * 4 + 3).toFixed(1);
    snow.push(
      `<span style="left:${(Math.random() * 100).toFixed(2)}%;--size:${size}px;--dur:${(
        Math.random() * 6 + 6
      ).toFixed(2)}s;--delay:-${(Math.random() * 12).toFixed(2)}s;opacity:${(
        Math.random() * 0.5 + 0.4
      ).toFixed(2)}"></span>`
    );
  }
  snowHost.innerHTML = snow.join('');
}

function applySky(code, isDay) {
  const kind = weatherInfo(code).icon;
  const group = kind === 'drizzle' ? 'rain' : kind;
  document.body.dataset.weather = group;
  document.body.dataset.day = isDay ? 'true' : 'false';
}

/* ---------------- Persistência ---------------- */
function savePlace(place) {
  try {
    localStorage.setItem(STORAGE.place, JSON.stringify(place));
  } catch {
    /* armazenamento indisponível */
  }
}

function readPlace() {
  try {
    const raw = localStorage.getItem(STORAGE.place);
    if (!raw) return null;
    const place = JSON.parse(raw);
    if (
      place &&
      typeof place.name === 'string' &&
      Number.isFinite(place.latitude) &&
      Number.isFinite(place.longitude)
    ) {
      return place;
    }
  } catch {
    /* ignora dados inválidos */
  }
  return null;
}

function saveUnit(unit) {
  try {
    localStorage.setItem(STORAGE.unit, unit);
  } catch {
    /* armazenamento indisponível */
  }
}

function readUnit() {
  try {
    return localStorage.getItem(STORAGE.unit) === 'f' ? 'f' : 'c';
  } catch {
    return 'c';
  }
}

/* ---------------- Busca de cidades ---------------- */
async function fetchPlaces(query, signal) {
  const url = `${ENDPOINTS.geocode}?name=${encodeURIComponent(query)}&count=7&language=pt&format=json`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Geocoding ${response.status}`);
  const data = await response.json();
  const results = Array.isArray(data.results) ? data.results : [];
  const seen = new Set();
  return results.filter((place) => {
    const key = [
      place.name,
      place.country_code,
      Number(place.latitude).toFixed(2),
      Number(place.longitude).toFixed(2),
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function runSearch(query) {
  const seq = ++state.searchSeq;
  state.searchController?.abort();
  const controller = new AbortController();
  state.searchController = controller;

  els.form.classList.add('is-searching');
  els.hint.textContent = 'Buscando cidades…';

  try {
    const places = await fetchPlaces(query, controller.signal);
    if (seq !== state.searchSeq || els.input.value.trim() !== query) return;
    state.query = query;
    renderResults(places, query);
    els.hint.textContent = places.length
      ? `${places.length} ${places.length === 1 ? 'cidade encontrada' : 'cidades encontradas'}.`
      : 'Nenhuma cidade encontrada.';
  } catch (error) {
    if (error.name === 'AbortError') return;
    if (seq !== state.searchSeq) return;
    closeResults();
    showToast('Não foi possível buscar cidades. Verifique sua conexão.');
  } finally {
    if (seq === state.searchSeq) els.form.classList.remove('is-searching');
  }
}

function renderResults(places, query) {
  state.results = places;
  state.activeIndex = -1;

  if (!places.length) {
    els.results.innerHTML = `
      <div class="result result--empty">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
        Nenhum lugar encontrado para “${escapeHtml(query)}”.
      </div>`;
    openResults();
    return;
  }

  els.results.innerHTML = places
    .map((place, index) => {
      const region = [
        place.admin1 && place.admin1.toLowerCase() !== place.name.toLowerCase() ? place.admin1 : null,
        place.country,
      ]
        .filter(Boolean)
        .join(', ');
      return `
        <button type="button" class="result" role="option" id="result-${index}" data-index="${index}" aria-selected="false">
          <span class="result__flag" aria-hidden="true">${escapeHtml((place.country_code || '··').toUpperCase())}</span>
          <span class="result__text">
            <span class="result__name">${highlight(place.name, query)}</span>
            <span class="result__region">${escapeHtml(region || 'Localização')}</span>
          </span>
          <svg class="result__go" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M12.5 5.5 19 12l-6.5 6.5"/></svg>
        </button>`;
    })
    .join('');

  openResults();
}

function openResults() {
  els.results.hidden = false;
  els.input.setAttribute('aria-expanded', 'true');
}

function closeResults() {
  els.results.hidden = true;
  els.input.setAttribute('aria-expanded', 'false');
  els.input.removeAttribute('aria-activedescendant');
  state.activeIndex = -1;
  $$('.result.is-active', els.results).forEach((item) => {
    item.classList.remove('is-active');
    item.setAttribute('aria-selected', 'false');
  });
}

function setActiveResult(index) {
  const options = $$('.result[data-index]', els.results);
  if (!options.length) return;
  let clamped = index;
  if (clamped < 0) clamped = options.length - 1;
  if (clamped >= options.length) clamped = 0;
  state.activeIndex = clamped;
  options.forEach((option, i) => {
    const active = i === clamped;
    option.classList.toggle('is-active', active);
    option.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  els.input.setAttribute('aria-activedescendant', `result-${clamped}`);
  options[clamped].scrollIntoView({ block: 'nearest' });
}

function choosePlace(place) {
  if (!place) return;
  clearTimeout(state.searchTimer);
  state.searchSeq += 1;
  state.searchController?.abort();
  els.form.classList.remove('is-searching');
  closeResults();
  els.input.value = '';
  els.input.blur();
  els.hint.textContent = `Carregando clima de ${place.name}.`;
  fetchWeather(place);
}

async function searchAndPick(query) {
  const seq = ++state.searchSeq;
  state.searchController?.abort();
  const controller = new AbortController();
  state.searchController = controller;
  els.form.classList.add('is-searching');
  els.hint.textContent = 'Buscando cidades…';

  try {
    const places = await fetchPlaces(query, controller.signal);
    if (seq !== state.searchSeq) return;
    if (!places.length) {
      showToast(`Nenhuma cidade encontrada para “${query}”.`);
      els.hint.textContent = 'Nenhuma cidade encontrada.';
      renderResults([], query);
      return;
    }
    choosePlace(places[0]);
  } catch (error) {
    if (error.name === 'AbortError') return;
    showToast('Não foi possível buscar cidades. Verifique sua conexão.');
  } finally {
    if (seq === state.searchSeq) els.form.classList.remove('is-searching');
  }
}

/* ---------------- Clima ---------------- */
async function fetchWeather(place) {
  if (!place) return;

  state.controller?.abort();
  state.requestedPlace = place;
  const controller = new AbortController();
  state.controller = controller;

  setBusy(true);

  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'is_day',
      'precipitation',
      'weather_code',
      'cloud_cover',
      'pressure_msl',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m',
      'dew_point_2m',
    ].join(','),
    hourly: ['temperature_2m', 'weather_code', 'precipitation_probability', 'is_day'].join(','),
    daily: [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'sunrise',
      'sunset',
      'uv_index_max',
      'precipitation_sum',
      'precipitation_probability_max',
      'wind_speed_10m_max',
    ].join(','),
    timezone: 'auto',
    forecast_days: '7',
    wind_speed_unit: 'kmh',
  });

  try {
    const response = await fetch(`${ENDPOINTS.forecast}?${params.toString()}`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Forecast ${response.status}`);
    const data = await response.json();
    if (!data.current || !data.daily || !data.hourly) throw new Error('Resposta incompleta');

    state.place = place;
    state.data = data;
    render();
    savePlace(place);
    loadAirQuality(place, controller);
  } catch (error) {
    if (error.name === 'AbortError') return;
    console.error(error);
    if (!state.data) renderLoadError();
    showToast('Não foi possível carregar a previsão agora. Tente novamente em instantes.');
  } finally {
    if (state.controller === controller) setBusy(false);
    els.geo.classList.remove('is-locating');
  }
}

async function loadAirQuality(place, controller) {
  const chip = els.aqi;
  chip.hidden = true;
  try {
    const params = new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      current: 'european_aqi,pm2_5',
      timezone: 'auto',
    });
    const response = await fetch(`${ENDPOINTS.air}?${params.toString()}`, {
      signal: controller.signal,
    });
    if (!response.ok) return;
    const data = await response.json();
    const aqi = data?.current?.european_aqi;
    if (aqi == null) return;
    const info = aqiInfo(aqi);
    chip.textContent = `Ar ${Math.round(aqi)} · ${info.label}`;
    chip.dataset.level = info.level;
    chip.title = data?.current?.pm2_5 != null
      ? `Material particulado (PM2,5): ${number(data.current.pm2_5, 1)} µg/m³`
      : 'Qualidade do ar';
    chip.hidden = false;
  } catch (error) {
    if (error.name !== 'AbortError') {
      /* qualidade do ar é um extra: falha silenciosa */
    }
  }
}

function setBusy(busy) {
  els.refresh.classList.toggle('is-spinning', busy);
  els.refresh.setAttribute('aria-busy', busy ? 'true' : 'false');
}

/* ---------------- Renderização ---------------- */
function render() {
  if (!state.data) return;
  renderNow();
  renderDetails();
  renderHourly();
  renderDaily();
  const current = state.data.current;
  document.title = `${state.place.name} · ${tempStr(current.temperature_2m)} · Céu`;
}

function renderNow() {
  const { current, daily, timezone_abbreviation, timezone } = state.data;
  const place = state.place;
  const isDay = current.is_day === 1;
  const info = weatherInfo(current.weather_code);

  applySky(current.weather_code, isDay);

  $('#place-name').textContent = place.name;
  $('#place-region').textContent = placeRegion(place);
  $('#now-icon').innerHTML = iconMarkup(info.icon, isDay);
  $('#now-desc').textContent = info.label;
  $('#now-high').textContent = tempStr(daily.temperature_2m_max?.[0]);
  $('#now-low').textContent = tempStr(daily.temperature_2m_min?.[0]);
  $('#now-feels').textContent = `Sensação térmica de ${tempStr(current.apparent_temperature)}`;
  animateTemp($('#now-temp'), tempValue(current.temperature_2m));
  $('#now-updated').textContent = `Atualizado às ${timeFromISO(current.time)}`;
  $('#now-tz').textContent = timezone_abbreviation || timezone || '—';
  els.hourBadge.textContent = `${tempStr(current.temperature_2m)} agora`;
}

function tileHTML({ icon, label, value, sub, arrow }) {
  return `
    <div class="tile">
      <span class="tile__icon" aria-hidden="true">${icon}</span>
      <span class="tile__body">
        <span class="tile__label">${escapeHtml(label)}</span>
        <span class="tile__value">${value}</span>
        ${sub ? `<span class="tile__sub">${escapeHtml(sub)}</span>` : ''}
      </span>
    </div>`;
}

function renderDetails() {
  const { current, daily } = state.data;
  const isF = state.unit === 'f';
  const speedUnit = isF ? 'mph' : 'km/h';
  const speed = (value) => (isF ? fromKmhToMph(value) : value);

  const uv = daily.uv_index_max?.[0];
  const uvInfo = uvLabel(uv);
  const windDirection = ((current.wind_direction_10m ?? 0) + 180) % 360;
  const windIcon = UI_ICONS.wind.replace(
    'style="transform:rotate(0deg)"',
    `style="transform:rotate(${windDirection}deg)"`
  );

  const tiles = [
    {
      icon: UI_ICONS.thermometer,
      label: 'Sensação térmica',
      value: `<strong>${tempStr(current.apparent_temperature)}</strong>`,
      sub: current.apparent_temperature >= current.temperature_2m ? 'Mais quente que a real' : 'Mais frio que a real',
    },
    {
      icon: UI_ICONS.droplet,
      label: 'Umidade',
      value: `${number(current.relative_humidity_2m)}<small>%</small>`,
      sub: `Orvalho em ${tempStr(current.dew_point_2m)}`,
    },
    {
      icon: windIcon,
      label: 'Vento',
      value: `${number(speed(current.wind_speed_10m))}<small>${speedUnit}</small>`,
      sub: `${cardinal(current.wind_direction_10m)} · rajadas de ${number(speed(current.wind_gusts_10m))} ${speedUnit}`,
    },
    {
      icon: UI_ICONS.sun,
      label: 'Índice UV',
      value: uv != null ? number(uv, 1) : '—',
      sub: uvInfo ? `${uvInfo.text} hoje` : 'Sem dados',
    },
    {
      icon: UI_ICONS.gauge,
      label: 'Pressão',
      value: `${number(current.pressure_msl)}<small>hPa</small>`,
      sub: 'Ao nível do mar',
    },
    {
      icon: UI_ICONS.umbrella,
      label: 'Chance de chuva',
      value: `${number(daily.precipitation_probability_max?.[0] ?? 0)}<small>%</small>`,
      sub: `Acumulado de ${number(daily.precipitation_sum?.[0] ?? 0, 1)} mm`,
    },
    {
      icon: UI_ICONS.sunrise,
      label: 'Nascer do sol',
      value: timeFromISO(daily.sunrise?.[0]),
      sub: 'Horário local',
    },
    {
      icon: UI_ICONS.sunset,
      label: 'Pôr do sol',
      value: timeFromISO(daily.sunset?.[0]),
      sub: 'Horário local',
    },
  ];

  els.details.innerHTML = tiles.map(tileHTML).join('');
}

function renderLoadError() {
  $('#place-name').textContent = 'Sem conexão';
  $('#place-region').textContent = 'Não foi possível carregar a previsão';
  $('#now-icon').innerHTML = iconMarkup('cloudy', true);
  $('#now-desc').textContent = 'Tente novamente em instantes';
  $('#now-high').textContent = '—';
  $('#now-low').textContent = '—';
  $('#now-feels').textContent = 'Verifique sua conexão com a internet';
  $('#now-temp').textContent = '—';
  $('#now-updated').textContent = 'Falha ao atualizar';
  $('#now-tz').textContent = '—';
  $('#hourly-badge').textContent = '—';
  $('#daily-badge').textContent = '—';
  els.aqi.hidden = true;
  els.details.innerHTML = `
    <div class="tile" style="grid-column:1 / -1;justify-content:center">
      <span class="tile__body" style="text-align:center">
        <span class="tile__value">Sem dados no momento</span>
        <span class="tile__sub">Use o botão de atualizar para tentar de novo</span>
      </span>
    </div>`;
  els.hourly.innerHTML = `<p class="panel__sub" style="padding:10px 4px">Não foi possível carregar as próximas horas.</p>`;
  els.daily.innerHTML = `<p class="panel__sub" style="padding:10px 4px">Não foi possível carregar os próximos dias.</p>`;
  updateHourNav();
}

function renderHourly() {
  const { current, hourly } = state.data;
  const currentKey = current.time.slice(0, 13);
  let start = hourly.time.findIndex((time) => time.slice(0, 13) >= currentKey);
  if (start < 0) start = 0;
  const end = Math.min(start + 24, hourly.time.length);
  const count = Math.max(0, end - start);

  if (!count) {
    els.hourly.innerHTML = `<p class="panel__sub" style="padding:12px">Sem dados para as próximas horas.</p>`;
    requestAnimationFrame(updateHourNav);
    return;
  }

  const items = [];
  for (let i = start; i < end; i += 1) {
    const isNow = i === start;
    const info = weatherInfo(hourly.weather_code?.[i]);
    const isDay = hourly.is_day?.[i] === 1;
    const hour = parseInt(hourly.time[i].slice(11, 13), 10);
    const label = isNow ? 'Agora' : `${hour}h`;
    const rain = hourly.precipitation_probability?.[i];
    items.push(`
      <div class="hour${isNow ? ' is-now' : ''}">
        <span class="hour__time">${label}</span>
        <span class="hour__icon weather-icon">${iconMarkup(info.icon, isDay)}</span>
        <span class="hour__temp">${tempStr(hourly.temperature_2m?.[i])}</span>
        <span class="hour__rain">${rain != null && rain >= 20 ? `${rain}%` : ''}</span>
      </div>`);
  }

  els.hourly.innerHTML = items.join('');
  requestAnimationFrame(updateHourNav);
}

function updateHourNav() {
  const nav = $('.panel__nav');
  const prev = $('#hour-prev');
  const next = $('#hour-next');
  if (!nav || !prev || !next || !els.hourly) return;
  const max = els.hourly.scrollWidth - els.hourly.clientWidth;
  nav.hidden = max <= 2;
  prev.disabled = els.hourly.scrollLeft <= 4;
  next.disabled = els.hourly.scrollLeft >= max - 4;
}

function renderDaily() {
  const { daily } = state.data;
  const days = daily.time?.length ?? 0;
  if (!days) {
    els.daily.innerHTML = `<p class="panel__sub" style="padding:12px">Sem dados para os próximos dias.</p>`;
    return;
  }

  const mins = daily.temperature_2m_min.map((v) => convertTemp(v) ?? 0);
  const maxs = daily.temperature_2m_max.map((v) => convertTemp(v) ?? 0);
  const weekMin = Math.min(...mins);
  const weekMax = Math.max(...maxs);
  const span = Math.max(weekMax - weekMin, 1);

  const rainyDays = (daily.precipitation_probability_max ?? []).filter(
    (chance) => chance != null && chance >= 50
  ).length;
  els.dayBadge.textContent = rainyDays
    ? `chuva em ${rainyDays} ${rainyDays === 1 ? 'dia' : 'dias'}`
    : 'sem chuva relevante';

  const rows = [];
  for (let i = 0; i < days; i += 1) {
    const info = weatherInfo(daily.weather_code?.[i]);
    const label = i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : weekday(daily.time[i]);
    const rain = daily.precipitation_probability_max?.[i];
    let from = ((mins[i] - weekMin) / span) * 100;
    let to = ((maxs[i] - weekMin) / span) * 100;
    const width = Math.max(to - from, 10);
    if (width > to - from) {
      from = Math.min(from, 100 - width);
      to = from + width;
    }

    rows.push(`
      <div class="day${i === 0 ? ' is-today' : ''}">
        <span class="day__name">
          ${label}
          <span class="day__date">${shortDate(daily.time[i])}</span>
          ${rain != null && rain >= 5 ? `<span class="day__rain"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 4s5 5.4 5 9a5 5 0 0 1-10 0c0-3.6 5-9 5-9Z"/></svg>${rain}%</span>` : ''}
        </span>
        <span class="day__icon weather-icon" aria-hidden="true">${iconMarkup(info.icon, true)}</span>
        <span class="day__bar" role="img" aria-label="Mínima de ${tempStr(daily.temperature_2m_min[i])} e máxima de ${tempStr(daily.temperature_2m_max[i])}">
          <span style="--from:${from.toFixed(1)}%;--to:${to.toFixed(1)}%"></span>
        </span>
        <span class="day__temps">
          <span class="day__max">${tempStr(daily.temperature_2m_max[i])}</span>
          <span class="day__min">${tempStr(daily.temperature_2m_min[i])}</span>
        </span>
      </div>`);
  }

  els.daily.innerHTML = rows.join('');
}

/* ---------------- Contador animado ---------------- */
let tempFrame = null;

function animateTemp(element, target) {
  if (!element) return;
  const previous = Number(element.dataset.value);
  const from = Number.isFinite(previous) ? previous : target;
  element.dataset.value = String(target);

  if (prefersReducedMotion() || from === target) {
    element.textContent = String(target);
    return;
  }

  cancelAnimationFrame(tempFrame);
  element.classList.remove('is-bumping');
  void element.offsetWidth;
  element.classList.add('is-bumping');

  const duration = 560;
  const startedAt = performance.now();

  const tick = (now) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = String(Math.round(from + (target - from) * eased));
    if (progress < 1) tempFrame = requestAnimationFrame(tick);
  };

  tempFrame = requestAnimationFrame(tick);
}

/* ---------------- Unidades ---------------- */
function setUnit(unit, persist = true) {
  state.unit = unit === 'f' ? 'f' : 'c';
  $$('.unit-toggle button').forEach((button) => {
    const active = button.dataset.unit === state.unit;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  if (persist) saveUnit(state.unit);
  if (state.data) render();
}

/* ---------------- Skeleton inicial ---------------- */
function renderSkeleton() {
  els.details.innerHTML = Array.from(
    { length: 8 },
    () => `
    <div class="tile tile--sk">
      <span class="sk sk-circle"></span>
      <span class="tile__body" style="flex:1">
        <span class="sk sk-line sk-line--short" style="margin-bottom:7px"></span>
        <span class="sk sk-line sk-line--wide"></span>
      </span>
    </div>`
  ).join('');

  els.hourly.innerHTML = Array.from(
    { length: 10 },
    () => `
    <div class="hour hour--sk">
      <span class="sk sk-line" style="width:26px"></span>
      <span class="sk sk-circle" style="border-radius:50%"></span>
      <span class="sk sk-line" style="width:22px"></span>
    </div>`
  ).join('');

  els.daily.innerHTML = Array.from(
    { length: 5 },
    () => `
    <div class="day day--sk">
      <span class="sk sk-line sk-line--wide"></span>
      <span class="sk sk-circle"></span>
      <span class="sk" style="height:5px;border-radius:99px"></span>
      <span class="sk sk-line"></span>
    </div>`
  ).join('');
}

/* ---------------- Toast ---------------- */
let toastTimer = null;

function showToast(message) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('is-visible'), 4400);
}

/* ---------------- Geolocalização ---------------- */
function useMyLocation() {
  if (!('geolocation' in navigator)) {
    showToast('Seu navegador não oferece geolocalização.');
    return;
  }
  if (!window.isSecureContext && location.hostname !== 'localhost') {
    showToast('A localização precisa de uma conexão segura (HTTPS).');
    return;
  }

  els.geo.classList.add('is-locating');
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const place = {
        name: 'Minha localização',
        admin1: '',
        country: '',
        country_code: '',
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      els.hint.textContent = 'Clima da sua localização atual.';
      fetchWeather(place);
    },
    (error) => {
      els.geo.classList.remove('is-locating');
      const messages = {
        1: 'Permissão de localização negada. Digite o nome de uma cidade.',
        2: 'Não foi possível determinar sua localização.',
        3: 'A localização demorou demais. Tente novamente.',
      };
      showToast(messages[error.code] || 'Não foi possível usar sua localização.');
    },
    { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 }
  );
}

/* ---------------- Eventos ---------------- */
function bindEvents() {
  els.form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearTimeout(state.searchTimer);
    if (state.activeIndex >= 0 && state.results[state.activeIndex]) {
      choosePlace(state.results[state.activeIndex]);
      return;
    }
    const query = els.input.value.trim();
    if (!query) {
      els.input.focus();
      showToast('Digite o nome de uma cidade para começar.');
      return;
    }
    if (state.results.length && state.query.toLowerCase() === query.toLowerCase()) {
      choosePlace(state.results[0]);
      return;
    }
    searchAndPick(query);
  });

  els.input.addEventListener('input', () => {
    const query = els.input.value.trim();
    state.query = '';
    clearTimeout(state.searchTimer);
    if (query.length < 2) {
      state.searchSeq += 1;
      state.searchController?.abort();
      els.form.classList.remove('is-searching');
      closeResults();
      els.hint.textContent = query.length === 1 ? 'Digite ao menos 2 letras.' : '';
      return;
    }
    state.searchTimer = setTimeout(() => runSearch(query), 300);
  });

  els.input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (els.results.hidden) {
        const query = els.input.value.trim();
        if (query.length >= 2) runSearch(query);
        return;
      }
      setActiveResult(state.activeIndex + 1);
    } else if (event.key === 'ArrowUp') {
      if (els.results.hidden) return;
      event.preventDefault();
      setActiveResult(state.activeIndex - 1);
    } else if (event.key === 'Enter') {
      if (!els.results.hidden && state.activeIndex >= 0) {
        event.preventDefault();
        choosePlace(state.results[state.activeIndex]);
      }
    } else if (event.key === 'Escape') {
      closeResults();
    }
  });

  els.results.addEventListener('click', (event) => {
    const option = event.target.closest('.result[data-index]');
    if (!option) return;
    const index = Number(option.dataset.index);
    choosePlace(state.results[index]);
  });

  els.results.addEventListener('mousedown', (event) => {
    if (event.target.closest('.result[data-index]')) event.preventDefault();
  });

  document.addEventListener('click', (event) => {
    if (!els.form.contains(event.target)) closeResults();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) {
      event.preventDefault();
      els.input.focus();
      els.input.select();
    }
  });

  els.geo.addEventListener('click', useMyLocation);

  const hourPrev = $('#hour-prev');
  const hourNext = $('#hour-next');
  hourPrev?.addEventListener('click', () => {
    els.hourly.scrollBy({ left: -352, behavior: 'smooth' });
  });
  hourNext?.addEventListener('click', () => {
    els.hourly.scrollBy({ left: 352, behavior: 'smooth' });
  });
  els.hourly.addEventListener('scroll', updateHourNav, { passive: true });
  window.addEventListener('resize', updateHourNav);

  els.refresh.addEventListener('click', () => {
    const target = state.requestedPlace || state.place;
    if (target) fetchWeather(target);
  });

  $$('.unit-toggle button').forEach((button) => {
    button.addEventListener('click', () => setUnit(button.dataset.unit));
  });

  window.addEventListener('offline', () => showToast('Você está sem conexão. Os dados podem estar desatualizados.'));
  window.addEventListener('online', () => {
    const target = state.requestedPlace || state.place;
    if (target) fetchWeather(target);
  });
}

/* ---------------- Inicialização ---------------- */
function init() {
  els.form = $('#search-form');
  els.input = $('#search-input');
  els.results = $('#search-results');
  els.hint = $('#search-hint');
  els.geo = $('#geo-btn');
  els.refresh = $('#refresh-btn');
  els.details = $('#details');
  els.hourly = $('#hourly');
  els.daily = $('#daily');
  els.hourBadge = $('#hourly-badge');
  els.dayBadge = $('#daily-badge');
  els.aqi = $('#aqi');
  els.toast = $('#toast');

  buildSky();
  renderSkeleton();
  bindEvents();
  setUnit(readUnit(), false);

  const place = readPlace() || DEFAULT_PLACE;
  fetchWeather(place);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
