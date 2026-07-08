
// ── Auth & Firestore Storage ─────────────────────────────────────────────────
const AUTHORIZED_EMAIL = 'zecalanga12@gmail.com'; // only this user can edit
let isEditor = false;

const observer = new MutationObserver(() => {
  if (window.lucide) {
    observer.disconnect();
    lucide.createIcons();
    document.querySelectorAll('svg[data-lucide]').forEach(el => el.removeAttribute('data-lucide'));
    observer.observe(document.body, { childList: true, subtree: true });
  }
});
if (window.lucide) {
  lucide.createIcons();
  document.querySelectorAll('svg[data-lucide]').forEach(el => el.removeAttribute('data-lucide'));
}
observer.observe(document.body, { childList: true, subtree: true });

function signIn() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(e => toast('Sign-in failed: ' + e.message, 'error'));
}

function signOut() {
  auth.signOut();
}

function updateAuthUI(user) {
  const out  = document.getElementById('auth-signed-out');
  const inn  = document.getElementById('auth-signed-in');
  const mail = document.getElementById('auth-user-email');
  if (user) {
    isEditor = user.email === AUTHORIZED_EMAIL;
    out.style.display = 'none';
    inn.style.display = 'flex';
    mail.innerHTML = '<i data-lucide="pen-line" class="icon-sm"></i> ' + user.email;
    if (!isEditor) {
      mail.innerHTML = '<i data-lucide="eye" class="icon-sm"></i> Viewing as ' + user.email;
    }
  } else {
    isEditor = false;
    out.style.display = 'flex';
    inn.style.display = 'none';
  }
  // Show/hide edit controls
  document.querySelectorAll('.editor-only').forEach(el => {
    el.style.display = isEditor ? '' : 'none';
  });
}

// Firestore save (debounced to avoid excessive writes)
let _saveTimer = null;
function save() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    DOC.set({
      weeks: state.weeks,
      articles: state.articles,
      calEvents: state.calEvents || [],
      customResources: state.customResources || [],
      alerts: state.alerts || []
    }).catch(e => console.error('Firestore save error:', e));
  }, 800);
}

// Load state from Firestore
async function loadFromFirestore() {
  try {
    const snap = await DOC.get();
    if (snap.exists) {
      const data = snap.data();
      let loadedWeeks = data.weeks || generateDefaultWeeks();
      if (!Array.isArray(loadedWeeks)) loadedWeeks = Object.values(loadedWeeks);
      state.weeks = loadedWeeks.filter(w => w != null && w.weekNum !== undefined);
      
      // Migration: Add any missing default tasks to current state (e.g. from PDF updates)
      const defaultWeeks = generateDefaultWeeks();
      
      // If the database has fewer weeks than the default (e.g., we added new weeks), add them
      if (state.weeks.length < defaultWeeks.length) {
        for (let i = state.weeks.length; i < defaultWeeks.length; i++) {
          state.weeks.push(defaultWeeks[i]);
        }
      }

      state.weeks.forEach((w, i) => {
        const defaultW = defaultWeeks.find(dw => dw.weekNum === w.weekNum);
        if (defaultW) {
          defaultW.tasks.forEach(dt => {
            if (w.tasks && !w.tasks.find(t => t.text === dt.text)) {
              w.tasks.push({ ...dt, id: UID() });
            }
          });
        }
      });
      if (isEditor) save();

      state.articles = data.articles || [];
      state.calEvents = data.calEvents && data.calEvents.length
        ? data.calEvents
        : CAL_EVENTS.map(ev => ({ ...ev, id: UID() }));
      state.customResources = data.customResources || [];
      state.alerts = data.alerts || [];
      
      // Clean up alerts older than 5 days
      const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      if (state.alerts) {
        state.alerts = state.alerts.filter(a => (now - a.timestamp) <= FIVE_DAYS);
      }
      
      if (isEditor) {
        updateNotifBadge();
      }
    } else {
      // First run — seed defaults and save
      state.weeks     = generateDefaultWeeks();
      state.articles  = [];
      state.calEvents = CAL_EVENTS.map(ev => ({ ...ev, id: UID() }));
      state.customResources = [];
      state.alerts = [];
      if (isEditor) {
        DOC.set({ weeks: state.weeks, articles: state.articles, calEvents: state.calEvents, customResources: state.customResources, alerts: state.alerts });
      }
    }
  } catch(e) {
    console.error('Firestore load error:', e);
    // Fallback to localStorage
    const local = localStorage.getItem('researchHQ_v1');
    if (local) { const d = JSON.parse(local); state.weeks = d.weeks || []; state.articles = d.articles || []; state.calEvents = d.calEvents || []; }
  }
}


// ── Theme ────────────────────────────────────────────────────────────────────
function initTheme() {
  const theme = localStorage.getItem('researchHQ_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  const track = $('toggle-track');
  const label = $('theme-toggle-label');
  if (track && label) {
    if (theme === 'light') {
      track.classList.add('on');
      label.innerHTML = '<i data-lucide="moon" class="icon-sm"></i> Dark Mode';
    } else {
      track.classList.remove('on');
      label.innerHTML = '<i data-lucide="sun" class="icon-sm"></i> Light Mode';
    }
  }
}

function toggleTheme() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const newTheme = isLight ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('researchHQ_theme', newTheme);
  
  const track = $('toggle-track');
  const label = $('theme-toggle-label');
  if (track && label) {
    if (newTheme === 'light') {
      track.classList.add('on');
      label.innerHTML = '<i data-lucide="moon" class="icon-sm"></i> Dark Mode';
    } else {
      track.classList.remove('on');
      label.innerHTML = '<i data-lucide="sun" class="icon-sm"></i> Light Mode';
    }
  }
}

// ── IndexedDB (articles) ──────────────────────────────────────────────────────
const ArtDB = {
  _db: null,
  async open() {
    if (this._db) return this._db;
    return new Promise((res, rej) => {
      const req = indexedDB.open('ResearchHQ', 1);
      req.onupgradeneeded = e => e.target.result.createObjectStore('files', { keyPath: 'id' });
      req.onsuccess = e => { this._db = e.target.result; res(this._db); };
      req.onerror = () => rej(req.error);
    });
  },
  async put(id, data) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction('files', 'readwrite');
      tx.objectStore('files').put({ id, data });
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
  },
  async get(id) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const req = db.transaction('files', 'readonly').objectStore('files').get(id);
      req.onsuccess = () => res(req.result?.data); req.onerror = () => rej(req.error);
    });
  },
  async del(id) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction('files', 'readwrite');
      tx.objectStore('files').delete(id); tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
  }
};

// ── App State ─────────────────────────────────────────────────────────────────
let state = { weeks: generateDefaultWeeks(), articles: [], calEvents: null, activeView: 'dashboard', selectedWeek: 1, customResources: [], alerts: [] };
let highlightedEventId = null;

