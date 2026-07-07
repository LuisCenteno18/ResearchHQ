const UID=()=>crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2,10)+Math.random().toString(36).slice(2,10);
const addDays=(date,n)=>{const d=new Date(date);d.setDate(d.getDate()+n);return d;};
const fmtDate=d=>d.toISOString().slice(0,10);
const WEEK_START=new Date('2026-06-29');

const PHASES=[
  {name:'Literature Survey',range:[1,4],color:'#9ea8f5'},
  {name:'Design & Acquisition',range:[5,8],color:'#67c4e8'},
  {name:'Lab Work & Analysis',range:[9,16],color:'#5fcf8a'},
  {name:'Interpretation',range:[17,20],color:'#d4a84b'},
  {name:'Writing',range:[21,24],color:'#e8905a'},
  {name:'Revision & Submission',range:[25,26],color:'#e07070'},
];

function getPhase(w){return PHASES.find(p=>w>=p.range[0]&&w<=p.range[1])||PHASES[0];}

// [track('a'=astro,'m'=mars,'b'=both), text, priority('h','m','l')]
const WEEK_TASKS=[
  // W1
  [
   ['m', 'Review key papers on Martian alluvial fan formation and classification', 'h'],
   ['m', 'Study Mars paleoclimate models for periods of water-flow activity', 'm'],
   ['a', 'Confirm EANA presentation format (oral vs poster).', 'h'],
   ['a', 'Formulate 3 primary research questions and log them in the LUNEX app.', 'h']
  ],
  // W2
  [
   ['m', 'Review HiRISE and CTX imagery for alluvial fan morphology studies', 'h'],
   ['m', 'Literature on sediment transport processes on Mars', 'm'],
   ['a', 'Isolate HRSC DTMs for Oxia Planitia.', 'h'],
   ['a', 'Format orbital data into the ingestion pipeline for your AI software.', 'h']
  ],
  // W3
  [
   ['m', 'Study terrestrial alluvial fan analogs: Atacama, Antarctic Dry Valleys', 'h'],
   ['m', 'Review CRISM spectral data analysis methods and pipelines', 'm'],
   ['a', 'Ground-truth AI weights against clay/vermiculite mineral profiles.', 'h'],
   ['a', 'Start drafting EANA and EPSC presentation decks/posters.', 'h']
  ],
  // W4
  [
   ['m', 'Write literature review summary for Martian fans (~1500 words)', 'h'],
   ['m', 'Identify target fan sites and map data coverage gaps', 'h'],
   ['a', 'Benchmark autonomous AI categorization speed offline.', 'h'],
   ['a', 'Execute your move to Lisbon. Ensure EuroSpaceHub DB is updated.', 'h']
  ],
  // W5
  [
   ['m', 'Download HiRISE images for selected alluvial fan target sites', 'h'],
   ['m', 'Download CTX context imagery and build scene coverage map', 'm'],
   ['a', 'Finalize the data visualizations and rendering for the EANA poster/deck.', 'h'],
   ['a', 'Finalize the visual assets for the EPSC presentation.', 'h']
  ],
  // W6
  [
   ['m', 'Process CRISM data for mineral mapping at fan sites', 'h'],
   ['m', 'Build GIS database for all selected fan sites', 'm'],
   ['a', 'Aug 12 Milestone: Verify EANA registration and transfer final payments.', 'h'],
   ['a', 'Organize local file directories for the upcoming ExoSpaceHab field run.', 'h']
  ],
  // W7
  [
   ['m', 'Generate DEMs from HiRISE stereo pairs for key fan sites', 'h'],
   ['m', 'Extract morphometric measurements: fan area, slope, apex-to-toe length', 'm'],
   ['a', 'Prepare initial data models for supervisor critique.', 'h'],
   ['a', 'Aug 19 Milestone: Present at the LUNEX Preliminary Progress Review (Hybrid).', 'h']
  ],
  // W8
  [
   ['m', 'Quality-control all data products (DEMs, spectral cubes, imagery)', 'h'],
   ['m', 'Document data sources, versions, and full processing pipeline', 'm'],
   ['a', 'Integrate AI software with portable spectrometers on the bench.', 'h'],
   ['a', 'Rehearse EANA and EPSC presentations. Pack hardware for deployment.', 'h']
  ],
  // W9
  [
   ['m', 'Map fan boundaries and depositional lobes for all target sites', 'h'],
   ['m', 'Measure fan apex angles and radial extent profiles', 'm'],
   ['a', 'Sept 1-4 Milestone: Present research at EANA 2026 in Neuchâtel.', 'h'],
   ['a', 'Discuss your autonomous mapping software with astrobiology peers.', 'h']
  ],
  // W10
  [
   ['m', 'Analyze grain-size proxies from CRISM spectral data', 'h'],
   ['m', 'Compare fan morphologies across sites: tabulate key metrics', 'm'],
   ['a', 'Sept 6-11 Milestone: Present remote sensing findings at EPSC in The Hague.', 'h'],
   ['a', 'Log peer feedback and identify potential institutional partners.', 'h']
  ],
  // W11
  [
   ['m', 'Reconstruct paleodischarge estimates using fan geometry and DEMs', 'h'],
   ['m', 'Model sediment flux using slope-area relationships', 'm'],
   ['a', 'Field Experiment: Deploy AI mapping software inside the ExoSpaceHab simulator.', 'h'],
   ['a', 'Sept 18 Milestone: Present at the LUNEX Mid-Term Progress Review.', 'h']
  ],
  // W12
  [
   ['m', 'Identify stratigraphic relationships and fan lobe superposition', 'h'],
   ['m', 'Create cross-sectional profiles from DEMs', 'm'],
   ['a', 'Process raw in-situ spectral logs generated during the simulator run.', 'h'],
   ['a', 'Sept 27 Milestone: Attend ESTEC Open Day (optional networking).', 'h']
  ],
  // W13
  [
   ['m', 'Statistical comparison of fan dimensions across all sites', 'h'],
   ['m', 'Cluster analysis to identify distinct morphological fan types', 'm'],
   ['a', 'Refine the AI software\'s training weights based on simulator field errors.', 'h'],
   ['a', 'Finalize the IAC presentation deck, focusing on field validation data.', 'h']
  ],
  // W14
  [
   ['m', 'Finalize morphometric database with all measured parameters', 'h'],
   ['m', 'Generate maps and visualizations for all target fan sites', 'm'],
   ['a', 'Oct 3-10 Milestone: Present adapted research at the IAC in Antalya.', 'h'],
   ['a', 'Network with international mission planners regarding PanCam targets.', 'h']
  ],
  // W15
  [
   ['m', 'Select Earth analog alluvial fans for comparative analysis', 'h'],
   ['m', 'Acquire comparable terrestrial datasets: aerial imagery and DEMs', 'm'],
   ['a', 'Combine orbital HRSC maps and in-situ AI mineral data into one model.', 'h'],
   ['a', 'Draft the 1-page outreach report summarizing the field campaign.', 'h']
  ],
  // W16
  [
   ['m', 'Compare morphometric parameters: Mars fans vs. Earth analogs', 'h'],
   ['m', 'Assess formative climate conditions implied by fan geometry', 'm'],
   ['a', 'Formulate the high-value landing site habitability recommendations.', 'h'],
   ['a', 'Oct 23 Milestone: Present at the LUNEX Consolidation Review.', 'h']
  ],
  // W17
  [
   ['m', 'Analyze implications for Mars water activity duration and volume', 'h'],
   ['m', 'Draft comparative analysis narrative (Mars vs. Earth analogs)', 'm'],
   ['a', 'Draft the core structure for your refereed journal article (e.g., Acta Astronautica).', 'h'],
   ['a', 'Detail the multi-instrument methodology and AI parameters in the paper.', 'h']
  ],
  // W18
  [
   ['m', 'Discuss tectonic vs. climatic controls on fan morphology', 'h'],
   ['m', 'Consult planetary geology collaborators on interpretation', 'm'],
   ['a', 'Draft the results and discussion section of the manuscript.', 'h'],
   ['a', 'Update the EuroSpaceHub website with your latest milestone achievements.', 'h']
  ],
  // W19
  [
   ['m', 'Refine comparative analysis based on collaborator feedback', 'h'],
   ['m', 'Finalize comparative figures and morphometric visualizations', 'm'],
   ['a', 'Complete the first full draft of the refereed publication.', 'h'],
   ['a', 'Nov 13 Milestone: Present at the LUNEX Publications Review and submit draft.', 'h']
  ],
  // W20
  [
   ['m', 'Synthesize Mars-Earth fan comparison into cohesive conclusion', 'h'],
   ['m', 'Finalize all figures and tables for Martian Fans manuscript', 'm'],
   ['a', 'Incorporate Prof. Foing\'s edits. Ensure LUNEX grant funding is acknowledged.', 'h'],
   ['a', 'Finalize the ExoMars PanCam targeting technical brief.', 'h']
  ],
  // W21
  [
   ['m', 'Write Introduction and Geological Context (Martian Fans ms.)', 'h'],
   ['b', 'Set up shared reference library (Zotero/Mendeley) for both papers', 'l'],
   ['a', 'Polish graphics, data tables, and formatting for journal submission requirements.', 'h'],
   ['a', 'Verify all software code is documented for repository handover.', 'h']
  ],
  // W22
  [
   ['m', 'Write Data and Methods section (Martian Fans ms.)', 'h'],
   ['b', 'Internal review of methods sections with supervisor', 'm'],
   ['a', 'Milestone: Formally submit the finalized paper to the targeted journal.', 'h'],
   ['a', 'Compile final DB records and references for the LUNEX organization.', 'h']
  ],
  // W23
  [
   ['m', 'Write Results section (Martian Fans ms.)', 'h'],
   ['b', 'Prepare graphical abstract concepts for both papers', 'm'],
   ['a', 'Prepare slides for the final 20-minute talk.', 'h']
  ],
  // W24
  [
   ['m', 'Write Discussion and Conclusions (Martian Fans ms.)', 'h'],
   ['b', 'Collate full draft manuscripts for internal review', 'm'],
   ['a', 'Dec 11 Milestone: LUNEX Launch Readiness Review (Hybrid).', 'h'],
   ['a', 'Dec 14-15 Milestone: Deliver the final 20-minute presentation.', 'h'],
   ['a', 'Execute final exit processing and celebrate the completion of the internship.', 'h']
  ],
  // W25
  [
   ['a', 'Full manuscript review and revision (Astrobiology ms.)', 'h'],
   ['a', 'Verify citation formatting to target journal style', 'm'],
   ['m', 'Full manuscript review and revision (Martian Fans ms.)', 'h'],
   ['m', 'Verify figure quality, DPI, and captions for journal requirements', 'm']
  ],
  // W26
  [
   ['a', 'Final proofreading of Astrobiology manuscript', 'h'],
   ['a', 'Submit Astrobiology manuscript', 'h'],
   ['m', 'Final proofreading of Martian Fans manuscript', 'h'],
   ['m', 'Submit Martian Fans manuscript', 'h']
  ]
];

function generateDefaultWeeks(){
  return WEEK_TASKS.map((taskList,i)=>{
    const weekNum=i+1;
    const start=addDays(WEEK_START,i*7);
    const end=addDays(start,6);
    const tasks=taskList.map(([t,text,pri])=>({
      id:UID(),
      track:t==='a'?'astro':t==='m'?'mars':'both',
      text,
      priority:pri==='h'?'high':pri==='l'?'low':'medium',
      done:false,
    }));
    return{weekNum,startDate:fmtDate(start),endDate:fmtDate(end),tasks,notes:''};
  });
}