function initState() {
  // calEvents seed handled in loadFromFirestore
  const today = new Date();
  for (let i = 0; i < state.weeks.length; i++) {
    const w = state.weeks[i];
    if (today >= new Date(w.startDate) && today <= new Date(w.endDate)) {
      state.selectedWeek = w.weekNum; break;
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
function toast(msg, type = 'info') {
  const t = el('div', `toast ${type}`, msg);
  $('toasts').appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function fmtWeekRange(w) {
  const s = new Date(w.startDate), e = new Date(w.endDate);
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${mo[s.getMonth()]} ${s.getDate()} – ${mo[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
}

function weekProgress(w) {
  if (!w.tasks.length) return 0;
  return Math.round((w.tasks.filter(t => t.done).length / w.tasks.length) * 100);
}

function trackProgress(track) {
  let done = 0, total = 0;
  state.weeks.forEach(w => w.tasks.forEach(t => {
    if (t.track === track || t.track === 'both') { total++; if (t.done) done++; }
  }));
  return total ? Math.round((done / total) * 100) : 0;
}

function ring(pct, color) {
  const r = 34, c = Math.PI * 2 * r;
  const off = c - (pct / 100) * c;
  return `<svg width="80" height="80" viewBox="0 0 80 80">
    <circle class="ring-bg" cx="40" cy="40" r="${r}"/>
    <circle class="ring-fill" cx="40" cy="40" r="${r}" stroke="${color}"
      stroke-dasharray="${c}" stroke-dashoffset="${off}"/>
  </svg>`;
}

// ── Resources data ────────────────────────────────────────────────────────────
const RESOURCES = [
  {
    category: 'Astrobiology Databases & Catalogues',
    icon: '<i data-lucide="telescope" class="icon-sm"></i>',
    desc: 'Primary repositories and data portals specifically for astrobiology research',
    items: [
      { name: 'NASA Astrobiology Habitable Environments Database (AHED)', url: 'https://ahed.nasa.gov/', desc: 'NASA-funded open-access repository for astrobiology data using the ARMS metadata standard. Bridges geology, biology, chemistry and planetary science datasets.', track: 'astro', tags: ['NASA', 'Open Access', 'Data Repository'] },
      { name: 'NASA Astrobiology Program — Publications', url: 'https://science.nasa.gov/astrobiology/publications/', desc: 'Searchable library of NASA-funded astrobiology publications hosted via SciX (formerly ADS). Includes roadmaps and strategy documents.', track: 'astro', tags: ['NASA', 'Literature', 'Open Access'] },
      { name: 'NASA Open Science Data Repository (OSDR)', url: 'https://osdr.nasa.gov/', desc: 'Consolidates space biology and health data including GeneLab omics data and Ames Life Sciences archives. Relevant for space-biology astrobiology links.', track: 'astro', tags: ['NASA', 'Omics', 'Space Biology'] },
      { name: 'Astromaterials Data System (AstroMat)', url: 'https://www.astromat.org/', desc: 'Archives analytical data for astromaterials including meteorites and planetary samples. Primary resource for chemical and mineralogical data from Antarctic and other meteorite collections.', track: 'astro', tags: ['Meteorites', 'Astromaterials', 'Open Data'] },
      { name: 'Meteoritical Bulletin Database', url: 'https://www.lpi.usra.edu/meteor/metbull.php', desc: 'Authoritative, internationally recognised source for officially approved meteorite names, classifications, and metadata maintained by the Meteoritical Society.', track: 'astro', tags: ['Meteorites', 'Classification', 'Free'] },
      { name: 'NASA GeneLab', url: 'https://genelab.nasa.gov/', desc: 'Multi-omics repository for spaceflight biology experiments (genomics, transcriptomics, proteomics, metabolomics). Useful for extremophile biology and biosignature context.', track: 'astro', tags: ['Omics', 'Space Biology', 'NASA'] },
      { name: 'NASA Astrobiology — Main Portal', url: 'https://science.nasa.gov/astrobiology/', desc: 'Central hub for NASA-funded astrobiology news, mission information, research announcements, and the Astrobiology Strategy documents.', track: 'astro', tags: ['NASA', 'Portal', 'Strategy'] },
      { name: 'SciX / NASA ADS', url: 'https://ui.adsabs.harvard.edu/', desc: 'NASA Astrophysics Data System. Search millions of astronomy, planetary science, and astrobiology papers. Filter by open access. Key for literature reviews.', track: 'astro', tags: ['Literature', 'Search Engine', 'ADS'] },
      { name: 'European Astrobiology Network Association (EANA)', url: 'https://www.eana-net.eu/', desc: 'European astrobiology community network coordinating research on Mars Sample Return, habitability, and biosignature detection. Access to working groups and collaborative resources.', track: 'astro', tags: ['ESA', 'European', 'Network'] },
      { name: 'ESA Planetary Science Archive (PSA)', url: 'https://www.cosmos.esa.int/web/psa', desc: 'ESA archive for planetary science data from Mars Express, ExoMars, and Rosetta. Access OMEGA and HRSC data relevant to Mars habitability and mineralogy.', track: 'both', tags: ['ESA', 'Planetary', 'Archive'] },
      { name: 'Astrophysics Source Code Library (ASCL)', url: 'https://ascl.net/', desc: 'Free online registry of source codes used in astrophysical research, including astrobiological simulations and modelling tools.', track: 'astro', tags: ['Code', 'Tools', 'Open Access'] },
    ]
  },
  {
    category: 'Astrochemistry & Molecular Databases',
    icon: '⚗️',
    desc: 'Reaction kinetics, molecular spectroscopy, and prebiotic chemistry databases',
    items: [
      { name: 'KIDA — KInetic Database for Astrochemistry', url: 'https://kida.astrochem-tools.org/', desc: 'Internationally recognised database of critically evaluated gas-phase and surface reaction kinetic data for astrophysical environments. Essential for modelling chemical networks in planetary atmospheres.', track: 'astro', tags: ['Kinetics', 'Astrochemistry', 'Free'] },
      { name: 'HITRAN — Molecular Spectroscopic Database', url: 'https://hitran.org/', desc: 'International standard for high-resolution molecular absorption parameters. Used to simulate atmospheric transmission and interpret astronomical spectra from exoplanets and Mars.', track: 'astro', tags: ['Molecular Spectroscopy', 'Atmospheres', 'Standard'] },
      { name: 'CDMS — Cologne Database for Molecular Spectroscopy', url: 'https://cdms.astro.uni-koeln.de/', desc: 'Catalogue of rotational spectra of molecules relevant to astrophysical environments. Used for radio and sub-millimetre line identification of interstellar molecules.', track: 'astro', tags: ['Radio Spectroscopy', 'ISM', 'Free'] },
      { name: 'JPL Molecular Spectroscopy Catalogue', url: 'https://spec.jpl.nasa.gov/', desc: 'NASA JPL catalogue of submillimetre, millimetre, and microwave spectral line data for atoms and molecules. Used alongside CDMS for astrochemical line identification.', track: 'astro', tags: ['NASA', 'JPL', 'Microwave'] },
      { name: 'Splatalogue', url: 'https://splatalogue.online/', desc: 'Unified spectral line database aggregating CDMS, JPL, and Lovas/NIST catalogues. Provides convenient line-by-line searches for molecular identification in astrophysical spectra.', track: 'astro', tags: ['Line Database', 'Aggregator', 'Free'] },
      { name: 'NASA Ames PAH IR Spectroscopic Database', url: 'https://www.astrochemistry.org/pahdb/', desc: 'Repository of computed and experimental IR spectra for polycyclic aromatic hydrocarbons (PAHs) — key molecules in astrochemistry and potential biosignature precursors.', track: 'astro', tags: ['PAH', 'Infrared', 'NASA Ames'] },
      { name: 'ChemOrigins — Prebiotic Chemistry Knowledge Graph', url: 'https://chemorigins.org/', desc: 'Community-curated open-access knowledge graph organising experimentally supported prebiotic reactions. Helps navigate pathways to biomolecules from abiotic starting materials.', track: 'astro', tags: ['Prebiotic Chemistry', 'Open Access', 'Knowledge Graph'] },
      { name: 'NIST Atomic Spectra Database', url: 'https://physics.nist.gov/PhysRefData/ASD/lines_form.html', desc: 'Critically evaluated data on atomic energy levels, wavelengths, and transition probabilities. Foundational for identifying atomic lines in astrophysical and planetary spectra.', track: 'astro', tags: ['Atomic Spectra', 'NIST', 'Standard'] },
      { name: 'UMIST Database for Astrochemistry', url: 'http://udfa.ajmarkwick.net/', desc: 'Comprehensive astrochemical reaction network updated with new laboratory and theoretical kinetic data. Complementary to KIDA for modelling ISM and atmospheric chemistry.', track: 'astro', tags: ['Kinetics', 'Reaction Networks', 'ISM'] },
    ]
  },
  {
    category: 'Spectral & Mineralogical Databases',
    icon: '🔬',
    desc: 'Reference spectra for mineral identification and organic compound fingerprinting',
    items: [
      { name: 'RRUFF Database', url: 'https://rruff.info/', desc: 'Premier open-access repository for verified mineral Raman, XRD, and IR spectra. Essential for biosignature work in mineral matrices and calibrating Raman spectrometer references.', track: 'astro', tags: ['Raman', 'XRD', 'Minerals', 'Free'] },
      { name: 'SDBS — Spectral Database for Organic Compounds (AIST)', url: 'https://sdbs.db.aist.go.jp/', desc: 'Maintained by AIST Japan. Comprehensive MS, FT-IR, and NMR spectra for organic compounds. Use for identifying organic biomarkers and abiotic vs biotic fingerprinting.', track: 'astro', tags: ['IR', 'NMR', 'Organics', 'Free'] },
      { name: 'USGS Spectral Library', url: 'https://www.usgs.gov/labs/spectroscopy-lab/science/spectral-library', desc: 'Comprehensive reflectance spectra of minerals, rocks, soils, and vegetation. Widely used for CRISM and OMEGA spectral analysis on Mars.', track: 'both', tags: ['Reflectance', 'USGS', 'Mars-relevant'] },
      { name: 'PDS Spectral Library (SPECLIB)', url: 'https://pds-speclib.rsl.wustl.edu/', desc: 'NASA PDS spectral library for planetary science. Includes spectra directly relevant to Mars surface mineralogy and comparative lab analysis.', track: 'both', tags: ['PDS', 'NASA', 'Planetary'] },
      { name: 'RELAB Spectral Database (Brown University)', url: 'https://www.planetary.brown.edu/relab/', desc: 'Extensive spectral reflectance library from Brown University\'s RELAB facility. Used for Mars analogue mineral studies and spectral unmixing of multi-component surfaces.', track: 'both', tags: ['Reflectance', 'Analogues', 'University'] },
      { name: 'Astrobiology Spectral Database (ASD)', url: 'https://www.usra.edu/ahed/', desc: 'NASA-funded resource providing mass spectrometry and NMR data for abiotic experiments and extracts from astromaterials like meteorites — fills gaps in standard metabolomics databases.', track: 'astro', tags: ['Mass Spec', 'NMR', 'Prebiotic', 'NASA'] },
    ]
  },
  {
    category: 'Mars Imagery & Remote Sensing Data',
    icon: '<i data-lucide="globe" class="icon-sm"></i>',
    desc: 'Portals to access HiRISE, CTX, CRISM, and other MRO datasets for alluvial fan analysis',
    items: [
      { name: 'PDS Geosciences Node — Mars Orbital Data Explorer (ODE)', url: 'https://ode.rsl.wustl.edu/mars/', desc: 'Most comprehensive tool for searching and downloading MRO data including CRISM, HiRISE, and CTX. Offers map-based searches and shopping-cart downloads.', track: 'mars', tags: ['HiRISE', 'CTX', 'CRISM', 'PDS'] },
      { name: 'HiRISE — High Resolution Imaging Science Experiment', url: 'https://www.uahirise.org/', desc: 'University of Arizona HiRISE portal. Browse and download 25–50 cm/pixel Mars surface images. Essential for mapping fan boundaries and depositional lobes.', track: 'mars', tags: ['Imagery', 'High Resolution', 'Free'] },
      { name: 'Mars Trek (NASA)', url: 'https://trek.nasa.gov/mars/', desc: 'Web-based interactive portal for visualising Mars planetary data, including high-resolution imagery, terrain models, and geology overlays. Great for site selection.', track: 'mars', tags: ['Visualisation', 'NASA', 'Browser-based'] },
      { name: 'JMARS (ASU)', url: 'https://jmars.asu.edu/', desc: 'Free GIS application by Arizona State University. Overlay and analyse HiRISE, CTX, THEMIS, MOLA, and CRISM data simultaneously. Ideal for fan morphology work.', track: 'mars', tags: ['GIS', 'Free', 'Multi-instrument'] },
      { name: 'PDS Imaging Node — Planetary Image Atlas', url: 'https://pds-imaging.jpl.nasa.gov/search/', desc: 'Specialised search for HiRISE, CTX, and MARCI imagery from the Planetary Data System Imaging Node at JPL.', track: 'mars', tags: ['PDS', 'JPL', 'Imagery'] },
      { name: 'CRISM Data and Tools (PDS Geosciences)', url: 'https://pds-geosciences.wustl.edu/missions/mro/crism.htm', desc: 'CRISM hyperspectral data and the CRISM Analysis Toolkit (CAT) for mineral mapping. Use with ENVI for atmospheric corrections and mineral identification at fan sites.', track: 'mars', tags: ['CRISM', 'Spectral', 'Mineral Mapping'] },
      { name: 'ESA Mars Express — HRSC & OMEGA Data', url: 'https://www.cosmos.esa.int/web/psa/mars-express', desc: 'ESA Mars Express archive with HRSC stereo imagery and OMEGA mineralogy data. OMEGA spectral cubes are valuable for surface mineralogy around alluvial fan sites.', track: 'mars', tags: ['ESA', 'HRSC', 'OMEGA', 'Stereo'] },
    ]
  },
  {
    category: 'Global Mars Inventories & Geodatabases',
    icon: '🗺️',
    desc: 'Published catalogues of Martian geomorphological features including alluvial fans',
    items: [
      { name: 'Figshare — Mars Alluvial Fan Inventories', url: 'https://figshare.com/search?q=mars+alluvial+fans', desc: 'Search Figshare for published geodatabases of Martian alluvial fans (shapefiles of fan outlines, apices, drainage basins). Published by researchers such as Morgan, Moore, and Howard.', track: 'mars', tags: ['Shapefiles', 'Geodatabase', 'Open Data'] },
      { name: 'MOLA — Mars Orbiter Laser Altimeter (PDS)', url: 'https://pds-geosciences.wustl.edu/missions/mgs/mola.html', desc: 'Global topographic data for Mars at ~1/128° resolution. Critical for DEM-based slope analysis and paleodischarge reconstruction of alluvial fans.', track: 'mars', tags: ['DEM', 'Topography', 'PDS'] },
      { name: 'CTX Global Mosaic (Murray Lab, Caltech)', url: 'https://murray-lab.caltech.edu/CTX/', desc: '5 m/pixel global mosaic of Mars from the Context Camera. Provides seamless coverage for regional fan mapping and geological context.', track: 'mars', tags: ['Mosaic', 'Context', 'Free'] },
      { name: 'Mars Global Geology Map (USGS)', url: 'https://www.usgs.gov/centers/astrogeology-science-center/science/mars-global-geology', desc: 'USGS Astrogeology Science Center geologic maps of Mars. Essential for stratigraphic and tectonic context of alluvial fan sites.', track: 'mars', tags: ['Geology', 'USGS', 'GIS'] },
      { name: 'NASA Technical Reports Server (NTRS)', url: 'https://ntrs.nasa.gov/', desc: 'Search for technical reports by key alluvial fan researchers (Moore, Howard, Morgan). Reports often include unpublished datasets and data catalog descriptions.', track: 'mars', tags: ['Literature', 'Technical Reports', 'NASA'] },
    ]
  },
  {
    category: 'Exoplanet & Habitability Resources',
    icon: '🌍',
    desc: 'Databases relevant to broader astrobiology habitability and life-detection research',
    items: [
      { name: 'NASA Exoplanet Archive', url: 'https://exoplanetarchive.ipac.caltech.edu/', desc: 'Primary repository for confirmed exoplanets. Includes stellar data, mission-specific data (Kepler, TESS, JWST), interactive tables, and API access.', track: 'astro', tags: ['Exoplanets', 'NASA', 'API'] },
      { name: 'Encyclopaedia of Exoplanetary Systems (exoplanet.eu)', url: 'https://exoplanet.eu/', desc: 'Continuously updated catalogue of extrasolar objects with filtering, plotting tools, and 3D visualisation. Useful for habitability zone comparisons.', track: 'astro', tags: ['Exoplanets', 'Visualisation', 'Free'] },
      { name: 'Habitable Worlds Catalog (HWC)', url: 'https://phl.upr.edu/hwc', desc: 'The Planetary Habitability Laboratory\'s catalogue of potentially habitable worlds ranked by Earth Similarity Index (ESI) and Habitability Score.', track: 'astro', tags: ['Habitability', 'Exoplanets', 'Free'] },
      { name: 'Breakthrough Listen Open Data Archive', url: 'https://breakthroughinitiatives.org/opendatasearch', desc: 'Massive open datasets from radio telescopes (Green Bank, Parkes) for technosignature research. Includes Python analysis tools and signal processing guides.', track: 'astro', tags: ['SETI', 'Radio', 'Open Data'] },
      { name: 'NASA Data Portal', url: 'https://data.nasa.gov/', desc: 'Comprehensive catalogue of publicly available NASA datasets, APIs, and visualisations across all space and earth sciences.', track: 'both', tags: ['NASA', 'Multi-domain', 'API'] },
    ]
  },
  {
    category: 'Biology & Biosignature Reference Databases',
    icon: '🧬',
    desc: 'Biological sequence, structure, and biosignature databases for life-detection research',
    items: [
      { name: 'RCSB Protein Data Bank (PDB)', url: 'https://www.rcsb.org/', desc: 'Global repository for experimentally determined 3D structures of proteins, nucleic acids, and complexes. Essential for understanding universal structural biosignatures of life.', track: 'astro', tags: ['Proteins', '3D Structures', 'Biosignatures'] },
      { name: 'AlphaFold Protein Structure Database (EBI)', url: 'https://alphafold.ebi.ac.uk/', desc: 'AI-predicted 3D structures for the proteomes of hundreds of organisms. Enables investigation of universal structural motifs that could serve as biosignature templates.', track: 'astro', tags: ['AI', 'Proteins', 'EBI', 'Open Access'] },
      { name: 'NCBI — National Center for Biotechnology Information', url: 'https://www.ncbi.nlm.nih.gov/', desc: 'Comprehensive hub for nucleotide sequences (GenBank), protein sequences, and PubMed literature. Essential for extremophile and biosignature-related biological reference data.', track: 'astro', tags: ['GenBank', 'Sequences', 'Free'] },
      { name: 'GTDB — Genome Taxonomy Database', url: 'https://gtdb.ecogen.au/', desc: 'Phylogenetically consistent database of bacterial and archaeal genomes. Useful for studying extremophile diversity and evolutionary biosignatures relevant to life detection.', track: 'astro', tags: ['Genomes', 'Taxonomy', 'Extremophiles'] },
    ]
  },
  {
    category: 'Software & Analysis Tools',
    icon: '🛠️',
    desc: 'Key software packages for data processing and spectral/spatial analysis',
    items: [
      { name: 'ISIS — Integrated Software for Imagers and Spectrometers (USGS)', url: 'https://isis.astrogeology.usgs.gov/', desc: 'Standard NASA software for calibrating and georeferencing raw imagery from MRO (HiRISE, CTX, CRISM). Required for EDR-level data processing.', track: 'mars', tags: ['Processing', 'USGS', 'Free'] },
      { name: 'QGIS — Quantum GIS', url: 'https://qgis.org/', desc: 'Free and open-source GIS for morphometric measurements, fan boundary digitising, and spatial analysis of Mars datasets.', track: 'mars', tags: ['GIS', 'Free', 'Open Source'] },
      { name: 'Spectragryph (Spectral Analysis)', url: 'https://www.effemm2.de/spectragryph/', desc: 'Free spectroscopy software for viewing, processing, and comparing Raman and IR spectra. Useful for direct comparison with RRUFF and SDBS references.', track: 'astro', tags: ['Raman', 'IR', 'Free'] },
      { name: 'OpenSpectra', url: 'https://github.com/openspectra/openspectra', desc: 'Open-source Python-based hyperspectral image analysis tool. Useful for visualising and analysing CRISM hyperspectral cubes and mineral mapping outputs.', track: 'mars', tags: ['Hyperspectral', 'Python', 'Open Source'] },
      { name: 'Zenodo — Research Data Repository', url: 'https://zenodo.org/', desc: 'CERN-operated open repository for scientific data, code, and publications. Search for supplementary datasets from published astrobiology and Mars geology papers.', track: 'both', tags: ['Data Sharing', 'Open Access', 'CERN'] },
    ]
  },
];

let resFilter = 'all';

function renderResources() {
  const body = $('resources-body');
  
  const allData = [...RESOURCES];
  if (state.customResources && state.customResources.length > 0) {
    allData.push({
      category: 'Community Resources',
      icon: '<i data-lucide="users" class="icon-sm"></i>',
      desc: 'Links and resources added by the community',
      items: state.customResources
    });
  }

  const filtered = resFilter === 'all'
    ? allData
    : allData.map(cat => ({ ...cat, items: cat.items.filter(r => r.track === resFilter || r.track === 'both') })).filter(cat => cat.items.length);

  const tagClass = t => t === 'astro' ? 'tag-astro' : t === 'mars' ? 'tag-mars' : t === 'both' ? 'tag-both' : 'tag-tool';
  const tagLabel = t => t === 'astro' ? 'Astrobiology' : t === 'mars' ? 'Martian Fans' : 'Both Tracks';

  body.innerHTML = `
    <div class="add-task-row editor-only" style="margin-bottom: 16px; ${isEditor ? '' : 'display:none;'}">
      <input id="new-res-name" class="add-task-input" placeholder="Resource Title...">
      <input id="new-res-url" class="add-task-input" placeholder="https://...">
      <select id="new-res-track" class="track-select">
        <option value="astro">Astrobiology</option>
        <option value="mars">Martian Fans</option>
        <option value="both">Both</option>
      </select>
      <button class="btn btn-primary" onclick="addCustomResource()">Add Link</button>
    </div>
    <div class="res-filter-bar">
      <button class="filter-btn${resFilter==='all'?' active':''}" onclick="setResFilter('all')">All Resources</button>
      <button class="filter-btn${resFilter==='astro'?' active':''}" onclick="setResFilter('astro')"><i data-lucide="telescope" class="icon-sm"></i> Astrobiology</button>
      <button class="filter-btn${resFilter==='mars'?' active':''}" onclick="setResFilter('mars')"><i data-lucide="globe" class="icon-sm"></i> Martian Fans</button>
    </div>
    ${filtered.map(cat => `
      <div class="res-category">
        <div class="res-category-header">
          <span class="res-category-icon">${cat.icon}</span>
          <div>
            <div class="res-category-title">${cat.category}</div>
            <div class="res-category-desc">${cat.desc}</div>
          </div>
        </div>
        <div class="res-grid">
          ${cat.items.map(r => `
            <a class="res-card" href="${r.url}" target="_blank" rel="noopener noreferrer">
              <div class="res-card-header">
                <div class="res-card-name">${r.name}</div>
                <div style="display:flex; gap:6px; align-items:center;">
                  <span class="res-card-tag ${tagClass(r.track)}">${tagLabel(r.track)}</span>
                  ${r.id && isEditor ? `<button class="btn btn-ghost btn-sm" style="color:var(--red); padding:0 4px;" onclick="deleteCustomResource('${r.id}', event)"><i data-lucide="trash-2" class="icon-sm"></i></button>` : ''}
                </div>
              </div>
              <div class="res-card-desc">${r.desc}</div>
              <div class="res-card-url">${r.url}</div>
              <div class="res-card-footer">
                ${r.tags && r.tags.length ? r.tags.map(t => `<span class="res-chip">${t}</span>`).join('') : ''}
              </div>
            </a>`).join('')}
        </div>
      </div>`).join('')}`;
}

function addCustomResource() {
  const nameInput = $('new-res-name');
  const urlInput = $('new-res-url');
  const trackInput = $('new-res-track');
  const name = nameInput.value.trim();
  const url = urlInput.value.trim();
  if (!name || !url) {
    toast('Name and URL are required', 'error');
    return;
  }
  let finalUrl = url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    finalUrl = 'https://' + url;
  }
  const track = trackInput.value;
  state.customResources.push({
    id: UID(),
    name,
    url: finalUrl,
    desc: 'Community added resource',
    track,
    tags: ['Community']
  });
  save();
  nameInput.value = '';
  urlInput.value = '';
  renderResources();
  toast('Resource added', 'success');
}

function deleteCustomResource(id, e) {
  e.preventDefault();
  e.stopPropagation();
  if (confirm('Delete this resource?')) {
    state.customResources = state.customResources.filter(r => r.id !== id);
    save();
    renderResources();
    toast('Resource deleted', 'success');
  }
}

function setResFilter(f) { resFilter = f; renderResources(); }

// ── Router ────────────────────────────────────────────────────────────────────
function navigateToEvent(id, dateStr) {
  highlightedEventId = id;
  if (dateStr) {
    const d = new Date(dateStr);
    calMonth = d.getMonth();
    calYear = d.getFullYear();
  }
  navigate('calendar');
  setTimeout(() => {
    highlightedEventId = null;
    if (state.activeView === 'calendar') renderCalGrid();
  }, 3000);
}

function navigate(view) {
  state.activeView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));
  if (view === 'dashboard') renderDashboard();
  else if (view === 'planner') renderPlanner();
  else if (view === 'library') renderLibrary();
  else if (view === 'calendar') renderCalendar();
  else if (view === 'resources') renderResources();
  updateSidebarStats();
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function renderDashboard() {
  const today = new Date();
  const totalTasks = state.weeks.reduce((s, w) => s + w.tasks.length, 0);
  const doneTasks = state.weeks.reduce((s, w) => s + w.tasks.filter(t => t.done).length, 0);
  const curWeek = state.weeks.find(w => today >= new Date(w.startDate) && today <= new Date(w.endDate)) || state.weeks[0];
  const weeksLeft = state.weeks.filter(w => new Date(w.endDate) >= today).length;
  const aP = trackProgress('astro'), mP = trackProgress('mars');

  $('dash-body').innerHTML = `
    <div class="dash-grid-3" style="margin-bottom:18px">
      <div class="stat-card">
        <div class="stat-big" style="color:var(--accent)">${weeksLeft}</div>
        <div class="stat-lbl">Weeks Remaining</div>
      </div>
      <div class="stat-card">
        <div class="stat-big" style="color:var(--green)">${doneTasks}</div>
        <div class="stat-lbl">Tasks Completed</div>
      </div>
      <div class="stat-card">
        <div class="stat-big" style="color:var(--text2)">${state.articles.length}</div>
        <div class="stat-lbl">Articles Uploaded</div>
      </div>
    </div>
    <div class="dash-grid" style="margin-bottom:18px">
      <div class="track-card">
        <div>
          <div class="ring-wrap">${ring(aP,'var(--astro)')}<div class="ring-label"><div class="ring-pct" style="color:var(--astro)">${aP}%</div><div class="ring-txt">done</div></div></div>
        </div>
        <div class="track-card-info">
          <div class="flex items-center gap-2" style="margin-bottom:6px"><span class="badge badge-astro">ASTROBIOLOGY</span></div>
          <div class="track-card-name">Organic-Mineral Interactions</div>
          <div class="track-card-desc">Investigating biosignature detection via organic adsorption onto mineral matrices</div>
          <div class="track-card-phase">Phase: <span>${getPhase(curWeek.weekNum).name}</span></div>
          <div class="progress-bar"><div class="progress-bar-fill" style="width:${aP}%;background:var(--astro)"></div></div>
        </div>
      </div>
      <div class="track-card">
        <div>
          <div class="ring-wrap">${ring(mP,'var(--mars)')}<div class="ring-label"><div class="ring-pct" style="color:var(--mars)">${mP}%</div><div class="ring-txt">done</div></div></div>
        </div>
        <div class="track-card-info">
          <div class="flex items-center gap-2" style="margin-bottom:6px"><span class="badge badge-mars">MARTIAN GEOLOGY</span></div>
          <div class="track-card-name">Martian Alluvial Fans</div>
          <div class="track-card-desc">Morphological analysis and Earth-analog comparison of alluvial fans on Mars</div>
          <div class="track-card-phase">Phase: <span>${getPhase(curWeek.weekNum).name}</span></div>
          <div class="progress-bar"><div class="progress-bar-fill" style="width:${mP}%;background:var(--mars)"></div></div>
        </div>
      </div>
    </div>
    <div class="week-current-card">
      <div class="week-badge"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Current Week</div>
      <div class="flex items-center justify-between" style="margin-bottom:12px">
        <div>
          <div style="font-size:16px;font-weight:700">Week ${curWeek.weekNum} <span style="color:var(--text3);font-size:13px;font-weight:400">of 26</span></div>
          <div class="week-dates">${fmtWeekRange(curWeek)}</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="navigate('planner')">View All Tasks →</button>
      </div>
      ${curWeek.tasks.slice(0,5).map(t=>`
        <div class="task-preview">
          <div class="task-preview-dot" style="background:${t.track==='astro'?'var(--astro)':t.track==='mars'?'var(--mars)':'var(--accent)'}"></div>
          <span style="font-size:13px;color:${t.done?'var(--text3)':'var(--text2)'};${t.done?'text-decoration:line-through':''}">${t.text}</span>
          ${t.done?'<span class="badge badge-astro" style="margin-left:auto;flex-shrink:0;font-size:9px">done</span>':''}
        </div>`).join('')}
      ${curWeek.tasks.length > 5 ? `<div style="font-size:11px;color:var(--text3);margin-top:8px">+${curWeek.tasks.length-5} more tasks this week</div>` : ''}
    </div>`;
}

// ── Planner ───────────────────────────────────────────────────────────────────
function renderPlanner() {
  renderWeekList(); renderWeekDetail();
}

function renderWeekList() {
  const list = $('week-list');
  let html = '', lastPhase = '';
  state.weeks.forEach(w => {
    const phase = getPhase(w.weekNum);
    if (phase.name !== lastPhase) {
      html += `<div class="phase-header" style="color:${phase.color}">${phase.name}</div>`;
      lastPhase = phase.name;
    }
    const pct = weekProgress(w);
    const active = w.weekNum === state.selectedWeek ? ' active' : '';
    html += `<div class="week-item${active}" data-week="${w.weekNum}" onclick="selectWeek(${w.weekNum})">
      <div class="week-num">${String(w.weekNum).padStart(2,'0')}</div>
      <div class="week-item-info">
        <div class="week-item-date">${fmtWeekRange(w)}</div>
        <div class="week-mini-bar"><div class="week-mini-fill" style="width:${pct}%;background:${phase.color}"></div></div>
      </div>
      <div style="font-size:10px;color:var(--text3);font-family:'JetBrains Mono',monospace">${pct}%</div>
    </div>`;
  });
  list.innerHTML = html;
}

function selectWeek(n) {
  state.selectedWeek = n;
  renderWeekList();
  renderWeekDetail();
}

function renderWeekDetail() {
  const w = state.weeks.find(x => x.weekNum === state.selectedWeek);
  if (!w) return;
  const phase = getPhase(w.weekNum);
  const pct = weekProgress(w);
  const detail = $('week-detail');
  const tracks = [
    { key: 'astro', label: 'Astrobiology', color: 'var(--astro)', badge: 'badge-astro' },
    { key: 'mars', label: 'Martian Fans', color: 'var(--mars)', badge: 'badge-mars' },
    { key: 'both', label: 'Both Tracks', color: 'var(--accent)', badge: 'badge-both' },
  ];
  let taskHTML = '';
  tracks.forEach(tr => {
    const tasks = w.tasks.filter(t => t.track === tr.key);
    if (!tasks.length) return;
    taskHTML += `<div style="margin-bottom:16px">
      <div class="flex items-center gap-2" style="margin-bottom:8px">
        <span class="badge ${tr.badge}">${tr.label}</span>
        <span style="font-size:11px;color:var(--text3)">${tasks.filter(t=>t.done).length}/${tasks.length}</span>
      </div>
      ${tasks.map(t => renderTaskItem(t, w.weekNum)).join('')}
    </div>`;
  });
  let resourceOpts = '<option value="">-- Link Resource (Optional) --</option>';
  RESOURCES.forEach(cat => {
    resourceOpts += `<optgroup label="${cat.category}">`;
    cat.items.forEach(res => {
      resourceOpts += `<option value="${res.url}">${res.name.replace(/"/g, '&quot;')}</option>`;
    });
    resourceOpts += `</optgroup>`;
  });

  const wStart = new Date(w.startDate);
  const wEnd = new Date(w.endDate);
  const weekEvents = (state.calEvents || []).filter(ev => {
    const evStart = new Date(ev.start);
    const evEnd = ev.end ? new Date(ev.end) : evStart;
    return (evStart <= wEnd && evEnd >= wStart);
  });

  let eventsHTML = '';
  if (weekEvents.length > 0) {
    eventsHTML = `
      <div style="font-size:11px;font-weight:600;color:var(--text3);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Week Events</div>
      <div style="margin-bottom:20px; display:flex; flex-wrap:wrap; gap:6px;">
        ${weekEvents.map(ev => `<div class="cal-task-chip" style="background:var(--surface2);border:1px solid var(--border);color:var(--text2);font-size:11px;padding:3px 8px;border-radius:6px;display:flex;align-items:center;gap:4px;cursor:pointer;" onclick="navigateToEvent('${ev.id}', '${ev.start}')" title="${ev.start}${ev.end ? ' to ' + ev.end : ''}">🗓 ${ev.text}</div>`).join('')}
      </div>`;
  }

  detail.innerHTML = `
    <div class="flex items-center justify-between" style="margin-bottom:16px">
      <div>
        <div style="font-size:18px;font-weight:700">Week ${w.weekNum}</div>
        <div style="font-size:12px;color:var(--text3)">${fmtWeekRange(w)} &nbsp;·&nbsp; <span style="color:${phase.color}">${phase.name}</span></div>
      </div>
      <div style="text-align:right">
        <div style="font-size:20px;font-weight:700;font-family:'JetBrains Mono',monospace;color:${phase.color}">${pct}%</div>
        <div style="font-size:10px;color:var(--text3)">complete</div>
      </div>
    </div>
    <div class="progress-bar" style="margin-bottom:16px"><div class="progress-bar-fill" style="width:${pct}%;background:${phase.color}"></div></div>
    ${eventsHTML}
    ${taskHTML || '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">No tasks yet</div><div class="empty-state-sub">Add one below</div></div>'}
    <div class="add-task-row">
      <input id="new-task-text" class="add-task-input" placeholder="Add a new task…" onkeydown="if(event.key==='Enter')addTask()">
      <select id="new-task-track" class="track-select">
        <option value="astro"><i data-lucide="telescope" class="icon-sm"></i> Astrobiology</option>
        <option value="mars"><i data-lucide="globe" class="icon-sm"></i> Martian Fans</option>
        <option value="both">🌍 Both</option>
      </select>
      <select id="new-task-priority" class="priority-select">
        <option value="high">High</option>
        <option value="medium" selected>Medium</option>
        <option value="low">Low</option>
      </select>
      <select id="new-task-resource" class="resource-select" style="max-width: 160px;">
        ${resourceOpts}
      </select>
      <button class="btn btn-primary" onclick="addTask()">Add</button>
    </div>
    <div class="week-notes">
      <div class="notes-label">Week Notes</div>
      <textarea class="notes-textarea" placeholder="Reflections, ideas, blockers…" oninput="saveNotes(this.value,${w.weekNum})">${w.notes||''}</textarea>
    </div>
    <div class="week-reports">
      <div class="notes-label" style="margin-bottom:12px">📎 Weekly Reports</div>
      <div class="reports-tracks">
        <div class="report-track">
          <div class="report-track-header">
            <span class="badge badge-astro">Astrobiology</span>
            ${isEditor ? `<label class="btn btn-ghost btn-sm" style="cursor:pointer;font-size:11px">
              + Upload
              <input type="file" style="display:none" accept=".pdf,.doc,.docx,.txt,.md" onchange="uploadWeekReport(event,${w.weekNum},'astro')">
            </label>` : ''}
          </div>
          <div id="reports-astro-${w.weekNum}" class="report-list">
            ${(w.reports||[]).filter(r=>r.track==='astro').map(r=>`
              <div class="report-item">
                <span class="report-icon">📄</span>
                <span class="report-name" onclick="openWeekReport('${r.id}','${r.name}','${r.type}')" title="Open ${r.name}">${r.name}</span>
                <span class="report-size">${(r.size/1024).toFixed(1)}KB</span>
                ${isEditor ? `<button class="btn btn-danger btn-icon btn-sm" onclick="deleteWeekReport('${r.id}',${w.weekNum},'astro')" title="Delete">✕</button>` : ''}
              </div>`).join('') || '<div class="report-empty">No reports yet</div>'}
          </div>
        </div>
        <div class="report-track">
          <div class="report-track-header">
            <span class="badge badge-mars">Martian Fans</span>
            ${isEditor ? `<label class="btn btn-ghost btn-sm" style="cursor:pointer;font-size:11px">
              + Upload
              <input type="file" style="display:none" accept=".pdf,.doc,.docx,.txt,.md" onchange="uploadWeekReport(event,${w.weekNum},'mars')">
            </label>` : ''}
          </div>
          <div id="reports-mars-${w.weekNum}" class="report-list">
            ${(w.reports||[]).filter(r=>r.track==='mars').map(r=>`
              <div class="report-item">
                <span class="report-icon">📄</span>
                <span class="report-name" onclick="openWeekReport('${r.id}','${r.name}','${r.type}')" title="Open ${r.name}">${r.name}</span>
                <span class="report-size">${(r.size/1024).toFixed(1)}KB</span>
                ${isEditor ? `<button class="btn btn-danger btn-icon btn-sm" onclick="deleteWeekReport('${r.id}',${w.weekNum},'mars')" title="Delete">✕</button>` : ''}
              </div>`).join('') || '<div class="report-empty">No reports yet</div>'}
          </div>
        </div>
      </div>
    </div>`;
}

function renderTaskItem(t, weekNum) {
  const chk = t.done ? ' checked' : '';
  const done = t.done ? ' done' : '';
  const doneText = t.done ? ' done-text' : '';
  const pri = `<span class="badge badge-${t.priority}" style="font-size:9px">${t.priority}</span>`;
  const resLink = t.resourceUrl ? `<a href="${t.resourceUrl}" target="_blank" class="task-res-link" title="${t.resourceName}">🔗</a>` : '';
  return `<div class="task-item${done}" id="task-${t.id}">
    <div class="task-check${chk}" onclick="toggleTask('${t.id}',${weekNum})" title="Toggle done" style="${isEditor ? 'cursor:pointer' : 'cursor:not-allowed'}">
      ${t.done ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>' : ''}
    </div>
    <div class="flex items-center gap-2" style="flex:1; min-width:0">
      <textarea class="task-text${doneText}" rows="1" onblur="updateTask('${t.id}',${weekNum},this.value)" oninput="autoResize(this)" ${isEditor ? '' : 'readonly'}>${t.text}</textarea>
      ${resLink}
    </div>
    <div class="task-actions">
      ${pri}
      ${isEditor ? `<button class="btn btn-danger btn-icon btn-sm" onclick="deleteTask('${t.id}',${weekNum})" title="Delete">✕</button>` : ''}
    </div>
  </div>`;
}

function autoResize(el) { el.style.height='auto'; el.style.height=el.scrollHeight+'px'; }

function toggleTask(id, weekNum) {
  if (!isEditor) { toast('Only editors can toggle tasks', 'error'); return; }
  const w = state.weeks.find(x => x.weekNum === weekNum);
  const t = w?.tasks.find(x => x.id === id);
  if (t) { t.done = !t.done; save(); renderWeekList(); renderWeekDetail(); updateSidebarStats(); }
}

function updateTask(id, weekNum, val) {
  if (!isEditor) return;
  const w = state.weeks.find(x => x.weekNum === weekNum);
  const t = w?.tasks.find(x => x.id === id);
  if (t && val.trim()) { t.text = val.trim(); save(); }
}

function deleteTask(id, weekNum) {
  if (!isEditor) { toast('Only editors can delete tasks', 'error'); return; }
  const w = state.weeks.find(x => x.weekNum === weekNum);
  if (w) { w.tasks = w.tasks.filter(x => x.id !== id); save(); renderWeekList(); renderWeekDetail(); updateSidebarStats(); }
}

function addTask() {
  const text = $('new-task-text').value.trim();
  if (!text) return;
  const w = state.weeks.find(x => x.weekNum === state.selectedWeek);
  if (!w) return;
  const resSelect = $('new-task-resource');
  const resourceUrl = resSelect.value;
  const resourceName = resourceUrl ? resSelect.options[resSelect.selectedIndex].text : '';
  w.tasks.push({ 
    id: UID(), 
    track: $('new-task-track').value, 
    text, 
    priority: $('new-task-priority').value, 
    done: false,
    resourceUrl,
    resourceName
  });
  
  if (!isEditor) {
    if (!state.alerts) state.alerts = [];
    state.alerts.push({ id: UID(), message: `Added task "${text}" to Week ${state.selectedWeek}`, timestamp: Date.now(), read: false });
    if (isEditor) updateNotifBadge();
  }

  $('new-task-text').value = '';
  save(); renderWeekList(); renderWeekDetail(); updateSidebarStats();
  toast('Task added', 'success');
}

function saveNotes(val, weekNum) {
  const w = state.weeks.find(x => x.weekNum === weekNum);
  if (w) { w.notes = val; save(); }
}

async function uploadWeekReport(event, weekNum, track) {
  if (!isEditor) { toast('Sign in to upload reports', 'error'); return; }
  const file = event.target.files[0];
  if (!file) return;
  const MAX = 20 * 1024 * 1024; // 20MB limit
  if (file.size > MAX) { toast('File too large (max 20MB)', 'error'); return; }

  const id = UID();
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      await ArtDB.put(id, e.target.result);
      const w = state.weeks.find(x => x.weekNum === weekNum);
      if (!w.reports) w.reports = [];
      w.reports.push({ id, name: file.name, size: file.size, type: file.type, track, uploadedAt: new Date().toISOString() });
      save();
      renderWeekDetail();
      toast(`"${file.name}" uploaded`, 'success');
    } catch(err) {
      toast('Upload failed: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

async function openWeekReport(id, name, type) {
  try {
    const buf = await ArtDB.get(id);
    if (!buf) { toast('File not found in local storage', 'error'); return; }
    const blob = new Blob([buf], { type: type || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch(err) {
    toast('Could not open file: ' + err.message, 'error');
  }
}

async function deleteWeekReport(id, weekNum, track) {
  if (!isEditor) return;
  const w = state.weeks.find(x => x.weekNum === weekNum);
  if (!w) return;
  w.reports = (w.reports || []).filter(r => r.id !== id);
  await ArtDB.del(id);
  save();
  renderWeekDetail();
  toast('Report deleted', 'info');
}

// ── Library ───────────────────────────────────────────────────────────────────
let libFilter = 'all';

function formatBytes(bytes, decimals = 1) {
  if (!+bytes) return '';
  const k = 1024, dm = decimals < 0 ? 0 : decimals, sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function renderLibrary() {
  const container = $('articles-grid');
  
  let all = [...state.articles];
  const q = $('lib-search') ? $('lib-search').value.toLowerCase() : '';
  if (q) all = all.filter(a => a.title.toLowerCase().includes(q));

  const sort = $('lib-sort') ? $('lib-sort').value : 'date-desc';
  all.sort((a, b) => {
    if (sort === 'date-desc') return new Date(b.dateAdded) - new Date(a.dateAdded);
    if (sort === 'date-asc') return new Date(a.dateAdded) - new Date(b.dateAdded);
    if (sort === 'alpha-asc') return a.title.localeCompare(b.title);
    if (sort === 'alpha-desc') return b.title.localeCompare(a.title);
    if (sort === 'size-desc') return (b.size || 0) - (a.size || 0);
    if (sort === 'size-asc') return (a.size || 0) - (b.size || 0);
    return 0;
  });

  // When a filter is active, show only matching track but still in two-column layout
  const astroArticles = all.filter(a => a.track === 'astro' || a.track === 'both');
  const marsArticles  = all.filter(a => a.track === 'mars'  || a.track === 'both');

  const showAstro = libFilter === 'all' || libFilter === 'astro';
  const showMars  = libFilter === 'all' || libFilter === 'mars';

  function articleCard(a) {
    const icon = a.type === 'pdf' ? '<i data-lucide="file-text" class="icon-sm"></i>' : '<i data-lucide="file-edit" class="icon-sm"></i>';
    return `
      <div class="article-card">
        <div class="article-card-icon">${icon}</div>
        <div class="article-card-main">
          <div class="article-title">${a.title}</div>
          <div class="article-meta">${new Date(a.dateAdded).toLocaleDateString()}${a.size ? ' · ' + formatBytes(a.size) : ''}${a.tags.length ? ' · ' + a.tags.join(', ') : ''}</div>
        </div>
        <div class="article-actions">
          <button class="btn btn-ghost btn-sm" onclick="openArticle('${a.id}')"><i data-lucide="book-open" class="icon-sm"></i></button>
          <button class="btn btn-danger btn-sm" onclick="deleteArticle('${a.id}')"><i data-lucide="x" class="icon-sm"></i></button>
        </div>
      </div>`;
  }

  function column(track, articles, show) {
    const isAstro = track === 'astro';
    const color   = isAstro ? 'var(--astro)' : 'var(--mars)';
    const label   = isAstro ? '<i data-lucide="telescope" class="icon-sm"></i> Astrobiology' : '<i data-lucide="globe" class="icon-sm"></i> Martian Fans';
    const emptyMsg = isAstro
      ? 'Drop papers into the Astrobiology zone above'
      : 'Drop papers into the Martian Fans zone above';

    return `
      <div class="lib-col ${show ? '' : 'hidden'}">
        <div class="lib-col-header">
          <span class="lib-col-title" style="color:${color}">${label}</span>
          <span class="lib-col-count">${articles.length} article${articles.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="lib-col-body">
          ${articles.length
            ? articles.map(articleCard).join('')
            : `<div class="empty-state"><div class="empty-state-icon"><i data-lucide="${isAstro ? 'telescope' : 'globe'}"></i></div><div class="empty-state-text">No articles yet</div><div class="empty-state-sub">${emptyMsg}</div></div>`
          }
        </div>
      </div>`;
  }

  const colsStyle = showAstro && showMars 
    ? `grid-template-columns: minmax(0, var(--split-left, 1fr)) 6px minmax(0, var(--split-right, 1fr));`
    : `grid-template-columns: 1fr;`;

  container.innerHTML = `
    <div class="lib-cols" id="lib-cols" style="${colsStyle}">
      ${showAstro ? column('astro', astroArticles, true) : ''}
      ${showAstro && showMars ? `<div class="lib-resizer" id="lib-resizer"></div>` : ''}
      ${showMars ? column('mars', marsArticles, true) : ''}
    </div>`;
}

function setLibFilter(f) {
  libFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === f));
  renderLibrary();
}

async function handleUpload(files, track = 'astro') {
  for (const file of files) {
    const isText = file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md');
    const isPDF = file.type === 'application/pdf' || file.name.endsWith('.pdf');
    if (!isText && !isPDF) { toast(`Unsupported: ${file.name}`, 'error'); continue; }
    const id = UID();
    const meta = { id, title: file.name.replace(/\.[^.]+$/, ''), type: isPDF ? 'pdf' : 'text', track, tags: [], dateAdded: new Date().toISOString(), notes: '', size: file.size };
    try {
      const buf = await file.arrayBuffer();
      await ArtDB.put(id, buf);
      state.articles.push(meta);
      
      if (!isEditor) {
        if (!state.alerts) state.alerts = [];
        state.alerts.push({ id: UID(), message: `Uploaded article "${meta.title}" to ${track === 'astro' ? 'Astrobiology' : 'Martian Fans'}`, timestamp: Date.now(), read: false });
        if (isEditor) updateNotifBadge();
      }

      save();
      toast(`Uploaded to ${track === 'astro' ? 'Astrobiology' : 'Martian Fans'}: ${meta.title}`, 'success');
    } catch (e) { toast(`Failed to upload ${file.name}`, 'error'); }
  }
  renderLibrary();
  updateSidebarStats();
}

async function openArticle(id) {
  const meta = state.articles.find(a => a.id === id);
  if (!meta) return;
  $('modal-title').textContent = meta.title;
  $('modal-body').innerHTML = '<div style="text-align:center;padding:32px;color:var(--text3)">Loading…</div>';
  $('modal-overlay').classList.add('open');
  try {
    const buf = await ArtDB.get(id);
    if (!buf) { $('modal-body').innerHTML = '<div style="color:var(--red)">File not found in storage.</div>'; return; }
    if (meta.type === 'pdf') {
      const blob = new Blob([buf], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      $('modal-body').innerHTML = `<iframe class="pdf-frame" src="${url}"></iframe>`;
    } else {
      const text = new TextDecoder().decode(buf);
      $('modal-body').innerHTML = `<div class="text-reader">${text.replace(/</g,'&lt;')}</div>`;
    }
  } catch (e) { $('modal-body').innerHTML = `<div style="color:var(--red)">Error: ${e.message}</div>`; }
}

async function deleteArticle(id) {
  state.articles = state.articles.filter(a => a.id !== id);
  await ArtDB.del(id);
  save(); renderLibrary(); updateSidebarStats();
  toast('Article removed', 'info');
}

// ── Calendar ──────────────────────────────────────────────────────────────────
let calMonth = 6; // July = month index 6 (0-based)
const CAL_EVENTS = [
  { start: '2026-06-22', text: 'online 21h SRI webinar Jan Woerner' },
  { start: '2026-06-23', text: 'ISU Illkirch 14h TP Team Projects Final' },
  { start: '2026-06-24', text: '10h ISU LUNEX / 14h BBQ' },
  { start: '2026-06-25', text: 'depart for Nancy ELS Lunar' },
  { start: '2026-06-26', text: 'Leiden meetings' },
  { start: '2026-06-29', text: 'Leiden U / deadline abstracts' },
  { start: '2026-06-30', text: 'Delft TU 13h / SRI Congress' },
  { start: '2026-07-01', text: 'LUNEX ISU academy internships' },
  { start: '2026-07-02', text: '11h00 Leiden U / Eurobusiness' },
  { start: '2026-07-03', text: '10h DSEL / pm Noordwijk BIC' },
  { start: '2026-07-04', text: '11h LuMa ship' },
  { start: '2026-07-05', text: '15h Delft Oude Kerk' },
  { start: '2026-07-06', text: 'ExoSpaceHab tests' },
  { start: '2026-07-07', text: '12h Delft explo labs' },
  { start: '2026-07-08', text: 'travel EMMPOL27' },
  { start: '2026-07-09', end: '2026-07-16', text: 'EMMPOL27 Campaign AATC' },
  { start: '2026-07-11', text: '16h Was dorpskerk, 18h Alliance francaise' },
  { start: '2026-07-14', text: 'French national day celebration' },
  { start: '2026-07-15', text: 'Leiden U TW3' },
  { start: '2026-07-16', text: 'Leiden U TW3 / Noordwijk SBIC' },
  { start: '2026-07-17', end: '2026-07-18', text: 'London E-SGAC W' },
  { start: '2026-07-20', text: 'Lunar gradcon' },
  { start: '2026-07-21', text: 'Vrushali & SSERVi NESF' },
  { start: '2026-07-23', text: 'Toulouse IRAP' },
  { start: '2026-07-23', end: '2026-07-31', text: 'EMMPOL 28 AATC' },
  { start: '2026-07-24', end: '2026-07-25', text: 'Pic du Midi observatory' },
  { start: '2026-07-26', text: 'Toulouse icebreaker' },
  { start: '2026-07-27', end: '2026-07-31', text: 'Leiden COSPAR prep' },
  { start: '2026-07-31', text: '17h AMS-Florence BF flight' },
  { start: '2026-08-01', end: '2026-08-09', text: 'Firenze COSPAR' },
  { start: '2026-08-09', end: '2026-08-10', text: 'eclipse tests Alicante' },
  { start: '2026-08-11', text: 'proceed to eclipse sites' },
  { start: '2026-08-12', text: 'eclipse day (totality 20h CEST)' },
  { start: '2026-08-13', text: 'return from eclipse' },
  { start: '2026-08-17', text: 'BF in Paris' },
  { start: '2026-08-18', end: '2026-08-24', text: 'BF in NL' },
  { start: '2026-08-19', text: 'LUNEX internship preliminary review' },
  { start: '2026-08-26', end: '2026-08-27', text: 'Venice Space Science' },
  { start: '2026-08-27', end: '2026-09-05', text: 'Deep Space Conf Hefei' },
  { start: '2026-09-01', text: 'EANA Neuchatel' },
  { start: '2026-09-06', text: 'EPSC grad/LUNEX pre-event' },
  { start: '2026-09-07', end: '2026-09-11', text: 'Hague EPSC' },
  { start: '2026-09-11', text: '18h Paris SGAC France' },
  { start: '2026-09-12', text: 'Paris Ivry IPSA SGAC' },
  { start: '2026-09-13', text: 'Paris LUEX ISU social' },
  { start: '2026-09-14', text: 'return Leiden' },
  { start: '2026-09-15', end: '2026-09-17', text: 'ESTEC industry day / Purdue LEAG' },
  { start: '2026-09-17', text: 'Comet lab YPSAT' },
  { start: '2026-09-18', text: 'LUNEX internship mid-term review' },
  { start: '2026-09-21', end: '2026-09-24', text: 'ESTEC ESLAB Heliophysics' },
  { start: '2026-09-26', end: '2026-09-27', text: 'ESTEC open day' },
  { start: '2026-09-28', end: '2026-09-30', text: 'Dubai (GEGSLA)' },
  { start: '2026-09-28', text: 'Budapest Climate change' },
  { start: '2026-10-01', end: '2026-10-03', text: 'Antalya SGC' },
  { start: '2026-10-03', end: '2026-10-04', text: 'UN-IAF space tech' },
  { start: '2026-10-05', end: '2026-10-10', text: 'Antalya IAC' },
  { start: '2026-10-11', end: '2026-10-15', text: 'Pretoria ISTVS robotics' },
  { start: '2026-10-14', end: '2026-10-16', text: 'Geneva Science Diplomacy' },
  { start: '2026-10-21', end: '2026-10-23', text: 'ESTEC SPAICE space AI' },
  { start: '2026-10-22', end: '2026-10-24', text: 'LA Mars convention / Bangkok MVA' },
  { start: '2026-10-23', text: 'LUNEX internship consolidation review' },
  { start: '2026-10-30', text: 'Toulouse Cite de l espace' },
  { start: '2026-11-03', end: '2026-11-06', text: 'Cologne iSPare SAIRAS' },
  { start: '2026-11-13', text: 'LUNEX internship publications review' },
  { start: '2026-11-16', end: '2026-11-19', text: 'IpSpace Hainan' },
  { start: '2026-11-23', end: '2026-11-29', text: 'Hongkong Macau collaboration' },
  { start: '2026-12-01', end: '2026-12-03', text: 'Helsinki Space economy Forum' },
  { start: '2026-12-07', end: '2026-12-11', text: 'AGU San Francisco' },
  { start: '2026-12-11', text: 'LUNEX internship launch readiness' },
  { start: '2026-12-14', end: '2026-12-15', text: 'Leiden EuroSpaceHub workshop' },
  { start: '2026-12-16', text: 'BepiC Mercury orbit insertion' }
];

let calYear = new Date().getFullYear();

function renderCalendar() {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  $('cal-month-tabs').innerHTML = `
    <div style="display:flex; align-items:center; gap:16px; width:100%;">
      <button class="btn btn-ghost btn-sm" onclick="changeCalMonth(-1)">&#8592; Prev</button>
      <div style="font-size:16px; font-weight:600; min-width:160px; text-align:center;">${months[calMonth]} ${calYear}</div>
      <button class="btn btn-ghost btn-sm" onclick="changeCalMonth(1)">Next &#8594;</button>
      <button class="btn btn-ghost btn-sm" onclick="calMonth=new Date().getMonth(); calYear=new Date().getFullYear(); renderCalendar();" style="margin-left:auto">Today</button>
    </div>
  `;
  renderCalGrid();
}

function changeCalMonth(delta) {
  calMonth += delta;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
}

function openCalModal(id, dateStr) {
  if (!isEditor) {
    toast('Only admins can edit the calendar.', 'error');
    return;
  }
  const modal = $('cal-modal-overlay');
  const title = $('cal-modal-title');
  const delBtn = $('cal-ev-delete');
  
  if (id) {
    const ev = state.calEvents.find(e => e.id === id);
    if (!ev) return;
    $('cal-ev-id').value = ev.id;
    $('cal-ev-start').value = ev.start;
    $('cal-ev-end').value = ev.end || '';
    $('cal-ev-text').value = ev.text;
    title.textContent = 'Edit Event';
    delBtn.style.display = 'block';
  } else {
    $('cal-ev-id').value = '';
    $('cal-ev-start').value = dateStr || '';
    $('cal-ev-end').value = '';
    $('cal-ev-text').value = '';
    title.textContent = 'Add Event';
    delBtn.style.display = 'none';
  }
  
  modal.classList.add('open');
}

function closeCalModal() {
  $('cal-modal-overlay').classList.remove('open');
}

function saveCalEvent() {
  const id = $('cal-ev-id').value;
  const start = $('cal-ev-start').value;
  let end = $('cal-ev-end').value;
  const text = $('cal-ev-text').value.trim();
  
  if (!start || !text) {
    toast('Start date and text are required', 'error');
    return;
  }
  
  if (end && new Date(end) < new Date(start)) {
    end = ''; // Ignore invalid end date
  }

  if (id) {
    const ev = state.calEvents.find(e => e.id === id);
    if (ev) {
      ev.start = start;
      ev.end = end;
      ev.text = text;
    }
  } else {
    state.calEvents.push({ id: UID(), start, end, text });
  }
  
  save();
  renderCalendar();
  closeCalModal();
  toast('Event saved', 'success');
}

function deleteCalEvent() {
  const id = $('cal-ev-id').value;
  if (!id) return;
  state.calEvents = state.calEvents.filter(e => e.id !== id);
  save();
  renderCalendar();
  closeCalModal();
  toast('Event deleted', 'info');
}

function renderCalGrid() {
  const year = calYear;
  const firstDay = new Date(year, calMonth, 1).getDay();
  const daysInMonth = new Date(year, calMonth + 1, 0).getDate();
  const today = new Date();
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  // Build task map: date string → tasks[]
  const taskMap = {};
  state.weeks.forEach(w => w.tasks.forEach(t => {
    const s = new Date(w.startDate), e = new Date(w.endDate);
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      if (!taskMap[key]) taskMap[key] = [];
      taskMap[key].push(t);
    }
  }));

  // Build event map: date string → events[]
  const eventMap = {};
  if (state.calEvents) {
    state.calEvents.forEach(ev => {
      const s = new Date(ev.start), e = ev.end ? new Date(ev.end) : s;
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10);
        if (!eventMap[key]) eventMap[key] = [];
        eventMap[key].push(ev);
      }
    });
  }

  let html = days.map(d => `<div class="cal-day-header">${d}</div>`).join('');
  for (let i = 0; i < firstDay; i++) html += `<div class="cal-day empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = today.getFullYear()===year && today.getMonth()===calMonth && today.getDate()===d;
    const tasks = taskMap[dateStr] || [];
    const evs = eventMap[dateStr] || [];
    html += `<div class="cal-day${isToday?' today':''}" title="${tasks.length} tasks" onclick="openCalModal(null, '${dateStr}')">
      <div class="cal-day-num">${d}</div>
      <div style="margin-top:4px">
        ${evs.map(ev => {
          const isHL = (ev.id === highlightedEventId);
          const style = isHL ? 'background:var(--accent);border:1px solid var(--accent);color:#fff;box-shadow:0 0 0 2px var(--surface),0 0 0 3px var(--accent)' : 'background:var(--surface2);border:1px solid var(--border);color:var(--text2)';
          return `<div class="cal-task-chip" style="${style}" title="${ev.text}" onclick="event.stopPropagation(); openCalModal('${ev.id}')">${ev.text}</div>`;
        }).join('')}
      </div>
    </div>`;
  }
  $('cal-grid').innerHTML = html;
}

// ── Sidebar stats ─────────────────────────────────────────────────────────────
function updateSidebarStats() {
  const total = state.weeks.reduce((s,w)=>s+w.tasks.length,0);
  const done = state.weeks.reduce((s,w)=>s+w.tasks.filter(t=>t.done).length,0);
  $('stat-tasks').textContent = `${done}/${total}`;
  $('stat-articles').textContent = state.articles.length;
  const today = new Date();
  const left = state.weeks.filter(w=>new Date(w.endDate)>=today).length;
  $('stat-weeks').textContent = `${left}/26`;
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {

  // Auth state listener - fires immediately on load
  auth.onAuthStateChanged(async (user) => {
    updateAuthUI(user);
    // Reload data whenever auth changes so editors see edit controls
    await loadFromFirestore();
    initState();
    renderAll();
    updateSidebarStats();
  });

  // Nav
  document.querySelectorAll('.nav-item').forEach(n =>
    n.addEventListener('click', () => navigate(n.dataset.view)));

  // Splitter logic
  let isResizing = false;
  document.addEventListener('mousedown', e => {
    if (e.target.id === 'lib-resizer') {
      isResizing = true;
      e.target.classList.add('active');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }
  });
  document.addEventListener('mousemove', e => {
    if (!isResizing) return;
    const container = $('lib-cols');
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const offset = e.clientX - rect.left;
    const totalWidth = rect.width;
    const leftPct = Math.min(Math.max((offset / totalWidth) * 100, 20), 80);
    const rightPct = 100 - leftPct;
    document.documentElement.style.setProperty('--split-left', leftPct + '%');
    document.documentElement.style.setProperty('--split-right', rightPct + '%');
  });
  document.addEventListener('mouseup', e => {
    if (isResizing) {
      isResizing = false;
      document.querySelectorAll('.lib-resizer').forEach(r => r.classList.remove('active'));
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // Save split preference to localStorage
      const splitLeft = document.documentElement.style.getPropertyValue('--split-left');
      const splitRight = document.documentElement.style.getPropertyValue('--split-right');
      localStorage.setItem('researchHQ_split', JSON.stringify({ left: splitLeft, right: splitRight }));
    }
  });
  
  // Load saved split
  try {
    const savedSplit = JSON.parse(localStorage.getItem('researchHQ_split'));
    if (savedSplit) {
      document.documentElement.style.setProperty('--split-left', savedSplit.left);
      document.documentElement.style.setProperty('--split-right', savedSplit.right);
    }
  } catch(e) {}

  // Upload zones (one per track)
  function setupZone(zoneId, inputId, track) {
    const zone = $(zoneId);
    const input = $(inputId);
    zone.addEventListener('click', () => { input.click(); });
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('dragover'); handleUpload([...e.dataTransfer.files], track); });
    input.addEventListener('change', e => { handleUpload([...e.target.files], track); input.value = ''; });
  }
  setupZone('upload-zone-astro', 'file-input-astro', 'astro');
  setupZone('upload-zone-mars', 'file-input-mars', 'mars');

  // Modal close
  $('modal-close').addEventListener('click', () => $('modal-overlay').classList.remove('open'));
  $('modal-overlay').addEventListener('click', e => { if (e.target === $('modal-overlay')) $('modal-overlay').classList.remove('open'); });

  // Notif Modal close
  $('notif-modal-overlay').addEventListener('click', e => { if (e.target === $('notif-modal-overlay')) closeNotifModal(); });

  // Search
  $('lib-search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.article-card').forEach(c => {
      c.style.display = c.querySelector('.article-title').textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  initTheme();
  navigate('dashboard');
});

function renderAll() {
  renderDashboard();
  renderWeekList();
  renderWeekDetail();
  renderLibrary();
  renderCalendar();
  renderResources();
}

// ── Notifications ────────────────────────────────────────────────────────────
function updateNotifBadge() {
  const badge = $('notif-badge');
  if (!badge) return;
  if (!state.alerts) state.alerts = [];
  const unreadCount = state.alerts.filter(a => !a.read).length;
  badge.style.display = unreadCount > 0 ? 'block' : 'none';
}

function openNotifModal() {
  $('notif-modal-overlay').classList.add('open');
  renderNotifs();
  
  // Mark all as read
  let changed = false;
  state.alerts.forEach(a => {
    if (!a.read) { a.read = true; changed = true; }
  });
  if (changed) save();
  updateNotifBadge();
}

function closeNotifModal() {
  $('notif-modal-overlay').classList.remove('open');
}

function renderNotifs() {
  const container = $('notif-modal-body');
  container.innerHTML = '';
  if (!state.alerts || state.alerts.length === 0) {
    container.innerHTML = '<div style="color:var(--text3); text-align:center; padding: 20px;">No notifications.</div>';
    return;
  }
  
  const sorted = [...state.alerts].sort((a,b) => b.timestamp - a.timestamp);
  sorted.forEach(alert => {
    const div = document.createElement('div');
    div.className = 'notif-item' + (alert.read ? '' : ' unread');
    
    const timeStr = new Date(alert.timestamp).toLocaleString();
    div.innerHTML = `
      <div style="display:flex; align-items:flex-start; gap:8px;">
        <i data-lucide="bell" class="icon-sm" style="margin-top:2px; color:var(--accent)"></i>
        <div>
          <div>${alert.message}</div>
          <div class="notif-item-time">${timeStr}</div>
        </div>
      </div>
    `;
    container.appendChild(div);
  });
  lucide.createIcons();
}
